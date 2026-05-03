import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronRight, BookOpen, Search, Database, Sparkles } from "lucide-react";

/**
 * ThinkingTrace -- Architecture v5.7 Section 10.10.7
 *
 * Renders the substrate consultation trace alongside an assistant message.
 * Two states:
 *
 *   - LIVE (isStreaming=true): visible, animated. Each progress event
 *     appears as it arrives with a fade-in. A pulsing dot marks the
 *     in-flight step. Empty trace renders nothing -- no "Thinking..."
 *     placeholder, no skeleton. Silence until the first event arrives.
 *
 *   - COMPLETED (isStreaming=false, steps.length > 0): collapsed by
 *     default. Renders as a small "Sources" affordance. Click to expand
 *     and see what the substrate consulted. Hidden when steps is empty.
 *
 * Per the Premium Quality Gate (Section 15.10.5(j-q)), this surface is
 * what makes the substrate intelligence FELT. Without it, identity model
 * deepening produces invisible improvements (the sec.10.10.7 failure mode).
 */

export type ThinkingStepKind =
  | "reading_memory"
  | "consulting_identity_model"
  | "reading_research"
  | "checking_decisions";

export interface ThinkingStep {
  step: ThinkingStepKind;
  detail?: string;
  /** ISO 8601 timestamp set on the client when the event arrived. */
  startedAt: string;
}

interface ThinkingTraceProps {
  steps: ThinkingStep[];
  isStreaming: boolean;
}

/**
 * Pretty labels + icons for each step kind. The label text is human prose,
 * not engineering shorthand -- Seven is consulting memory, not "performing
 * memory subsystem query". Per Architecture v5.7 Section 10.10.7 the user
 * should feel the substrate working, not see the wiring.
 */
const STEP_META: Record<ThinkingStepKind, { label: string; icon: typeof Brain }> = {
  reading_memory: { label: "Reading what I remember about you", icon: Database },
  consulting_identity_model: { label: "Considering who you are", icon: Brain },
  reading_research: { label: "Looking up what's true right now", icon: Search },
  checking_decisions: { label: "Checking decisions and patterns", icon: BookOpen },
};

const ThinkingTrace = ({ steps, isStreaming }: ThinkingTraceProps) => {
  const [expanded, setExpanded] = useState(false);

  // Empty trace + not streaming -> render nothing. Empty trace + streaming
  // -> also render nothing until the first event arrives. Avoid "thinking..."
  // placeholders that promise more than the substrate can deliver.
  if (steps.length === 0) return null;

  // --- LIVE STATE -------------------------------------------------------
  // Inline list, animated entry, current step pulses.
  if (isStreaming) {
    return (
      <div className="mb-3 space-y-1.5" aria-live="polite" aria-label="Seven is consulting your substrate">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => {
            const meta = STEP_META[s.step];
            const Icon = meta.icon;
            const isLast = i === steps.length - 1;
            return (
              <motion.div
                key={`${s.step}-${s.startedAt}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 text-[12px] text-muted-foreground"
              >
                <Icon size={12} aria-hidden="true" className="shrink-0 opacity-60" />
                <span>{meta.label}</span>
                {s.detail ? (
                  <span className="text-muted-foreground/70 italic">{s.detail}</span>
                ) : null}
                {isLast ? (
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="inline-block w-1 h-1 rounded-full bg-primary ml-1"
                    aria-hidden="true"
                  />
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  // --- COMPLETED STATE -------------------------------------------------
  // Collapsed pill. Click to expand the consulted-list summary.
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide what Seven consulted" : "Show what Seven consulted"}
      >
        {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
        <Sparkles size={11} aria-hidden="true" className="opacity-60" />
        <span>
          {steps.length === 1
            ? "Consulted 1 source"
            : `Consulted ${steps.length} sources`}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 ml-2 space-y-1 border-l border-border/60 pl-3 py-1">
              {steps.map((s, i) => {
                const meta = STEP_META[s.step];
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Icon size={11} aria-hidden="true" className="shrink-0 opacity-60" />
                    <span>{meta.label}</span>
                    {s.detail ? (
                      <span className="text-muted-foreground/60 italic">{s.detail}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingTrace;
