/**
 * Wake Word Detection Service Types
 * 
 * Defines the contract for wake word detection backends.
 * Swap MockWakeWordService with a real implementation when connecting
 * your backend (e.g., Porcupine, Snowboy, or custom model).
 */

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
