import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageError } from "@/components/PageError";
import { TraceSkeleton } from "@/components/PageSkeletons";

// Strategy history JSON shape written by the chat Edge Function (post-v5).
// Older rows may be missing fields or the whole object; every read is defensive.
interface StrategyHistory {
  facts_count?: number;
  decisions_count?: number;
  patterns_count?: number;
  recent_memories_count?: number;
  semantic_matches_count?: number;
  situations_count?: number;
  pattern_interventions?: string[];
  source?: string;
  sources_used?: string[];
}

interface TraceEntry {
  id: string;
  query_text: string | null;
  assistant_text: string | null;
  picked_memory_ids: string[] | null;
  strategy_history: StrategyHistory | null;
  created_at: string;
}

const Trace = () => {
  const { user } = useAuth();
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("memory_traces")
      .select("id, query_text, assistant_text, picked_memory_ids, strategy_history, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setLoadError(error);
      setLoading(false);
      return;
    }
    if (data) setTraces(data as TraceEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Card title: prefer the user's question, fall back to the assistant's
  // response, fall back to a generic placeholder. Truncate for display.
  const cardTitle = (trace: TraceEntry): string => {
    const raw = trace.query_text || trace.assistant_text || "Response logged";
    const trimmed = raw.trim();
    if (trimmed.length <= 140) return trimmed;
    return `${trimmed.slice(0, 137)}…`;
  };

  // Human-readable reasoning summary built from strategy_history counts.
  // Never shows raw keys; reads like a sentence.
  const reasoningSummary = (trace: TraceEntry): string | null => {
    const s = trace.strategy_history;
    if (!s) return null;
    const parts: string[] = [];
    if (s.facts_count) parts.push(`${s.facts_count} canonical fact${s.facts_count === 1 ? "" : "s"}`);
    if (s.decisions_count) parts.push(`${s.decisions_count} active decision${s.decisions_count === 1 ? "" : "s"}`);
    if (s.patterns_count) parts.push(`${s.patterns_count} behaviour pattern${s.patterns_count === 1 ? "" : "s"}`);
    if (s.recent_memories_count) parts.push(`${s.recent_memories_count} recent memories`);
    if (s.semantic_matches_count) parts.push(`${s.semantic_matches_count} semantic matches`);
    if (s.situations_count) parts.push(`${s.situations_count} active situation${s.situations_count === 1 ? "" : "s"}`);
    if (parts.length === 0) return null;
    const interventions = s.pattern_interventions?.length || 0;
    const base = `Assembled from ${parts.join(", ")}.`;
    return interventions > 0
      ? `${base} ${interventions} pattern intervention${interventions === 1 ? "" : "s"} fired.`
      : base;
  };

  if (loading) {
    return (
      <AppLayout>
        <TraceSkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <PageError
          title="Unable to load trace"
          message="We couldn't load your governance trace right now. Please try again."
          onRetry={load}
          error={loadError}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        className="px-4 max-w-[780px] mx-auto"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 0.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
        }}
      >
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
            <h1 className="text-[22px] font-medium text-foreground tracking-tight">Governance Trace</h1>
          </div>
          <p className="text-[14px] text-muted-foreground mt-1">Why Seven said what it said. Full transparency.</p>
        </motion.div>

        {traces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground max-w-[420px] mx-auto leading-relaxed">
              No traces yet. Chat with Seven and traces will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {traces.map((trace, i) => {
              const reasoning = reasoningSummary(trace);
              const sources = trace.strategy_history?.sources_used || [];
              const factsCount = trace.strategy_history?.facts_count || 0;
              const decisionsCount = trace.strategy_history?.decisions_count || 0;
              const memoriesCount = trace.picked_memory_ids?.length || trace.strategy_history?.recent_memories_count || 0;
              const interventionsCount = trace.strategy_history?.pattern_interventions?.length || 0;
              return (
                <motion.div
                  key={trace.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === trace.id ? null : trace.id)}
                    aria-expanded={expanded === trace.id}
                    aria-label={expanded === trace.id ? "Collapse trace details" : "Expand trace details"}
                    className="w-full flex items-start justify-between min-h-[44px] p-4 text-left"
                  >
                    <div className="flex-1 mr-3">
                      <p className="text-[14px] font-medium text-foreground leading-snug">
                        {cardTitle(trace)}
                      </p>
                      <span className="text-[11px] text-muted-foreground mt-1 block">{timeAgo(trace.created_at)}</span>
                    </div>
                    {expanded === trace.id ? (
                      <ChevronUp size={16} className="text-muted-foreground mt-1" aria-hidden="true" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground mt-1" aria-hidden="true" />
                    )}
                  </button>

                  {expanded === trace.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="px-4 pb-4 border-t border-border"
                    >
                      {reasoning && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed mt-3 mb-3">{reasoning}</p>
                      )}

                      {/* Context sources used */}
                      {sources.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">SOURCES USED</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sources.map((src, j) => (
                              <span key={j} className="px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground">
                                {src.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Context counts summary */}
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        {factsCount > 0 && (
                          <span>{factsCount} facts loaded</span>
                        )}
                        {decisionsCount > 0 && (
                          <span>{decisionsCount} decisions referenced</span>
                        )}
                        {memoriesCount > 0 && (
                          <span>{memoriesCount} memories matched</span>
                        )}
                        {interventionsCount > 0 && (
                          <span>{interventionsCount} patterns triggered</span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Trace;
