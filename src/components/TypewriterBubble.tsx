import { motion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import useTypewriter from "@/hooks/use-typewriter";
import SevenLogo from "@/components/SevenLogo";
import { formatMessageTime } from "@/lib/format-message-time";

interface TypewriterBubbleProps {
  text: string;
  /** ISO timestamp of when the assistant message was created. Optional —
   *  bubbles without a timestamp simply omit the time line. */
  createdAt?: string | null;
}

/**
 * Whitelist of markdown elements Seven is permitted to render in chat.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.7 §10.9 rule 3
 * (bold key terms, italics subtle distinctions) and rule 6 (structure when
 * structure helps — three-step plan = numbered list, comparison = short
 * table). Rule 4 (emoji set) renders as plain unicode and needs no
 * special handling.
 *
 * SECURITY: links rendered as plain text (NOT <a>) to prevent
 * prompt-injection-induced clickable URLs. If the model ever produces a
 * markdown link, the user sees the link text without the underlying href
 * being clickable.
 */
const allowedComponents: Components = {
  // Block elements — minimal styling, default to body 14px line-relaxed.
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h3: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  // h1/h2 deliberately NOT allowed — too loud for chat at 14px body.
  // Treat them as h3 if the model produces them.
  h1: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-[15px] font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>
  ),

  // Inline emphasis — semibold (not bold) at 14px body for §10.9 rule 3.
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  // Lists.
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

  // Code — inline + block. Inline gets bg/padding; block gets a tinted card.
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
  pre: ({ children }) => <>{children}</>, // <code> handles block styling itself.

  // Tables — bordered, compact, inline with body text. Architecture §10.9
  // rule 6: "a comparison gets a short table".
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

  // Links — render text only, no <a>. Security defence against
  // prompt-injection-induced clickable URLs. The link text appears with a
  // subtle underline so it's still clearly a reference.
  a: ({ children }) => (
    <span className="underline decoration-muted-foreground/40 underline-offset-2">
      {children}
    </span>
  ),

  // Blockquotes — used rarely but rendering them sensibly.
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  // Horizontal rule.
  hr: () => <hr className="my-3 border-border" />,
};

const TypewriterBubble = ({ text, createdAt }: TypewriterBubbleProps) => {
  const { displayed, done } = useTypewriter(text, 18);

  // Markdown parsing while characters stream in looks broken (half-formed
  // **bold** markers, partial table cells, etc.). Render plain text + cursor
  // until the typewriter completes, THEN swap to markdown rendering.
  return (
    <div className="max-w-[85%] md:max-w-[75%] lg:max-w-[65%] px-4 py-3 text-[14px] leading-relaxed text-foreground">
      <div className="flex items-center gap-2 mb-2">
        <SevenLogo size={16} />
        <span className="text-[12px] font-medium text-muted-foreground">Seven</span>
      </div>

      {done ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={allowedComponents}
          // disallow raw HTML — react-markdown 9.x is HTML-safe by default,
          // this is belt-and-braces. No skipHtml needed.
          allowedElements={[
            "p",
            "h1",
            "h2",
            "h3",
            "strong",
            "em",
            "ul",
            "ol",
            "li",
            "code",
            "pre",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
            "a",
            "blockquote",
            "hr",
          ]}
          unwrapDisallowed
        >
          {text}
        </ReactMarkdown>
      ) : (
        <>
          {displayed}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-[2px] h-[14px] bg-primary ml-0.5 align-middle"
          />
        </>
      )}

      {/* Implicit timestamp — v5.7 §10.9 rule 5 ("Every message implicitly
          carries a timestamp") + §10.5 ("shown on hover (desktop) or
          long-press (mobile)").
          Hidden by default, revealed on group-hover or focus-within. The
          parent message wrapper in Home.tsx adds the `group` class. On
          touch devices without hover, tap-to-focus on a message reveals
          the timestamp via focus-within. */}
      {done && createdAt ? (
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

export default TypewriterBubble;
