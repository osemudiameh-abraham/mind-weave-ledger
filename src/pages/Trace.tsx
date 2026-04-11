import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface TraceEntry {
  id: string;
  action_description: string;
  reasoning: string | null;
  sources: string[];
  created_at: string;
}

const Trace = () => {
  const { user } = useAuth();
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("memory_traces")
        .select("id, action_description, reasoning, sources, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) setTraces(data);
      setLoading(false);
    };
    load();
  }, [user]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-primary" />
            <h1 className="text-[22px] font-medium text-foreground tracking-tight">
              Governance Trace
            </h1>
          </div>
          <p className="text-[14px] text-muted-foreground mt-1">
            Why Seven said what it said. Full transparency.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : traces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground">No traces yet. Chat with Seven and traces will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {traces.map((trace, i) => (
              <motion.div
                key={trace.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === trace.id ? null : trace.id)}
                  className="w-full flex items-start justify-between p-4 text-left"
                >
                  <div className="flex-1 mr-3">
                    <p className="text-[14px] font-medium text-foreground leading-snug">
                      {trace.action_description}
                    </p>
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      {timeAgo(trace.created_at)}
                    </span>
                  </div>
                  {expanded === trace.id ? (
                    <ChevronUp size={16} className="text-muted-foreground mt-1" />
                  ) : (
                    <ChevronDown size={16} className="text-muted-foreground mt-1" />
                  )}
                </button>

                {expanded === trace.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-4 pb-4 border-t border-border"
                  >
                    {trace.reasoning && (
                      <p className="text-[13px] text-muted-foreground leading-relaxed mt-3 mb-3">
                        {trace.reasoning}
                      </p>
                    )}
                    {trace.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {trace.sources.map((src, j) => (
                          <span
                            key={j}
                            className="px-2.5 py-1 rounded-full bg-muted text-[11px] text-muted-foreground"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Trace;
