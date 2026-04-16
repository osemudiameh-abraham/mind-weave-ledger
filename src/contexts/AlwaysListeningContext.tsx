import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  WakeWordService,
  WakeWordServiceConfig,
} from "@/services/wake-word/types";

/**
 * AlwaysListeningContext
 *
 * Owns the wake-word detection lifecycle for the entire app.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.5, Section 4.4.
 *   - Wake word runs locally via Picovoice Porcupine WASM in a Web Worker.
 *   - Microphone is ONLY requested after the user explicitly enables Always
 *     Listening in Settings. Never on page load.
 *   - Paused automatically while Live voice mode owns the microphone
 *     (setIsInLiveSession(true)) and resumed when Live ends.
 *
 * Bundle budget: the Porcupine service module (+ SDK) is dynamically imported
 * at enable time so the ~3.5MB WASM bundle never lands in the main chunk.
 *
 * Detection signalling: `lastDetectionAt` is a monotonically increasing
 * timestamp. Consumers (WakeWordNavigator) subscribe by effect and handle
 * each new detection exactly once.
 *
 * Error model: `error` carries a user-presentable string when initialisation
 * fails (invalid key, missing model, denied microphone). Settings.tsx renders
 * this directly; clearing the toggle clears the error.
 */

export interface AlwaysListeningState {
  /** User-facing toggle. True = service should be running (subject to Live pause). */
  enabled: boolean;
  setEnabled: (val: boolean) => void;

  /** True only while the underlying Porcupine worker is actively listening. */
  isListening: boolean;

  /** Active wake word label (e.g. "Hey Seven" or fallback "Computer"). */
  wakeWord: string;
  setWakeWord: (word: string) => void;

  /** Live voice session flag — used to pause wake word while the mic is in use. */
  isInLiveSession: boolean;
  setIsInLiveSession: (val: boolean) => void;

  /** Monotonically increasing timestamp of the most recent wake word detection.
   *  `null` when no detection has fired yet. */
  lastDetectionAt: number | null;

  /** User-presentable error from the wake word service. Null when healthy. */
  error: string | null;

  /** True if the service fell back to the built-in "Computer" keyword. */
  usingFallback: boolean;
}

const AlwaysListeningContext = createContext<AlwaysListeningState | null>(null);

export const useAlwaysListening = () => {
  const ctx = useContext(AlwaysListeningContext);
  if (!ctx)
    throw new Error(
      "useAlwaysListening must be used within AlwaysListeningProvider"
    );
  return ctx;
};

interface ProviderProps {
  children: ReactNode;
}

const WAKE_WORD_STORAGE_KEY = "seven_wake_word";
const ENABLED_STORAGE_KEY = "seven_always_listening_enabled";

export const AlwaysListeningProvider = ({ children }: ProviderProps) => {
  // Initial enabled state: restore from localStorage so the preference survives
  // reloads. Note: even when true, the mic is NOT requested until the service
  // is actually constructed, which happens inside the effect below.
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ENABLED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isListening, setIsListening] = useState(false);
  const [isInLiveSession, setIsInLiveSession] = useState(false);
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const [wakeWord, setWakeWordState] = useState<string>(() => {
    try {
      return localStorage.getItem(WAKE_WORD_STORAGE_KEY) || "Hey Seven";
    } catch {
      return "Hey Seven";
    }
  });

  // The active service instance. Held in a ref so the lifecycle effect can
  // tear it down without re-renders racing with creation.
  const serviceRef = useRef<WakeWordService | null>(null);
  // Tracks whether we're mid-startup to avoid duplicate starts when React
  // Strict Mode double-invokes effects in dev.
  const startingRef = useRef(false);

  const setWakeWord = useCallback((word: string) => {
    setWakeWordState(word);
    try {
      localStorage.setItem(WAKE_WORD_STORAGE_KEY, word);
    } catch {
      /* ignore storage quota */
    }
  }, []);

  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
    try {
      localStorage.setItem(ENABLED_STORAGE_KEY, String(val));
    } catch {
      /* ignore storage quota */
    }
    // Clear any prior error when the user toggles state — they're starting over.
    if (!val) setError(null);
  }, []);

  // ─── Lifecycle: start/stop the wake word service in response to state ───
  useEffect(() => {
    // Wake word should only run when:
    //   (a) user has explicitly enabled it, AND
    //   (b) Live voice session is NOT currently holding the microphone.
    const shouldRun = enabled && !isInLiveSession;

    if (shouldRun) {
      if (serviceRef.current || startingRef.current) return;
      startingRef.current = true;
      let cancelled = false;

      (async () => {
        try {
          // Dynamic import: keeps Porcupine out of the main bundle until the
          // user actually opts in.
          const mod = await import(
            "@/services/wake-word/PorcupineWakeWordService"
          );
          if (cancelled) return;

          const service = new mod.PorcupineWakeWordService();
          const config: WakeWordServiceConfig = {
            onWakeWordDetected: (word) => {
              // Monotonic timestamp ensures React sees a new value every time,
              // even if detections land within the same millisecond.
              setLastDetectionAt((prev) => {
                const now = Date.now();
                return prev !== null && now <= prev ? prev + 1 : now;
              });
              // Keep wakeWord in sync with the actually-detected label — useful
              // when running with the "Computer" fallback.
              if (word && word !== wakeWord) {
                setWakeWordState(word);
              }
            },
            onError: (msg) => {
              setError(msg);
              setIsListening(false);
            },
            onListeningChange: (listening) => {
              setIsListening(listening);
              if (listening) {
                setError(null);
                setUsingFallback(service.isUsingFallbackKeyword());
              }
            },
          };

          await service.startListening(config);
          if (cancelled) {
            service.stopListening();
            return;
          }
          serviceRef.current = service;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            "[AlwaysListeningContext] Failed to load wake word service:",
            err
          );
          if (!cancelled) {
            setError(
              "Wake word service failed to load. Please check your connection and try again."
            );
          }
        } finally {
          startingRef.current = false;
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    // Otherwise: tear down any running service.
    if (serviceRef.current) {
      serviceRef.current.stopListening();
      serviceRef.current = null;
      setIsListening(false);
      setUsingFallback(false);
    }
    return undefined;
  }, [enabled, isInLiveSession, wakeWord]);

  // Final unmount cleanup — if the provider itself is torn down, kill the mic.
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stopListening();
        serviceRef.current = null;
      }
    };
  }, []);

  const value = useMemo<AlwaysListeningState>(
    () => ({
      enabled,
      setEnabled,
      isListening,
      wakeWord,
      setWakeWord,
      isInLiveSession,
      setIsInLiveSession,
      lastDetectionAt,
      error,
      usingFallback,
    }),
    [
      enabled,
      setEnabled,
      isListening,
      wakeWord,
      setWakeWord,
      isInLiveSession,
      lastDetectionAt,
      error,
      usingFallback,
    ]
  );

  return (
    <AlwaysListeningContext.Provider value={value}>
      {children}
    </AlwaysListeningContext.Provider>
  );
};
