import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PageError } from "@/components/PageError";
import { ReviewsSkeleton } from "@/components/PageSkeletons";

interface Decision {
  id: string;
  text_snapshot: string | null;
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
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("decisions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setLoadError(error);
      setLoading(false);
      return;
    }
    if (data) setDecisions(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  // Generate a deterministic UUID from a string. Required because the
  // outcomes.idempotency_key column is type uuid; a raw string like
  // "<decision-id>-<timestamp>" is rejected by PostgREST. Same pattern
  // used server-side in supabase/functions/chat/index.ts.
  const deterministicUuid = async (input: string): Promise<string> => {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  };

  const submitOutcome = async (decisionId: string, outcome: "worked" | "failed" | "mixed") => {
    if (!user) return;
    setSubmitting(decisionId);

    // One-per-day-per-decision idempotency: same decision+day produces the
    // same uuid, so accidental double-taps won't create duplicate outcome rows.
    const dayKey = new Date().toISOString().slice(0, 10);
    const idempKey = await deterministicUuid(`${decisionId}_${dayKey}`);

    const outcomeLabelText: Record<typeof outcome, string> = {
      worked: "Self-reported: good call",
      mixed: "Self-reported: mixed result",
      failed: "Self-reported: didn't work",
    };

    const { error } = await supabase.from("outcomes").insert({
      user_id: user.id,
      decision_id: decisionId,
      outcome_label: outcome,
      text_snapshot: outcomeLabelText[outcome],
      idempotency_key: idempKey,
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
      // Duplicate outcome for the same decision on the same day is expected
      // and should surface as a friendly message, not a scary error.
      const msg = error.message || "";
      if (msg.toLowerCase().includes("duplicate") || msg.includes("23505")) {
        toast("Already recorded today", { description: "You've already logged this one." });
      } else {
        console.error("[OUTCOME_SUBMIT] Failed:", error);
        toast.error("Failed to record outcome");
      }
    }
    setSubmitting(null);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <AppLayout>
        <ReviewsSkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <PageError
          title="Unable to load reviews"
          message="We couldn't load your decisions right now. Please try again."
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

        {decisions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground max-w-[420px] mx-auto leading-relaxed">
              No decisions to review right now. When you make decisions, Seven will track them and prompt you for outcomes.
            </p>
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
                    {d.text_snapshot || d.context_summary || "Untitled decision"}
                  </h3>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDate(d.created_at)}
                  </span>
                </div>
                {d.context_summary && d.context_summary !== d.text_snapshot && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                    {d.context_summary}
                  </p>
                )}

                {d.status === "active" || d.status === "pending_review" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting === d.id}
                      onClick={() => submitOutcome(d.id, "worked")}
                      aria-label="Mark as good call"
                      className="flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <ThumbsUp size={14} className="text-primary" aria-hidden="true" /> Good call
                    </button>
                    <button
                      type="button"
                      disabled={submitting === d.id}
                      onClick={() => submitOutcome(d.id, "mixed")}
                      aria-label="Mark as mixed outcome"
                      className="flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Minus size={14} aria-hidden="true" /> Mixed
                    </button>
                    <button
                      type="button"
                      disabled={submitting === d.id}
                      onClick={() => submitOutcome(d.id, "failed")}
                      aria-label="Mark as didn't work"
                      className="flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown size={14} className="text-destructive" aria-hidden="true" /> Didn't work
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-primary/10 text-primary">
                    <ThumbsUp size={14} aria-hidden="true" /> Reviewed ({d.outcome_count})
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
