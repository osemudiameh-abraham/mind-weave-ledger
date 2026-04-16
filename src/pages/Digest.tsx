import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, CheckCircle2, Brain } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import SevenLogo from "@/components/SevenLogo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageError } from "@/components/PageError";
import { DigestSkeleton } from "@/components/PageSkeletons";

const Digest = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [stats, setStats] = useState({ facts: 0, decisions: 0, patterns: 0, memories: 0 });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const [factsRes, decisionsRes, patternsRes, memoriesRes] = await Promise.all([
        supabase.from("memory_facts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", weekAgo),
        supabase.from("decisions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", weekAgo),
        supabase.from("behaviour_patterns").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", weekAgo),
        supabase.from("memories_structured").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", weekAgo),
      ]);

      // Any network error on any counter -> show the error state.
      const firstError = factsRes.error || decisionsRes.error || patternsRes.error || memoriesRes.error;
      if (firstError) {
        setLoadError(firstError);
        setLoading(false);
        return;
      }

      setStats({
        facts: factsRes.count || 0,
        decisions: decisionsRes.count || 0,
        patterns: patternsRes.count || 0,
        memories: memoriesRes.count || 0,
      });
      setLoading(false);
    } catch (err) {
      setLoadError(err as Error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  const weekEnd = new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <AppLayout>
        <DigestSkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <PageError
          title="Unable to load digest"
          message="We couldn't load your weekly digest right now. Please try again."
          onRetry={load}
          error={loadError}
        />
      </AppLayout>
    );
  }

  const totalActivity = stats.facts + stats.decisions + stats.patterns + stats.memories;

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
          <p className="text-[12px] font-medium text-primary mb-1">WEEKLY DIGEST</p>
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">{weekStart} – {weekEnd}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Here's what Seven observed this week</p>
        </motion.div>

        {totalActivity === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground max-w-[460px] mx-auto leading-relaxed">
              Your first weekly digest will appear after Seven has been learning about you for a few days.
            </p>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <SevenLogo size={18} />
                <span className="text-[13px] font-medium text-foreground">Seven's Summary</span>
              </div>
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                {stats.memories > 0
                  ? `This week you shared ${stats.memories} thoughts with Seven. ${stats.facts > 0 ? `I learned ${stats.facts} new facts about you. ` : ""}${stats.decisions > 0 ? `You made ${stats.decisions} tracked decisions. ` : ""}${stats.patterns > 0 ? `I detected ${stats.patterns} behavioural patterns.` : ""}`
                  : `This week I learned ${stats.facts} new facts, tracked ${stats.decisions} decisions, and detected ${stats.patterns} behavioural patterns.`}
              </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Facts learned", value: stats.facts, icon: CheckCircle2, color: "text-green-500" },
                { label: "Decisions tracked", value: stats.decisions, icon: TrendingUp, color: "text-primary" },
                { label: "Patterns found", value: stats.patterns, icon: Brain, color: "text-purple-500" },
                { label: "Memories stored", value: stats.memories, icon: CheckCircle2, color: "text-blue-400" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-4"
                >
                  <stat.icon size={16} className={stat.color + " mb-2"} aria-hidden="true" />
                  <p className="text-[20px] font-medium text-foreground">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Digest;
