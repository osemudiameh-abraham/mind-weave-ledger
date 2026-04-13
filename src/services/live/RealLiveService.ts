/**
 * Real Live Service — Deepgram Nova-2 STT + Chat Edge Function + TTS
 *
 * Architecture v5.5, Part IV:
 *   - STT: Deepgram Nova-2 via voice-stt WebSocket proxy (Section 4.6)
 *   - LLM: Same chat Edge Function as typed messages (Section 4.8)
 *   - TTS: ElevenLabs via voice-tts Edge Function, browser fallback (Section 4.7 — OpenAI TTS in Priority 3)
 *
 * Voice state machine (Section 4.2):
 *   idle → listening → thinking → speaking → listening (loop)
 *   Barge-in: user speaks during speaking → stop TTS, return to listening
 *
 * Audio pipeline:
 *   Mic → use-audio-capture hook → sendAudio(Float32, rate)
 *   → convert Float32 → Int16 PCM → WebSocket → proxy → Deepgram
 *   → transcripts returned → parse → processMessage() → chat Edge Function
 *   → TTS response → audio playback
 */

import type {
  LiveService,
  LiveServiceConfig,
  LiveSessionStatus,
  LiveMessage,
} from "./types";
import { supabase } from "@/lib/supabase";

// ─── Deepgram message types ───

interface DeepgramResult {
  type: "Results";
  channel_index: number[];
  duration: number;
  start: number;
  is_final: boolean;
  speech_final: boolean;
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
}

interface DeepgramUtteranceEnd {
  type: "UtteranceEnd";
  last_word_end: number;
  channel: number[];
}

interface DeepgramError {
  type: "Error";
  message: string;
  description: string;
}

type DeepgramMessage =
  | DeepgramResult
  | DeepgramUtteranceEnd
  | DeepgramError;

// ─── Service implementation ───

export class RealLiveService implements LiveService {
  // Config & connection state
  private config: LiveServiceConfig | null = null;
  private status: LiveSessionStatus = "idle";
  private sectionId: string | null = null;

  // Deepgram WebSocket
  private sttSocket: WebSocket | null = null;
  private sttReady = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Transcript accumulation
  // Deepgram sends multiple is_final segments per utterance.
  // We accumulate them until speech_final or UtteranceEnd.
  private finalTranscriptParts: string[] = [];

  // TTS state
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;

  // Media & session state
  private mediaState = { camera: false, screen: false, mic: true };
  private shouldBeConnected = false;

  // ─── PUBLIC API ───

  async connect(config: LiveServiceConfig): Promise<void> {
    this.config = config;
    this.shouldBeConnected = true;
    this.status = "connecting";
    config.onStatusChange("connecting");

    try {
      await this.openSTTConnection();

      this.status = "connected";
      config.onStatusChange("connected");

      // Greeting
      const greeting = "I'm listening. What's on your mind?";
      config.onMessage({
        id: `ai-greeting-${Date.now()}`,
        role: "ai",
        text: greeting,
        timestamp: Date.now(),
      });
      this.speak(greeting);
    } catch (err) {
      console.error("[VOICE] Connection failed:", err);
      this.status = "error";
      config.onStatusChange("error");
      config.onError(
        err instanceof Error ? err.message : "Voice connection failed"
      );
    }
  }

  disconnect(): void {
    this.shouldBeConnected = false;
    this.stopTTS();
    this.closeSTTConnection();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.finalTranscriptParts = [];
    this.status = "idle";
    this.config?.onStatusChange("idle");
    this.config = null;
    this.sectionId = null;
  }

  sendText(text: string): void {
    if (!this.config) return;

    // Barge-in
    if (this.isSpeaking) {
      this.stopTTS();
    }

    this.config.onMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text,
      timestamp: Date.now(),
    });

    this.processMessage(text);
  }

  sendAudio(audioData: Float32Array, _sampleRate: number): void {
    // Don't send audio during TTS playback to prevent feedback loop.
    // Architecture v5.5, Section 4.6: echo prevention by muting the
    // Deepgram audio stream during TTS.
    if (this.isSpeaking) return;

    // Don't send if WebSocket not ready
    if (
      !this.sttSocket ||
      this.sttSocket.readyState !== WebSocket.OPEN ||
      !this.sttReady
    ) {
      return;
    }

    // Convert Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
    // Deepgram expects linear16 encoding.
    const int16 = float32ToInt16(audioData);

    // Send as binary frame
    try {
      this.sttSocket.send(int16.buffer);
    } catch (err) {
      console.error("[VOICE] Failed to send audio frame:", err);
    }
  }

  sendFrame(_frameBase64: string): void {
    // Visual analysis will be implemented with Gemini 2.0 Flash in Priority 8.
    // For now, frames are captured but not processed.
  }

  setMediaState(state: {
    camera?: boolean;
    screen?: boolean;
    mic?: boolean;
  }): void {
    Object.assign(this.mediaState, state);
    // Mic mute/unmute is handled by the use-audio-capture hook's active state.
    // When mic is off, the hook stops capturing, so no audio arrives at sendAudio().
  }

  getStatus(): LiveSessionStatus {
    return this.status;
  }

  // ─── PRIVATE: STT WebSocket Connection ───

  private async openSTTConnection(): Promise<void> {
    // Step 1: Get Deepgram WebSocket URL from the token endpoint.
    // The Edge Function validates auth and returns a URL with the API key
    // embedded. The API key never appears in client-side code.
    const tokenResponse = await supabase.functions.invoke("voice-stt", {
      body: {},
    });

    if (tokenResponse.error || !tokenResponse.data?.url) {
      const msg = tokenResponse.error?.message || "Failed to get voice token";
      console.error("[VOICE] Token endpoint failed:", msg);
      throw new Error(msg);
    }

    const deepgramUrl: string = tokenResponse.data.url;
    console.log("[VOICE] Got Deepgram URL from token endpoint");

    // Step 2: Connect directly to Deepgram from the browser.
    // This avoids the Deno Deploy outgoing WebSocket limitation.
    this.sttSocket = new WebSocket(deepgramUrl);
    this.sttSocket.binaryType = "arraybuffer";

    // Wait for connection to open or fail
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "Voice connection timed out. Check your internet and try again."
          )
        );
      }, 15000);

      this.sttSocket!.onopen = () => {
        clearTimeout(timeout);
        console.log("[VOICE] Connected directly to Deepgram Nova-2");
        this.sttReady = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.sttSocket!.onerror = () => {
        clearTimeout(timeout);
        console.error("[VOICE] Deepgram WebSocket error");
        reject(new Error("Voice connection failed."));
      };

      this.sttSocket!.onclose = (event: CloseEvent) => {
        clearTimeout(timeout);
        // If we haven't resolved yet, this is a connection failure
        if (!this.sttReady) {
          reject(
            new Error(
              `Voice connection closed: code=${event.code} ${event.reason}`
            )
          );
        }
      };
    });

    // Now that connection is open, set up persistent event handlers
    this.sttSocket.onmessage = (event: MessageEvent) => {
      this.handleSTTMessage(event.data);
    };

    this.sttSocket.onerror = () => {
      console.error("[VOICE] Deepgram WebSocket error");
    };

    this.sttSocket.onclose = (event: CloseEvent) => {
      console.log(
        `[VOICE] Deepgram closed: code=${event.code} reason=${event.reason}`
      );
      this.sttReady = false;

      // Attempt reconnection if we should still be connected
      if (this.shouldBeConnected) {
        this.attemptReconnect();
      }
    };
  }

  private closeSTTConnection(): void {
    if (this.sttSocket) {
      // Send CloseStream to Deepgram to finalize any pending transcription
      if (this.sttSocket.readyState === WebSocket.OPEN) {
        try {
          this.sttSocket.send(JSON.stringify({ type: "CloseStream" }));
        } catch {
          // Ignore — closing anyway
        }
      }
      try {
        this.sttSocket.close(1000, "Client disconnected");
      } catch {
        // Ignore
      }
      this.sttSocket = null;
    }
    this.sttReady = false;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[VOICE] Max reconnection attempts reached");
      this.status = "error";
      this.config?.onStatusChange("error");
      this.config?.onError(
        "Voice connection lost. Please refresh to reconnect."
      );
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s (capped at 8s)
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      8000
    );
    console.log(
      `[VOICE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.openSTTConnection();
        console.log("[VOICE] Reconnected successfully");
        this.status = "connected";
        this.config?.onStatusChange("connected");
      } catch (err) {
        console.error("[VOICE] Reconnection failed:", err);
        // onclose handler will trigger another attemptReconnect
      }
    }, delay);
  }

  // ─── PRIVATE: STT Message Handling ───

  private handleSTTMessage(data: string | ArrayBuffer): void {
    // Deepgram sends JSON text messages; binary messages are not expected
    if (typeof data !== "string") return;

    let msg: DeepgramMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      console.warn("[VOICE] Failed to parse STT message");
      return;
    }

    // Deepgram error
    if (msg.type === "Error") {
      const dgErr = msg as DeepgramError;
      console.error(
        "[VOICE] Deepgram error:",
        dgErr.message,
        dgErr.description
      );
      this.config?.onError("Speech recognition error. Please try again.");
      return;
    }

    // Deepgram transcript result
    if (msg.type === "Results") {
      this.handleTranscriptResult(msg as DeepgramResult);
      return;
    }

    // Deepgram utterance end (silence-based endpoint after utterance_end_ms)
    if (msg.type === "UtteranceEnd") {
      this.commitTranscript();
      return;
    }
  }

  private handleTranscriptResult(result: DeepgramResult): void {
    const alt = result.channel?.alternatives?.[0];
    if (!alt) return;

    const transcript = alt.transcript;

    // Interim results (is_final: false) — useful for real-time UI feedback.
    // We don't process these as user input. Future: display in LiveTranscript.
    if (!result.is_final) {
      return;
    }

    // Final result — accumulate this segment
    if (transcript.trim()) {
      this.finalTranscriptParts.push(transcript.trim());
    }

    // speech_final: Deepgram detected an utterance boundary.
    // Fires sooner than UtteranceEnd for faster response latency.
    if (result.speech_final) {
      this.commitTranscript();
    }
  }

  private commitTranscript(): void {
    if (this.finalTranscriptParts.length === 0) return;

    const fullText = this.finalTranscriptParts.join(" ").trim();
    this.finalTranscriptParts = [];

    if (!fullText) return;

    // Barge-in: stop TTS if playing
    if (this.isSpeaking) {
      this.stopTTS();
    }

    // Emit user message to UI
    this.config?.onMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text: fullText,
      timestamp: Date.now(),
    });

    // Process through LLM — same pipeline as typed chat (Section 4.8)
    this.processMessage(fullText);
  }

  // ─── PRIVATE: Process message through LLM ───

  private async processMessage(text: string): Promise<void> {
    if (!this.config) return;

    // Indicate thinking state
    this.config.onSpeakingChange(false);

    try {
      // Architecture v5.5, Section 4.8: Voice hits the SAME chat endpoint
      // as typed messages. metadata.source = 'voice' for traceability.
      const response = await supabase.functions.invoke("chat", {
        body: {
          message: text,
          section_id: this.sectionId,
          metadata: { source: "voice" },
        },
      });

      if (response.error) {
        console.error("[VOICE] Chat error:", response.error);
        this.config?.onError("Failed to get a response. Please try again.");
        return;
      }

      const data = response.data;
      this.sectionId = data.section_id;

      const aiText: string = data.response;

      // Log context diagnostics
      if (data.context_used) {
        console.log(
          "[VOICE] Context loaded:",
          JSON.stringify(data.context_used)
        );
      }

      // Emit AI response to UI
      this.config?.onMessage({
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiText,
        timestamp: Date.now(),
      });

      // Speak the response via TTS
      this.speak(aiText);
    } catch (err) {
      console.error("[VOICE] Process message failed:", err);
      this.config?.onError("Something went wrong. Please try again.");
    }
  }

  // ─── PRIVATE: TTS ───
  // NOTE: Priority 3 replaces ElevenLabs with OpenAI TTS (tts-1-hd, nova voice).
  // Current implementation preserved for continuity.

  private async speak(text: string): Promise<void> {
    this.isSpeaking = true;
    this.config?.onSpeakingChange(true);

    // Audio stream is muted during TTS via the isSpeaking check in sendAudio().
    // This prevents the feedback loop where Deepgram transcribes TTS output.

    // Try ElevenLabs first, fall back to browser speechSynthesis
    const ttsSuccess = await this.speakElevenLabs(text);
    if (!ttsSuccess) {
      await this.speakBrowser(text);
    }

    // TTS complete — resume accepting audio
    this.isSpeaking = false;
    this.config?.onSpeakingChange(false);
  }

  private async speakElevenLabs(text: string): Promise<boolean> {
    try {
      const response = await supabase.functions.invoke("voice-tts", {
        body: { text },
      });

      if (response.error || !response.data) {
        return false;
      }

      // Response should be audio blob
      const audioBlob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "audio/mpeg" });

      return new Promise<boolean>((resolve) => {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve(true);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve(false);
        };

        audio.play().catch(() => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  private speakBrowser(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      // Cancel any pending utterances
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-GB";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Try to pick a natural-sounding voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Daniel")
      );
      if (preferred) utterance.voice = preferred;

      this.currentUtterance = utterance;

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  private stopTTS(): void {
    // Stop ElevenLabs audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop browser speech synthesis
    if (this.currentUtterance) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    this.isSpeaking = false;
    this.config?.onSpeakingChange(false);
  }
}

// ─── Helpers ───

/**
 * Convert Float32 PCM [-1.0, 1.0] to Int16 PCM [-32768, 32767].
 * Deepgram expects linear16 encoding for WebSocket streaming.
 */
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    // Clamp to [-1, 1] then scale
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
