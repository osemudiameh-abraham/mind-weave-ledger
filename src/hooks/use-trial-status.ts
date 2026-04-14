import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const TRIAL_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // Beta: 1 year (effectively unlimited)
const POPUP_KEY = "seven_trial_popup_shown"; // UI-only — safe in localStorage

interface TrialState {
  loading: boolean;
  status: "trial" | "active" | "past_due" | "cancelled" | "expired" | null;
  trialStartedAt: Date | null;
  trialExpiresAt: Date | null;
  popupShown: boolean;
}

export function useTrialStatus() {
  const { user } = useAuth();
  const [state, setState] = useState<TrialState>({
    loading: true,
    status: null,
    trialStartedAt: null,
    trialExpiresAt: null,
    popupShown: localStorage.getItem(POPUP_KEY) === "true",
  });

  // Load subscription state from Supabase
  useEffect(() => {
    if (!user) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, plan, trial_started_at, trial_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[TRIAL] Failed to load subscription:", error.message);
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      if (data) {
        // Subscription row exists — read state from it
        setState((prev) => ({
          ...prev,
          loading: false,
          status: data.status,
          trialStartedAt: data.trial_started_at ? new Date(data.trial_started_at) : null,
          trialExpiresAt: data.trial_expires_at ? new Date(data.trial_expires_at) : null,
        }));
      } else {
        // No subscription row — user hasn't started trial yet
        setState((prev) => ({
          ...prev,
          loading: false,
          status: null,
          trialStartedAt: null,
          trialExpiresAt: null,
        }));
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  const isTrialActive =
    state.status === "trial" &&
    state.trialExpiresAt !== null &&
    new Date() < state.trialExpiresAt;

  const isTrialExpired =
    state.status === "trial" &&
    state.trialExpiresAt !== null &&
    new Date() >= state.trialExpiresAt;

  // Active paid subscription
  const isSubscriptionActive = state.status === "active";

  // Can the user use the product (trial or paid)
  const hasAccess = isTrialActive || isSubscriptionActive;

  const daysRemaining =
    state.trialExpiresAt
      ? Math.max(0, Math.ceil((state.trialExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

  const shouldShowPopup = !state.popupShown && state.status === null && !state.loading;

  const startTrial = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const expires = new Date(now.getTime() + TRIAL_DURATION_MS);

    const { error } = await supabase.from("subscriptions").upsert({
      user_id: user.id,
      status: "trial",
      plan: "trial",
      trial_started_at: now.toISOString(),
      trial_expires_at: expires.toISOString(),
    });

    if (error) {
      console.error("[TRIAL] Failed to start trial:", error.message);
      return;
    }

    localStorage.setItem(POPUP_KEY, "true");

    setState((prev) => ({
      ...prev,
      status: "trial",
      trialStartedAt: now,
      trialExpiresAt: expires,
      popupShown: true,
    }));
  }, [user]);

  const markPopupShown = useCallback(() => {
    localStorage.setItem(POPUP_KEY, "true");
    setState((prev) => ({ ...prev, popupShown: true }));
  }, []);

  return {
    loading: state.loading,
    shouldShowPopup,
    isTrialActive,
    isTrialExpired,
    isSubscriptionActive,
    hasAccess,
    daysRemaining,
    trialStartedAt: state.trialStartedAt,
    trialExpiresAt: state.trialExpiresAt,
    status: state.status,
    markPopupShown,
    startTrial,
  };
}
