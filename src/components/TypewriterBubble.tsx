import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Copy, ThumbsUp, ThumbsDown, Volume2, RefreshCw, Pencil, Square, AlertTriangle, CalendarClock, Info } from "lucide-react";
import useTypewriter from "@/hooks/use-typewriter";
import SevenLogo from "@/components/SevenLogo";
import ThinkingTrace, { type ThinkingStep } from "@/components/ThinkingTrace";
import Citations, { type ResearchSource } from "@/components/Citations";
import { formatMessageTime } from "@/lib/format-message-time";
import { supabase } from "@/lib/supabase";

/**
 * Callout segment parsing (Architecture v5.7 sec.10.10).
 *
 * The chat function emits three callout variants when surfacing important
 * points: ":::pattern" (behaviour-pattern observations), ":::decision"
 * (decisions due for review), ":::note" (rare critical flags). Each block
 * is fenced with ":::variant" on its own line as opener and ":::" on its
 * own line as closer, with the body as inner markdown content.
 *
 * parseCalloutSegments splits a response string into an ordered list of
 * segments -- markdown prose in between, callouts at their fence positions.
 * Each segment retains its original content; we render markdown through
 * ReactMarkdown and callouts through <Callout>.
 */

type CalloutVariant = "pattern" | "decision" | "note";

interface MarkdownSegment {
  kind: "markdown";
  content: string;
}

interface CalloutSegment {
  kind: "callout";
  variant: CalloutVariant;
  content: string;
}

type Segment = MarkdownSegment | CalloutSegment;

const CALLOUT_FENCE_RE = /^:::(pattern|decision|note)\s*$/m;

function parseCalloutSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const remaining = text.slice(cursor);
    const openMatch = remaining.match(CALLOUT_FENCE_RE);
    if (!openMatch || openMatch.index === undefined) {
      // No more callouts; remainder is markdown.
      const tail = text.slice(cursor);
      if (tail.length > 0) segments.push({ kind: "markdown", content: tail });
      break;
    }

    const openOffset = cursor + openMatch.index;
    const variant = openMatch[1] as CalloutVariant;

    // Push any markdown content before the fence.
    if (openOffset > cursor) {
      const before = text.slice(cursor, openOffset);
      if (before.length > 0) segments.push({ kind: "markdown", content: before });
    }

    // Find matching closer (":::" on its own line) AFTER the opener.
    const afterOpener = openOffset + openMatch[0].length;
    const closerSearchStart = afterOpener;
    // Match a ":::" on its own line.
    const closerRe = /^:::\s*$/m;
    const closerMatch = text.slice(closerSearchStart).match(closerRe);

    if (!closerMatch || closerMatch.index === undefined) {
      // Unclosed fence -- treat the rest as markdown including the opener.
      // This is the streaming-mid-callout case: we render plain text until
      // the closer arrives. The fallback prevents partial callouts from
      // breaking rendering entirely.
      const tail = text.slice(openOffset);
      if (tail.length > 0) segments.push({ kind: "markdown", content: tail });
      break;
    }

    const closerOffset = closerSearchStart + closerMatch.index;
    let body = text.slice(afterOpener, closerOffset);
    // Strip leading/trailing newlines from body (the fences are on their own
    // lines so the body has surrounding whitespace).
    body = body.replace(/^\n+/, "").replace(/\n+$/, "");
    segments.push({ kind: "callout", variant, content: body });

    cursor = closerOffset + closerMatch[0].length;
    // Advance past trailing newline after the closer if present.
    if (text[cursor] === "\n") cursor += 1;
  }

  return segments;
}

const CALLOUT_VARIANT_STYLES: Record<CalloutVariant, {
  bg: string;
  border: string;
  iconColor: string;
  Icon: typeof AlertTriangle;
  label: string;
}> = {
  pattern: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    iconColor: "text-amber-600 dark:text-amber-500",
    Icon: AlertTriangle,
    label: "Pattern",
  },
  decision: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    iconColor: "text-blue-600 dark:text-blue-500",
    Icon: CalendarClock,
    label: "Decision due",
  },
  note: {
    bg: "bg-foreground/5",
    border: "border-foreground/20",
    iconColor: "text-foreground/70",
    Icon: Info,
    label: "Note",
  },
};


interface TypewriterBubbleProps {
  text: string;
  /** ISO timestamp of when the assistant message was created. Optional --
   *  bubbles without a timestamp simply omit the time line. */
  createdAt?: string | null;
  /** Client-generated UUID for assistant responses while streaming, OR the
   *  messages.id uuid for historical messages loaded from the database.
   *  In both cases it's a real uuid, satisfying feedback_signals.response_id
   *  type constraint. Required for feedback_signals capture (sec.10.10.8). */
  responseId?: string;
  /** Live progress events from the chat function while streaming
   *  (sec.10.10.7). Empty array on completion until first event arrives. */
  thinkingTrace?: ThinkingStep[];
  /** True from send() until the SSE done event. While streaming, we render
   *  text directly as it accumulates and skip the typewriter animation. */
  isStreaming?: boolean;
  /** Model that served the response (e.g. "gpt-4o"). Captured into
   *  feedback_signals.context_at_time.model_used. */
  modelUsed?: string;
  /** Per-message context-used counts. Captured into
   *  feedback_signals.response_metadata.context_used_total. */
  contextUsed?: {
    facts: number;
    decisions: number;
    patterns: number;
    memories: number;
    semantic_matches?: number;
    situations?: number;
  };
  /** Conversation id at the time of send. Captured into
   *  feedback_signals.context_at_time.conversation_id. */
  sectionId?: string | null;
  /** Research sources from Gemini grounding (sec.10.10.5). Empty/undefined
   *  when grounding didn't fire on this turn. Renders the Citations
   *  component below the response when present. */
  researchSources?: ResearchSource[];
  /** Callback to regenerate this assistant response. */
  onRegenerate?: () => void;
  /** Callback to edit-and-resend the user message above this assistant
   *  message. The bubble lifts the user message text up to the parent
   *  via this callback. */
  onEdit?: () => void;
}

/**
 * Whitelist of markdown elements Seven is permitted to render in chat.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.7 sec.10.9 rule 3
 * (bold key terms, italics subtle distinctions) and rule 6 (structure when
 * structure helps -- three-step plan = numbered list, comparison = short
 * table). Rule 4 (emoji set) renders as plain unicode and needs no
 * special handling.
 *
 * SECURITY: links rendered as plain text (NOT <a>) to prevent
 * prompt-injection-induced clickable URLs. If the model ever produces a
 * markdown link, the user sees the link text without the underlying href
 * being clickable.
 */
const allowedComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h3: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h1: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  code: ({ children, className }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return (
        <code className="block px-3 py-2 my-2 rounded-md bg-muted/60 text-[13px] font-mono whitespace-pre overflow-x-auto">
          {children}
        </code>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-muted/60 text-[13px] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="border-collapse border border-border text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-semibold border-r border-border last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 border-r border-border last:border-r-0 align-top">
      {children}
    </td>
  ),
  a: ({ children }) => (
    <span className="underline decoration-muted-foreground/40 underline-offset-2">
      {children}
    </span>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

/**
 * Single callout component (sec.10.10). Renders a fenced block with the
 * variant's accent palette + icon + label, and the body content rendered
 * through ReactMarkdown so inline emphasis (bold, links) works inside.
 *
 * Animation: one-shot pulse on first mount. Background and border fade
 * from accent-strong to accent-resting over 1.2s, easing out, runs once.
 * Framer-motion's `animate` prop with no `repeat` does this cleanly --
 * no useEffect, no state, no re-trigger on parent re-render (because the
 * Callout is unmounted/remounted only when its segment changes, which
 * only happens when the response itself changes).
 */
const Callout = ({ variant, content }: { variant: CalloutVariant; content: string }) => {
  const styles = CALLOUT_VARIANT_STYLES[variant];
  const Icon = styles.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: 1,
        y: 0,
        // Subtle pulse: background flashes briefly more saturated then settles.
        // The keyframes interpolate over the same property; final value is
        // the resting state.
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`my-3 rounded-xl border ${styles.bg} ${styles.border} px-3.5 py-3`}
    >
      <motion.div
        initial={{ boxShadow: `0 0 0 0 hsl(var(--foreground) / 0)` }}
        animate={{
          boxShadow: [
            `0 0 0 0 hsl(var(--foreground) / 0)`,
            `0 0 0 4px hsl(var(--foreground) / 0.08)`,
            `0 0 0 0 hsl(var(--foreground) / 0)`,
          ],
        }}
        transition={{ duration: 1.2, ease: "easeOut", times: [0, 0.4, 1] }}
        className="rounded-xl"
      >
        <div className="flex items-start gap-2.5">
          <div className={`shrink-0 mt-0.5 ${styles.iconColor}`}>
            <Icon size={16} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${styles.iconColor} mb-1`}>
              {styles.label}
            </div>
            <div className="text-[14px] leading-relaxed text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={allowedComponents}
                allowedElements={[
                  "p", "strong", "em", "code", "a", "ul", "ol", "li",
                ]}
                unwrapDisallowed
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Renders response text by splitting into markdown + callout segments and
 * mapping each to its renderer. Single ReactMarkdown call per segment to
 * keep styling identical to the existing rendering pipeline.
 */
const CalloutAwareMarkdown = ({ text }: { text: string }) => {
  const segments = parseCalloutSegments(text);

  // Fast path: no callouts -> exactly the same as the previous single-call
  // render. Same component instance shape, same children, no behaviour
  // change for responses that don't use the callout syntax.
  if (segments.length === 1 && segments[0].kind === "markdown") {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={allowedComponents}
        allowedElements={[
          "p", "h1", "h2", "h3", "strong", "em", "ul", "ol", "li",
          "code", "pre", "table", "thead", "tbody", "tr", "th", "td",
          "a", "blockquote", "hr",
        ]}
        unwrapDisallowed
      >
        {segments[0].content}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "markdown" ? (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            components={allowedComponents}
            allowedElements={[
              "p", "h1", "h2", "h3", "strong", "em", "ul", "ol", "li",
              "code", "pre", "table", "thead", "tbody", "tr", "th", "td",
              "a", "blockquote", "hr",
            ]}
            unwrapDisallowed
          >
            {seg.content}
          </ReactMarkdown>
        ) : (
          <Callout key={i} variant={seg.variant} content={seg.content} />
        ),
      )}
    </>
  );
};

/**
 * Compute response metadata heuristics for feedback_signals capture
 * (sec.10.10.8). Run client-side on the rendered text.
 */
function computeResponseMetadata(text: string, contextUsed?: TypewriterBubbleProps["contextUsed"]) {
  const lengthChars = text.length;
  // Pushback heuristic: explicit disagreement markers in the first paragraph.
  const firstPara = text.split("\n\n")[0] ?? "";
  const usedPushback = /\b(actually|but|however|disagree|wrong|i'd push back|i would push back|consider the opposite|the data says|that's not right)\b/i.test(firstPara);
  // Emoji heuristic: any non-ASCII char in BMP-emoji range. Cheap proxy.
  const usedEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text);
  // Chart heuristic: markdown table presence.
  const usedChart = /\n\|.*\|.*\n/.test(text);
  // Research-grounded heuristic: chat function emits source citations as
  // "[N]" with a sources block. Detect either pattern.
  const wasResearchGrounded = /\bSources?:\s*\n/.test(text) || /\[\d+\][\s,.]/.test(text);
  // Pattern warning heuristic: chat function uses an emoji marker for
  // pattern interventions ("warning" or "alert" framing in the first 200 chars).
  const wasPatternWarning = /\b(pattern|you've tried this|attempted this|fail(ed)? \d+ times|the only time)/i.test(text.slice(0, 400));

  return {
    length_chars: lengthChars,
    used_pushback: usedPushback,
    used_emoji: usedEmoji,
    used_chart: usedChart,
    was_research_grounded: wasResearchGrounded,
    was_pattern_warning: wasPatternWarning,
    context_used_total: contextUsed
      ? (contextUsed.facts + contextUsed.decisions + contextUsed.patterns + contextUsed.memories)
      : 0,
  };
}

const TypewriterBubble = ({
  text,
  createdAt,
  responseId,
  thinkingTrace,
  isStreaming,
  modelUsed,
  contextUsed,
  sectionId,
  researchSources,
  onRegenerate,
  onEdit,
}: TypewriterBubbleProps) => {
  const isStream = Boolean(isStreaming);

  // Typewriter only fires on already-resolved historical messages (loadSection
  // path). Live-streamed messages render text directly as it accumulates so
  // we don't double-animate (typewriter on top of token streaming).
  const { displayed, done: typewriterDone } = useTypewriter(isStream ? "" : text, 18);
  const renderingComplete = isStream ? !isStream : typewriterDone;
  const visibleText = isStream ? text : displayed;

  // Per-message affordance state
  const [feedbackState, setFeedbackState] = useState<"none" | "positive" | "negative" | "submitting">("none");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Affordance handlers ---------------------------------------------

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied", { duration: 1500 });
    } catch {
      toast.error("Couldn't copy", { duration: 1500 });
    }
  };

  const submitFeedback = async (signal: "positive" | "negative") => {
    if (!responseId) {
      toast.error("Cannot record feedback for this message");
      return;
    }
    if (feedbackState === "submitting") return;
    // Toggle: clicking same signal again is a no-op (feedback is append-only,
    // but we don't want to allow double-submit accidentally). The UI shows
    // the signal as "received"; further clicks do nothing.
    if (feedbackState === signal) return;

    const prevState = feedbackState;
    setFeedbackState("submitting");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Sign in required");
        setFeedbackState(prevState);
        return;
      }

      const responseMetadata = computeResponseMetadata(text, contextUsed);
      const contextAtTime = {
        conversation_id: sectionId ?? null,
        model_used: modelUsed ?? null,
        time_of_day_local: new Date().toLocaleTimeString(undefined, { hour12: false }),
      };

      const { error } = await supabase.from("feedback_signals").insert({
        user_id: session.user.id,
        response_id: responseId,
        signal,
        surface: "chat",
        response_metadata: responseMetadata,
        context_at_time: contextAtTime,
      });

      if (error) {
        console.error("[FEEDBACK] Insert failed:", error.message);
        toast.error("Couldn't record feedback", { duration: 2000 });
        setFeedbackState(prevState);
        return;
      }

      setFeedbackState(signal);
      // Silent success per sec.10.10.8 -- no toast on success. The icon-fill
      // is the only visual confirmation.
    } catch (err) {
      console.error("[FEEDBACK] Error:", err);
      toast.error("Couldn't record feedback", { duration: 2000 });
      setFeedbackState(prevState);
    }
  };

  const handlePlay = async () => {
    // Stop any currently playing audio first.
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setAudioPlaying(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sign in required");
        return;
      }

      setAudioPlaying(true);

      const { data, error } = await supabase.functions.invoke("voice-tts", {
        body: { text },
      });

      if (error) throw error;

      // voice-tts returns base64 audio (mp3) per the live mode integration.
      const audioBase64 = data?.audio as string | undefined;
      if (!audioBase64) {
        throw new Error("voice-tts returned no audio");
      }

      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => {
        setAudioPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setAudioPlaying(false);
        audioRef.current = null;
        toast.error("Playback failed");
      };
      await audio.play();
    } catch (err) {
      console.error("[PLAY] Error:", err);
      setAudioPlaying(false);
      audioRef.current = null;
      toast.error("Couldn't play audio");
    }
  };

  const showAffordances = renderingComplete && !!text && responseId !== undefined;

  return (
    <div className="max-w-[85%] md:max-w-[75%] lg:max-w-[65%] px-4 py-3 text-[14px] leading-relaxed text-foreground">
      <div className="flex items-center gap-2 mb-2">
        <SevenLogo size={16} />
        <span className="text-[12px] font-medium text-muted-foreground">Seven</span>
      </div>

      {/* Thinking trace (sec.10.10.7). Renders nothing if trace is empty. */}
      <ThinkingTrace steps={thinkingTrace ?? []} isStreaming={isStream} />

      {renderingComplete && !isStream ? (
        <CalloutAwareMarkdown text={visibleText} />
      ) : isStream && text.length > 0 ? (
        // Streaming: render text directly. Markdown parsing while characters
        // stream in produces visible half-formed markup. Render plain text +
        // pulsing cursor; markdown engine takes over when isStreaming flips
        // false in the done event.
        <>
          <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-[2px] h-[14px] bg-primary ml-0.5 align-middle"
          />
        </>
      ) : isStream ? (
        // Streaming, no text yet -- thinking trace handles the "something is
        // happening" surface. Don't render a placeholder.
        null
      ) : (
        // Historical, typewriter still animating.
        <>
          {visibleText}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-[2px] h-[14px] bg-primary ml-0.5 align-middle"
          />
        </>
      )}

      {/* Source citations (sec.10.10.5). Renders below the response text
          when Gemini grounding fired this turn. Distinct from ThinkingTrace
          above: this lists the actual URLs Seven used; ThinkingTrace shows
          how many sources were consulted. Empty array renders nothing. */}
      {renderingComplete && researchSources && researchSources.length > 0 ? (
        <Citations sources={researchSources} />
      ) : null}

      {/* --- Per-message affordances (sec.10.10.6) -------------------- */}
      {/* Hover-revealed on desktop via group-hover; tap-to-show on mobile via
          group-focus-within. The parent in Home.tsx adds `group` + tabIndex. */}
      <AnimatePresence>
        {showAffordances ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-0.5 mt-2 -ml-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
          >
            <AffordanceButton
              icon={<Copy size={13} aria-hidden="true" />}
              label="Copy"
              onClick={handleCopy}
            />
            <AffordanceButton
              icon={
                <ThumbsUp
                  size={13}
                  aria-hidden="true"
                  className={feedbackState === "positive" ? "fill-current" : ""}
                />
              }
              label={feedbackState === "positive" ? "You liked this" : "Like"}
              onClick={() => submitFeedback("positive")}
              disabled={feedbackState === "submitting"}
              active={feedbackState === "positive"}
            />
            <AffordanceButton
              icon={
                <ThumbsDown
                  size={13}
                  aria-hidden="true"
                  className={feedbackState === "negative" ? "fill-current" : ""}
                />
              }
              label={feedbackState === "negative" ? "You disliked this" : "Dislike"}
              onClick={() => submitFeedback("negative")}
              disabled={feedbackState === "submitting"}
              active={feedbackState === "negative"}
            />
            <AffordanceButton
              icon={
                audioPlaying
                  ? <Square size={13} aria-hidden="true" />
                  : <Volume2 size={13} aria-hidden="true" />
              }
              label={audioPlaying ? "Stop" : "Play"}
              onClick={handlePlay}
            />
            {onRegenerate ? (
              <AffordanceButton
                icon={<RefreshCw size={13} aria-hidden="true" />}
                label="Regenerate"
                onClick={onRegenerate}
              />
            ) : null}
            {onEdit ? (
              <AffordanceButton
                icon={<Pencil size={13} aria-hidden="true" />}
                label="Edit your message"
                onClick={onEdit}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Implicit timestamp -- v5.7 sec.10.9 rule 5 + sec.10.5
          hover/long-press. Hidden by default, revealed on group-hover or
          focus-within (touch via tap-to-focus). */}
      {renderingComplete && createdAt ? (
        <div
          className="text-[11px] text-muted-foreground/70 mt-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
          aria-label={`Sent ${formatMessageTime(createdAt)}`}
        >
          {formatMessageTime(createdAt)}
        </div>
      ) : null}
    </div>
  );
};

interface AffordanceButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

/**
 * Single per-message affordance button. Tooltip on hover via `title` (no
 * additional Tooltip primitive needed here -- the icon row already has
 * group-hover gating). Active state: filled icon already handled by parent.
 */
const AffordanceButton = ({ icon, label, onClick, disabled, active }: AffordanceButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`
      w-7 h-7 rounded-md flex items-center justify-center
      transition-colors disabled:opacity-50 disabled:cursor-not-allowed
      ${active
        ? "text-primary bg-primary/10"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      }
    `}
  >
    {icon}
  </button>
);

export default TypewriterBubble;
