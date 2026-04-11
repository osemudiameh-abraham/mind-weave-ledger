/**
 * Live Session Service Types
 * 
 * This module defines the contract for the Live AI backend.
 * Swap MockLiveService with a real implementation when connecting
 * your backend (e.g., WebSocket to your server, Gemini Multimodal Live API, etc.)
 */

export interface LiveMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: number;
  /** Optional base64 frame that was analyzed */
  frameSnapshot?: string;
}

export interface LiveServiceConfig {
  /** Called when AI produces a text response */
  onMessage: (message: LiveMessage) => void;
  /** Called when AI starts/stops "speaking" */
  onSpeakingChange: (speaking: boolean) => void;
  /** Called on errors */
  onError: (error: string) => void;
  /** Called when session status changes */
  onStatusChange: (status: LiveSessionStatus) => void;
}

export type LiveSessionStatus = "idle" | "connecting" | "connected" | "error";

export interface LiveService {
  /** Initialize the service and open connections */
  connect(config: LiveServiceConfig): Promise<void>;
  /** Cleanly shut down */
  disconnect(): void;
  /** Send a text message from the user */
  sendText(text: string): void;
  /** Send an audio chunk (PCM16 base64) for speech-to-text + AI processing */
  sendAudio(audioData: Float32Array, sampleRate: number): void;
  /** Send a video frame (base64 JPEG) for visual analysis */
  sendFrame(frameBase64: string): void;
  /** Notify the service about camera/screen state changes */
  setMediaState(state: { camera?: boolean; screen?: boolean; mic?: boolean }): void;
  /** Current status */
  getStatus(): LiveSessionStatus;
}
