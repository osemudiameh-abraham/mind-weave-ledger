/**
 * Wake Word Detection Service Types
 *
 * Defines the contract for wake word detection backends.
 * Swap MockWakeWordService with a real implementation when connecting
 * your backend (e.g., Porcupine, Snowboy, or custom model).
 *
 * Graceful-degrade contract (Phase 0.B Stage B3.1, Apr 23 2026):
 *   When the underlying service cannot start due to a configuration
 *   problem the user cannot fix in-browser (typically an expired or
 *   missing Picovoice access key), it surfaces
 *   WAKE_WORD_UNAVAILABLE_MESSAGE via `onError`. The provider uses this
 *   exact string as a signal to stop retrying in the current session —
 *   retries cannot recover. Manual microphone control remains fully
 *   available throughout.
 */

/**
 * Stable sentinel returned via `onError` when the wake word service is
 * non-retriably unavailable (expired/missing access key, etc.).
 *
 * Consumed by AlwaysListeningContext to suppress retry loops across
 * re-renders. MUST match exactly across service and context — the
 * context compares string equality.
 */
export const WAKE_WORD_UNAVAILABLE_MESSAGE =
  "Wake word is unavailable right now. You can still tap the microphone to talk to Seven.";

export interface WakeWordServiceConfig {
  /** Called when the wake word is detected */
  onWakeWordDetected: (word: string) => void;
  /** Called on errors */
  onError: (error: string) => void;
  /** Called when listening state changes */
  onListeningChange: (listening: boolean) => void;
}

export interface WakeWordService {
  /** Start listening for wake words */
  startListening(config: WakeWordServiceConfig): Promise<void>;
  /** Stop listening */
  stopListening(): void;
  /** Whether currently listening */
  isListening(): boolean;
  /** Set the active wake word/phrase */
  setWakeWord(word: string): void;
  /** Get the current wake word */
  getWakeWord(): string;
}
