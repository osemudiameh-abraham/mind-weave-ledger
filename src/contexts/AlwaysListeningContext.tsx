import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import type { WakeWordService } from "@/services/wake-word/types";
import { MockWakeWordService } from "@/services/wake-word/MockWakeWordService";

interface AlwaysListeningState {
  /** Whether always-listening is enabled globally */
  enabled: boolean;
  /** Toggle always-listening on/off */
  setEnabled: (val: boolean) => void;
  /** Whether the mic is actively listening right now */
  isListening: boolean;
  /** The current wake word */
  wakeWord: string;
  /** Update the wake word */
  setWakeWord: (word: string) => void;
  /** Whether we're currently in a live session (suppresses wake word detection) */
  isInLiveSession: boolean;
  /** Mark that we entered/exited the live session */
  setIsInLiveSession: (val: boolean) => void;
}

const AlwaysListeningContext = createContext<AlwaysListeningState | null>(null);

export const useAlwaysListening = () => {
  const ctx = useContext(AlwaysListeningContext);
  if (!ctx) throw new Error("useAlwaysListening must be used within AlwaysListeningProvider");
  return ctx;
};

interface ProviderProps {
  children: ReactNode;
}

export const AlwaysListeningProvider = ({ children }: ProviderProps) => {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("seven_always_listening") === "true";
  });
  const [isListening, setIsListening] = useState(false);
  const [isInLiveSession, setIsInLiveSession] = useState(false);
  const [wakeWord, setWakeWordState] = useState(() => {
    return localStorage.getItem("seven_wake_word") || "Hey Seven";
  });

  const serviceRef = useRef<WakeWordService | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Persist preferences
  useEffect(() => {
    localStorage.setItem("seven_always_listening", String(enabled));
  }, [enabled]);

  const setWakeWord = useCallback((word: string) => {
    setWakeWordState(word);
    localStorage.setItem("seven_wake_word", word);
    serviceRef.current?.setWakeWord(word);
  }, []);

  // Handle wake word detection → navigate to Live
  const handleWakeWordDetected = useCallback((word: string) => {
    // Don't re-trigger if already in live session
    if (location.pathname === "/live") return;

    toast(`"${word}" detected — opening Live…`, { duration: 2000 });
    navigate("/live");
  }, [navigate, location.pathname]);

  // Start/stop wake word listening based on enabled state and live session
  useEffect(() => {
    // If disabled or already in a live session (Live page handles its own mic), stop
    if (!enabled || isInLiveSession) {
      if (serviceRef.current?.isListening()) {
        serviceRef.current.stopListening();
      }
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BACKEND SWAP POINT: Replace MockWakeWordService
    // with your real wake word engine here
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const service = new MockWakeWordService();
    service.setWakeWord(wakeWord);
    serviceRef.current = service;

    service.startListening({
      onWakeWordDetected: handleWakeWordDetected,
      onError: (err) => console.warn("[AlwaysListening]", err),
      onListeningChange: setIsListening,
    });

    return () => {
      service.stopListening();
      serviceRef.current = null;
    };
  }, [enabled, isInLiveSession, wakeWord, handleWakeWordDetected]);

  return (
    <AlwaysListeningContext.Provider
      value={{
        enabled,
        setEnabled,
        isListening,
        wakeWord,
        setWakeWord,
        isInLiveSession,
        setIsInLiveSession,
      }}
    >
      {children}
    </AlwaysListeningContext.Provider>
  );
};
