import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AlwaysListeningState {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  isListening: boolean;
  wakeWord: string;
  setWakeWord: (word: string) => void;
  isInLiveSession: boolean;
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

/**
 * Always Listening — PHASE 4 FEATURE
 * 
 * This context provides the interface for wake-word detection.
 * Currently DISABLED — no microphone access is requested, no audio is captured.
 * The mic is NEVER activated without explicit user action.
 * 
 * Phase 4 will implement:
 * - Picovoice Porcupine WASM wake word detection (runs locally, no server)
 * - Explicit user opt-in required via Settings toggle
 * - No mic popup on page load — ever
 * - Full App Store / Play Store compliance
 */
export const AlwaysListeningProvider = ({ children }: ProviderProps) => {
  const [enabled, setEnabled] = useState(false);
  const [isListening] = useState(false);
  const [isInLiveSession, setIsInLiveSession] = useState(false);
  const [wakeWord, setWakeWordState] = useState("Hey Seven");

  const setWakeWord = useCallback((word: string) => {
    setWakeWordState(word);
    localStorage.setItem("seven_wake_word", word);
  }, []);

  // NO mic access. NO getUserMedia. NO startListening.
  // This is intentional. Phase 4 will wire real wake word detection
  // with explicit user consent only.

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
