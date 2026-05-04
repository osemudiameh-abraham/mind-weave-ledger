import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ChevronDown, ChevronRight, BookMarked } from "lucide-react";

/**
 * Citations -- Architecture v5.7 sec.10.10.5.
 *
 * Renders the source list for a research-grounded response. Distinct from
 * the ThinkingTrace (sec.10.10.7): ThinkingTrace shows "I consulted N
 * sources" as substrate-consultation evidence; Citations shows the actual
 * URLs Seven used so the user can verify or read further.
 *
 * Two states:
 *   - COLLAPSED: small "N sources" pill below the response. Click to expand.
 *   - EXPANDED: vertical list of source cards, each with title + domain +
 *     external-link icon. Cards are clickable; clicking opens the URL in
 *     a new tab.
 *
 * Empty sources renders nothing -- responses without research grounding
 * never show this component.
 */

export interface ResearchSource {
  title: string;
  url: string;
  /** Optional snippet from the source. Not shown in v1, reserved for
   *  future expansion of the expanded card layout. */
  snippet?: string;
}

interface CitationsProps {
  sources: ResearchSource[];
}

/**
 * Extract a clean domain from a URL for display in the source card.
 * Falls back to the raw URL if parsing fails.
 */
function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const Citations = ({ sources }: CitationsProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 mb-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 hover:text-foreground transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide sources Seven used" : "Show sources Seven used"}
      >
        {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
        <BookMarked size={11} aria-hidden="true" className="opacity-70" />
        <span className="font-medium">
          {sources.length === 1 ? "1 source" : `${sources.length} sources`}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ol className="mt-2 space-y-1.5 pl-1">
              {sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 px-2.5 py-2 -ml-0.5 rounded-lg border border-border/40 hover:border-border hover:bg-muted/30 transition-colors"
                  >
                    <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted/60 text-[10px] font-semibold text-muted-foreground mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {s.title || extractDomain(s.url)}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {extractDomain(s.url)}
                      </div>
                    </div>
                    <ExternalLink
                      size={12}
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground/60 group-hover:text-foreground transition-colors mt-1"
                    />
                  </a>
                </li>
              ))}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Citations;
