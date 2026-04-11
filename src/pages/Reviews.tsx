import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Minus, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Decision {
  id: string;
  title: string;
  context_summary: string | null;
  confidence: string;
  status: string;
  review_due_at: string | null;
  outcome_count: number;
  created_at: string;
}

const Reviews = () => {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("decisions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setDecisions(data);
      setLoading(false);
    };
    load();
  }, [user]);

  const submitOutcome = async (decisionId: string, outcome: "worked" | "failed" | "mixed") => {
    if (!user) return;
    setSubmitting(decisionId);

    const { error } = await supabase.from("outcomes").insert({
      user_id: user.id,
      decision_id: decisionId,
      outcome_label: outcome,
      idempotency_key: `${decisionId}-${Date.now()}`,
    });

    if (!error) {
      // Update local state
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === decisionId
            ? { ...d, status: "reviewed", outcome_count: d.outcome_count + 1 }
            : d
        )
      );
      toast.success("Outcome recorded");
    } else {
      toast.error("Failed to record outcome");
    }
    setSubmitting(null);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", { month: "short", day: "numeric" });

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">
            Decision Reviews
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Reflect on past decisions. How did they turn out?
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : decisions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground">No decisions tracked yet. Tell Seven about a decision you've made.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {decisions.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-[15px] font-medium text-foreground leading-snug flex-1 mr-3">
                    {d.title}
                  </h3>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDate(d.created_at)}
                  </span>
                </div>
                {d.context_summary && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                    {d.context_summary}
                  </p>
                )}

                {d.status === "active" || d.status === "pending_review" ? (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={submitting === d.id}
                      onClick={() => submitOutcome(d.id, "worked")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <ThumbsUp size={14} className="text-primary" /> Good call
                    </button>
                    <button
                      disabled={submitting === d.id}
                      onClick={() => submitOutcome(d.id, "mixed")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Minus size={14} /> Mixed
                    </button>
                    <button
                      disabled={submitting === d.id}
                      onClick={() => submitOutcome(d.id, "failed")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown size={14} className="text-destructive" /> Didn't work
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-primary/10 text-primary">
                    <ThumbsUp size={14} /> Reviewed ({d.outcome_count})
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Reviews;
