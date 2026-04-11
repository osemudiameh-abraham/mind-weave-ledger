import { useState, useEffect, useCallback } from "react";

const TRIAL_KEY = "seven_trial";
const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface TrialData {
  popupShown: boolean;
  trialStartedAt: string | null;
}

function getTrialData(): TrialData {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { popupShown: false, trialStartedAt: null };
}

function saveTrialData(data: TrialData) {
  localStorage.setItem(TRIAL_KEY, JSON.stringify(data));
}

export function useTrialStatus() {
  const [data, setData] = useState<TrialData>(getTrialData);

  const popupShown = data.popupShown;
  const trialStartedAt = data.trialStartedAt ? new Date(data.trialStartedAt) : null;

  const isTrialActive = !!trialStartedAt && Date.now() - trialStartedAt.getTime() < TRIAL_DURATION_MS;
  const isTrialExpired = !!trialStartedAt && !isTrialActive;

  const daysRemaining = trialStartedAt
    ? Math.max(0, Math.ceil((trialStartedAt.getTime() + TRIAL_DURATION_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const shouldShowPopup = !popupShown && !trialStartedAt;

  const markPopupShown = useCallback(() => {
    setData((prev) => {
      // If trial hasn't started yet, start it when popup is dismissed
      const updated: TrialData = {
        ...prev,
        popupShown: true,
        trialStartedAt: prev.trialStartedAt || new Date().toISOString(),
      };
      saveTrialData(updated);
      return updated;
    });
  }, []);

  const startTrial = useCallback(() => {
    setData((prev) => {
      const updated: TrialData = {
        popupShown: true,
        trialStartedAt: prev.trialStartedAt || new Date().toISOString(),
      };
      saveTrialData(updated);
      return updated;
    });
  }, []);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TRIAL_KEY) setData(getTrialData());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return {
    shouldShowPopup,
    isTrialActive,
    isTrialExpired,
    daysRemaining,
    trialStartedAt,
    markPopupShown,
    startTrial,
  };
}
