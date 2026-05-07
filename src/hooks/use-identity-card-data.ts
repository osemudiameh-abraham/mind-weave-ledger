import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Hook for the Identity Card panel on /memory (architecture v5.7 sec.10.13.1).
 *
 * Fetches the two sources of user identity in parallel:
 *
 *   identity_profiles -- declared identity (what the user told Seven directly:
 *     name, role, company, city, goals, focus areas)
 *
 *   identity_model    -- inferred identity (what Seven has learned from
 *     interaction: personality dimensions, core values, decision tendencies,
 *     communication style, strengths, blind spots, and the message-count the
 *     model is built from)
 *
 * The two are surfaced as separate sub-cards in the UI: "What you've told
 * Seven" (declared) and "What Seven has learned about you" (inferred). This
 * separation matters because the affordances differ -- declared identity is
 * edited by telling Seven in chat (no inline edit yet, sec.10.13 backlog);
 * inferred identity gets thumbs-up / thumbs-down feedback that writes to
 * feedback_signals.
 *
 * Both rows are unique on user_id and may not yet exist for new users. Empty
 * states render as "Seven hasn't characterised this yet" per the §10.13.1
 * spec -- absence of a field is itself information about what the substrate
 * is or isn't learning.
 */

export interface IdentityProfile {
  display_name: string | null;
  self_role: string | null;
  self_company: string | null;
  self_city: string | null;
  goals: string[];
  focus_areas: string[];
}

export interface IdentityModel {
  personality_dimensions: Record<string, unknown>;
  core_values: string[];
  decision_tendencies: Record<string, unknown>;
  communication_style: Record<string, unknown>;
  strengths: string[];
  blind_spots: string[];
  built_from_message_count: number;
  last_updated_at: string | null;
}

export interface UseIdentityCardDataResult {
  profile: IdentityProfile | null;
  model: IdentityModel | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /**
   * Submit a feedback_signals row for an identity_model field. Writes
   * are append-only; cron-identity-model consumes them on its next pass
   * and adjusts confidence in identity_model with drift-clamped semantics
   * per §3.13. UI optimistically reflects the click but does not mutate
   * identity_model directly -- the substrate update is asynchronous by
   * design (substrate measures itself, doesn't react reflexively).
   */
  submitFieldFeedback: (
    field: string,
    kind: "identity_correct" | "identity_misframed",
    contextValue?: unknown,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function useIdentityCardData(): UseIdentityCardDataResult {
  const [profile, setProfile] = useState<IdentityProfile | null>(null);
  const [model, setModel] = useState<IdentityModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not signed in");

      // Parallel fetch. Both queries are own-row-only via RLS, both return
      // a maxOf one row (unique on user_id). maybeSingle() returns null on
      // absence rather than throwing -- which is correct here, because
      // absence is a valid state we render explicitly.
      const [profileRes, modelRes] = await Promise.all([
        supabase
          .from("identity_profiles")
          .select("display_name, self_role, self_company, self_city, goals, focus_areas")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("identity_model")
          .select(
            "personality_dimensions, core_values, decision_tendencies, communication_style, strengths, blind_spots, built_from_message_count, last_updated_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileRes.error) throw new Error(`Profile fetch: ${profileRes.error.message}`);
      if (modelRes.error) throw new Error(`Model fetch: ${modelRes.error.message}`);

      setProfile(
        profileRes.data
          ? {
              display_name: profileRes.data.display_name ?? null,
              self_role: profileRes.data.self_role ?? null,
              self_company: profileRes.data.self_company ?? null,
              self_city: profileRes.data.self_city ?? null,
              goals: profileRes.data.goals ?? [],
              focus_areas: profileRes.data.focus_areas ?? [],
            }
          : null,
      );

      setModel(
        modelRes.data
          ? {
              personality_dimensions: (modelRes.data.personality_dimensions as Record<string, unknown>) ?? {},
              core_values: modelRes.data.core_values ?? [],
              decision_tendencies: (modelRes.data.decision_tendencies as Record<string, unknown>) ?? {},
              communication_style: (modelRes.data.communication_style as Record<string, unknown>) ?? {},
              strengths: modelRes.data.strengths ?? [],
              blind_spots: modelRes.data.blind_spots ?? [],
              built_from_message_count: modelRes.data.built_from_message_count ?? 0,
              last_updated_at: modelRes.data.last_updated_at ?? null,
            }
          : null,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load identity";
      console.error("[useIdentityCardData]", msg, err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const submitFieldFeedback = useCallback(
    async (
      field: string,
      kind: "identity_correct" | "identity_misframed",
      contextValue?: unknown,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { ok: false, error: "Not signed in" };

        // The feedback_signals table is shared infrastructure created by Phase
        // 0.C Stage 1 (PR #28 era) for per-message thumbs up/down. We reuse it
        // for identity-model field feedback by mapping the internal feedback
        // kind ('identity_correct' -> 'positive', 'identity_misframed' ->
        // 'negative') and tagging the row with surface='memory_identity_card'.
        // This preserves the table's original design where signal is direction
        // and surface is source. cron-identity-model filters by surface to
        // find identity-card feedback rows. The original 'kind' name is kept
        // in response_metadata.intent so future analytics can distinguish a
        // thumbs-down on a chat message from a thumbs-down on an identity
        // field even though both have signal='negative'.
        const signalDirection: "positive" | "negative" =
          kind === "identity_correct" ? "positive" : "negative";

        const { error: insertError } = await supabase.from("feedback_signals").insert({
          user_id: user.id,
          signal: signalDirection,
          surface: "memory_identity_card",
          response_metadata: { target_field: field, intent: kind },
          context_at_time: contextValue !== undefined ? { value: contextValue } : {},
        });

        if (insertError) {
          console.error("[useIdentityCardData] feedback insert failed:", insertError);
          return { ok: false, error: insertError.message };
        }
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Feedback failed";
        console.error("[useIdentityCardData] feedback exception:", msg, err);
        return { ok: false, error: msg };
      }
    },
    [],
  );

  return {
    profile,
    model,
    loading,
    error,
    refetch: fetchAll,
    submitFieldFeedback,
  };
}
