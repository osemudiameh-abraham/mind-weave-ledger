import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, TrendingUp, Shield, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const Memory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [stats, setStats] = useState({ followThrough: 0, patternAwareness: 0, decisionQuality: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      const [decRes, patRes, factRes, outcomeRes] = await Promise.all([
        supabase.from("decisions").select("title, status, created_at, outcome_count").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("behaviour_patterns").select("description, confidence, evidence_count, created_at").eq("user_id", user.id).order("confidence", { ascending: false }).limit(10),
        supabase.from("memory_facts").select("subject, attribute, value, source_type, created_at, confidence").eq("user_id", user.id).is("valid_until", null).order("created_at", { ascending: false }).limit(10),
        supabase.from("outcomes").select("outcome_label").eq("user_id", user.id),
      ]);

      setDecisions(decRes.data || []);
      setPatterns(patRes.data || []);
      setFacts(factRes.data || []);

      // Calculate stats
      const outcomes = outcomeRes.data || [];
      const worked = outcomes.filter((o) => o.outcome_label === "worked").length;
      const total = outcomes.length;
      setStats({
        followThrough: total > 0 ? Math.round((worked / total) * 100) : 0,
        patternAwareness: Math.min(100, (patRes.data?.length || 0) * 15),
        decisionQuality: total > 0 ? Math.round((worked / total) * 100) : 0,
      });

      setLoading(false);
    };
    load();
  }, [user]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Memory & Identity</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Your cognitive profile as Seven understands it</p>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Follow-through", value: stats.followThrough },
            { label: "Pattern awareness", value: stats.patternAwareness },
            { label: "Decision quality", value: stats.decisionQuality },
          ].map((m) => (
            <div key={m.label} className="bg-card border border-border rounded-2xl p-3 text-center">
              <p className="text-[20px] font-medium text-primary">{m.value}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Decisions */}
        {decisions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[15px] font-medium text-foreground mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> Recent Decisions
            </h2>
            <div className="flex flex-col gap-2">
              {decisions.map((d, i) => (
                <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  {d.status === "reviewed" ? <CheckCircle size={16} className="text-green-500" /> : <Clock size={16} className="text-yellow-500" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground truncate">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(d.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patterns */}
        {patterns.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[15px] font-medium text-foreground mb-3 flex items-center gap-2">
              <Shield size={16} className="text-purple-500" /> Detected Patterns
            </h2>
            <div className="flex flex-col gap-2">
              {patterns.map((p, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-[13px] text-foreground">{p.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-muted-foreground">Confidence: {Math.round(p.confidence * 100)}%</span>
                    <span className="text-[11px] text-muted-foreground">Evidence: {p.evidence_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Facts */}
        {facts.length > 0 && (
          <div>
            <h2 className="text-[15px] font-medium text-foreground mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" /> Known Facts
            </h2>
            <div className="flex flex-col gap-2">
              {facts.map((f, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-[13px] text-foreground">{f.subject}: {f.attribute} — {f.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{f.source_type} · {formatDate(f.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {decisions.length === 0 && patterns.length === 0 && facts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground">Start chatting with Seven to build your cognitive profile.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Memory;
