/**
 * Wake Word Detection Service Types
 *
 * Defines the contract for wake word detection backends.
 * Swap MockWakeWordService with a real implementation when connecting
 * your backend (e.g., Porcupine, Snowboy, or custom model).
 *
 * Graceful-degrade contract (Phase 0.B Stages B3.1 + B3.7):
 *
 *   When the underlying service cannot start due to a categorisable
 *   problem the user cannot recover from in-page (typically expired
 *   credentials, denied microphone, model fetch failure, or an
 *   uncategorisable native runtime error), it surfaces ONE of the
 *   four sentinel strings below via `onError`. The provider uses
 *   sentinel-equality to suppress retry loops in the current session
 *   and to render an actionable user-facing message in Settings.
 *
 *   The four sentinels are mutually exclusive — every error
 *   categorisable by classifyError() returns exactly one of them.
 *
 *   The provider treats ALL FOUR as latching errors: any of them
 *   stops the retry loop until the user toggles Always Listening
 *   off. This prevents toast spam when an error fires on every
 *   render attempt.
 *
 *   Manual microphone control remains fully available regardless of
 *   wake-word state — it is the default path. Wake word is opt-in
 *   acceleration; never required.
 */

/**
 * Picovoice access key is missing, invalid, or expired. The user
 * cannot recover from this in-page; the operator must rotate the key.
 *
 * Shipped: B3.1 (Apr 24).
 */
export const WAKE_WORD_UNAVAILABLE_MESSAGE =
  "Wake word is unavailable right now. You can still tap the microphone to talk to Seven.";

/**
 * Browser denied microphone access — either the user dismissed the
 * permission prompt, the site is loaded from a non-secure context
 * (e.g., HTTP), or a getUserMedia call fired without a user gesture.
 * The user CAN recover from this by changing browser permissions.
 *
 * Shipped: B3.7 (Apr 26).
 */
export const WAKE_WORD_MIC_DENIED_MESSAGE =
  "Microphone access is needed for wake word. Allow microphone access in your browser settings, then toggle Always Listening again.";

/**
 * Picovoice keyword (.ppn) or model (.pv) file failed to fetch — most
 * commonly a CDN issue, the user is offline, or a corporate firewall
 * is blocking the asset path. The user CAN recover by reconnecting
 * and retrying.
 *
 * Shipped: B3.7 (Apr 26).
 */
export const WAKE_WORD_MODEL_FAILED_MESSAGE =
  "Wake word couldn't load. Check your connection and toggle Always Listening again.";

/**
 * Picovoice SDK threw a non-auth, non-permission, non-network runtime
 * error — typically delivered as opaque hex-format stack frames like
 * `[0] d3ff828 00000136: e390eff`. We do not surface the raw frames
 * to users (it's confusing and leaks implementation detail). Instead
 * we present a generic "ran into a problem" message with the same
 * actionable next-step as auth-expired: tap the mic.
 *
 * This is the LAST-RESORT category for classifyError. If any future
 * Picovoice error type is recoverable in-page, it should get its own
 * sentinel and be matched BEFORE this one.
 *
 * Shipped: B3.7 (Apr 26).
 */
export const WAKE_WORD_UNKNOWN_ERROR_MESSAGE =
  "Wake word ran into a problem starting up. You can still tap the microphone to talk to Seven.";

/**
 * Returns true iff the given string is one of the four wake-word
 * sentinel constants. Used by AlwaysListeningContext to decide
 * whether to latch the retry-loop guard.
 */
export function isWakeWordSentinel(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message === WAKE_WORD_UNAVAILABLE_MESSAGE ||
    message === WAKE_WORD_MIC_DENIED_MESSAGE ||
    message === WAKE_WORD_MODEL_FAILED_MESSAGE ||
    message === WAKE_WORD_UNKNOWN_ERROR_MESSAGE
  );
}

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
