import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

const traces = [
  {
    id: 1,
    action: "Suggested you delegate design reviews",
    reasoning: "Based on your energy tracking data (23 entries), design reviews consistently scored lowest. Combined with your stated goal of freeing up 4+ hours/week.",
    sources: ["Energy logs (Mar 1–18)", "Goal: Optimize weekly schedule", "Conversation Mar 12"],
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    action: "Flagged recurring indecision around hiring",
    reasoning: "You've revisited the 'hire vs contract' question 4 times in 3 weeks without resolution. This matches a pattern of avoidance when stakes feel high.",
    sources: ["Conversations Mar 5, 10, 15, 22", "Pattern: Decision avoidance under pressure"],
    timestamp: "Yesterday",
  },
  {
    id: 3,
    action: "Reminded you about 6 AM wake-up commitment",
    reasoning: "You set this as a tracked commitment on Mar 15. Compliance has dropped to 40% over the last 5 days.",
    sources: ["Commitment log", "Sleep data inference", "Conversation Mar 15"],
    timestamp: "3 days ago",
  },
  {
    id: 4,
    action: "Connected your funding stress to sleep pattern change",
    reasoning: "Your messages about Series B started showing stress markers on Mar 20. Your reported sleep quality dropped from 8/10 to 5/10 in the same period.",
    sources: ["Sentiment analysis", "Self-reported sleep scores", "Topic: Series B"],
    timestamp: "1 week ago",
  },
];

const Trace = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-primary" />
            <h1 className="text-[22px] font-medium text-foreground tracking-tight">Governance Trace</h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            Full transparency. Every action Seven takes, and why.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {traces.map((trace, i) => {
            const isOpen = expanded === trace.id;
            return (
              <motion.div
                key={trace.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : trace.id)}
                  className="w-full p-4 flex items-start justify-between text-left"
                >
                  <div className="flex-1 mr-3">
                    <p className="text-[14px] font-medium text-foreground leading-snug">{trace.action}</p>
                    <span className="text-[11px] text-muted-foreground mt-1 block">{trace.timestamp}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>

                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="px-4 pb-4 border-t border-border"
                  >
                    <div className="pt-3">
                      <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Why this?</h4>
                      <p className="text-[13px] text-foreground/80 leading-relaxed mb-4">{trace.reasoning}</p>

                      <h4 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sources used</h4>
                      <div className="flex flex-wrap gap-2">
                        {trace.sources.map((s, j) => (
                          <span key={j} className="text-[11px] bg-muted text-muted-foreground px-3 py-1 rounded-full">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Trace;
