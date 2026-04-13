/**
 * Real Live Service — Deepgram Nova-2 STT + Chat Edge Function + TTS
 *
 * Architecture v5.5, Part IV:
 *   - STT: Deepgram Nova-2 via token endpoint + direct browser WebSocket (Section 4.6)
 *   - LLM: Same chat Edge Function as typed messages (Section 4.8)
 *   - TTS: OpenAI TTS (tts-1-hd, nova voice) via voice-tts Edge Function (Section 4.7)
 *
 * Voice state machine (Section 4.2):
 *   idle → listening → thinking → speaking → listening (loop)
 *   Barge-in: user speaks during speaking → stop TTS, return to listening
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

type DeepgramMessage = DeepgramResult | DeepgramUtteranceEnd | DeepgramError;

// ─── Service implementation ───

export class RealLiveService implements LiveService {
  // Config & connection state
  private config: LiveServiceConfig | null = null;
  private status: LiveSessionStatus = "idle";
  private sectionId: string | null = null;

  // Deepgram WebSocket
  private sttSocket: WebSocket | null = null;
  private sttReady = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Keepalive: Deepgram closes the connection after ~12s of no audio.
  // We send {"type":"KeepAlive"} every 8s to prevent this.
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  // Transcript accumulation
  private finalTranscriptParts: string[] = [];

  // TTS state
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  // After TTS ends, mute audio for a cooldown period to prevent echo pickup.
  // Browser echoCancellation isn't perfect — residual TTS audio from speakers
  // gets transcribed as user input without this guard.
  private ttsCooldownUntil = 0;
  private static TTS_COOLDOWN_MS = 3000;
  // Store the last TTS text for echo detection. If an incoming transcript
  // contains significant word overlap with what Seven just said, it's echo
  // from the speakers being picked up by the mic, not actual user speech.
  private lastSpokenText = "";

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
    // Don't send audio during TTS or cooldown period to prevent feedback loop.
    if (this.isSpeaking || Date.now() < this.ttsCooldownUntil) return;

    // Don't send if WebSocket not ready
    if (
      !this.sttSocket ||
      this.sttSocket.readyState !== WebSocket.OPEN ||
      !this.sttReady
    ) {
      return;
    }

    // Convert Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
    const int16 = float32ToInt16(audioData);

    try {
      this.sttSocket.send(int16.buffer);
    } catch (err) {
      console.error("[VOICE] Failed to send audio frame:", err);
    }
  }

  sendFrame(_frameBase64: string): void {
    // Visual analysis: Priority 8 (Gemini 2.0 Flash)
  }

  setMediaState(state: {
    camera?: boolean;
    screen?: boolean;
    mic?: boolean;
  }): void {
    Object.assign(this.mediaState, state);
  }

  getStatus(): LiveSessionStatus {
    return this.status;
  }

  // ─── PRIVATE: STT WebSocket Connection ───

  private async openSTTConnection(): Promise<void> {
    // Guard against duplicate connection attempts
    if (this.isConnecting) {
      console.log("[VOICE] Connection already in progress, skipping");
      return;
    }
    this.isConnecting = true;

    try {
      // Step 1: Get Deepgram URL + key from token endpoint
      const tokenResponse = await supabase.functions.invoke("voice-stt", {
        body: {},
      });

      if (
        tokenResponse.error ||
        !tokenResponse.data?.url ||
        !tokenResponse.data?.key
      ) {
        const msg =
          tokenResponse.error?.message ||
          tokenResponse.data?.error ||
          "Failed to get voice token";
        const detail = tokenResponse.data?.detail || "";
        console.error("[VOICE] Token endpoint failed:", msg, detail);
        throw new Error(msg);
      }

      const deepgramUrl: string = tokenResponse.data.url;
      const deepgramKey: string = tokenResponse.data.key;
      console.log("[VOICE] Got Deepgram URL from token endpoint");

      // Close any existing socket before opening a new one
      if (this.sttSocket) {
        try {
          this.sttSocket.close(1000);
        } catch {
          /* ignore */
        }
        this.sttSocket = null;
      }

      // Step 2: Connect directly to Deepgram with subprotocol auth
      this.sttSocket = new WebSocket(deepgramUrl, ["token", deepgramKey]);
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
          if (!this.sttReady) {
            reject(
              new Error(
                `Voice connection closed: code=${event.code} ${event.reason}`
              )
            );
          }
        };
      });

      // Set up persistent event handlers after successful connection
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
        this.stopKeepalive();

        // Only reconnect for unexpected disconnects, NOT for idle timeouts.
        // Code 1011 = "Deepgram did not receive audio data" — this is normal
        // when mic is denied or during extended TTS. Don't spam reconnects.
        if (this.shouldBeConnected && event.code !== 1011) {
          this.attemptReconnect();
        } else if (this.shouldBeConnected && event.code === 1011) {
          console.log(
            "[VOICE] Deepgram idle timeout — will reconnect when audio resumes"
          );
          // Don't reconnect immediately. The audio capture hook will trigger
          // a reconnect when mic becomes available and audio starts flowing.
        }
      };

      // Start keepalive timer
      this.startKeepalive();
    } finally {
      this.isConnecting = false;
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    // Send KeepAlive every 8 seconds to prevent Deepgram's ~12s idle timeout
    this.keepaliveTimer = setInterval(() => {
      if (
        this.sttSocket &&
        this.sttSocket.readyState === WebSocket.OPEN
      ) {
        try {
          this.sttSocket.send(JSON.stringify({ type: "KeepAlive" }));
        } catch {
          // Ignore — if send fails, onclose will handle it
        }
      }
    }, 8000);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private closeSTTConnection(): void {
    this.stopKeepalive();
    if (this.sttSocket) {
      if (this.sttSocket.readyState === WebSocket.OPEN) {
        try {
          this.sttSocket.send(JSON.stringify({ type: "CloseStream" }));
        } catch {
          /* ignore */
        }
      }
      try {
        this.sttSocket.close(1000, "Client disconnected");
      } catch {
        /* ignore */
      }
      this.sttSocket = null;
    }
    this.sttReady = false;
  }

  private attemptReconnect(): void {
    if (this.isConnecting) return;
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
      }
    }, delay);
  }

  /**
   * Called by sendAudio when audio starts flowing after a Deepgram idle timeout.
   * Re-establishes the connection so transcription can resume.
   */
  private ensureConnected(): void {
    if (
      this.shouldBeConnected &&
      this.sttReady === false &&
      !this.isConnecting &&
      !this.reconnectTimer
    ) {
      console.log("[VOICE] Audio flowing — reconnecting to Deepgram");
      this.reconnectAttempts = 0;
      this.attemptReconnect();
    }
  }

  // ─── PRIVATE: STT Message Handling ───

  private handleSTTMessage(data: string | ArrayBuffer): void {
    if (typeof data !== "string") return;

    let msg: DeepgramMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

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

    if (msg.type === "Results") {
      this.handleTranscriptResult(msg as DeepgramResult);
      return;
    }

    if (msg.type === "UtteranceEnd") {
      this.commitTranscript();
      return;
    }
  }

  private handleTranscriptResult(result: DeepgramResult): void {
    // Ignore ALL transcripts during TTS and cooldown to prevent feedback loop.
    // Deepgram may return transcripts from audio received before isSpeaking was set.
    if (this.isSpeaking || Date.now() < this.ttsCooldownUntil) return;

    const alt = result.channel?.alternatives?.[0];
    if (!alt) return;

    const transcript = alt.transcript;

    if (!result.is_final) return;

    if (transcript.trim()) {
      this.finalTranscriptParts.push(transcript.trim());
    }

    if (result.speech_final) {
      this.commitTranscript();
    }
  }

  private commitTranscript(): void {
    if (this.finalTranscriptParts.length === 0) return;

    // Double-check: discard any transcript that accumulated during TTS transition
    if (this.isSpeaking || Date.now() < this.ttsCooldownUntil) {
      this.finalTranscriptParts = [];
      return;
    }

    const fullText = this.finalTranscriptParts.join(" ").trim();
    this.finalTranscriptParts = [];

    if (!fullText) return;

    // Echo detection: if the transcript matches what Seven just said,
    // it's the mic picking up speaker output, not actual user speech.
    if (this.lastSpokenText && isEcho(fullText, this.lastSpokenText)) {
      console.log("[VOICE] Echo detected — discarding transcript");
      return;
    }

    if (this.isSpeaking) {
      this.stopTTS();
    }

    this.config?.onMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text: fullText,
      timestamp: Date.now(),
    });

    this.processMessage(fullText);
  }

  // ─── PRIVATE: Process message through LLM ───

  private async processMessage(text: string): Promise<void> {
    if (!this.config) return;

    this.config.onSpeakingChange(false);

    try {
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

      if (data.context_used) {
        console.log(
          "[VOICE] Context loaded:",
          JSON.stringify(data.context_used)
        );
      }

      this.config?.onMessage({
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiText,
        timestamp: Date.now(),
      });

      this.speak(aiText);
    } catch (err) {
      console.error("[VOICE] Process message failed:", err);
      this.config?.onError("Something went wrong. Please try again.");
    }
  }

  // ─── PRIVATE: TTS ───

  private async speak(text: string): Promise<void> {
    this.isSpeaking = true;
    this.config?.onSpeakingChange(true);

    // Store what we're about to say for echo detection
    this.lastSpokenText = text;

    // Clear any pending transcript parts that accumulated during TTS setup
    this.finalTranscriptParts = [];

    const ttsSuccess = await this.speakOpenAI(text);
    if (!ttsSuccess) {
      await this.speakBrowser(text);
    }

    // TTS complete. Start cooldown period before accepting audio again.
    // This prevents residual speaker echo from being transcribed.
    this.ttsCooldownUntil = Date.now() + RealLiveService.TTS_COOLDOWN_MS;
    this.isSpeaking = false;
    this.config?.onSpeakingChange(false);

    // Clear any transcript parts that may have leaked through during TTS
    this.finalTranscriptParts = [];
  }

  private async speakOpenAI(text: string): Promise<boolean> {
    try {
      // Use fetch() directly instead of supabase.functions.invoke() because
      // the Supabase JS client reads audio/mpeg responses as text, corrupting
      // the binary data. Direct fetch gives us proper Blob handling.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return false;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/voice-tts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) return false;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("audio")) return false;

      const audioBlob = await response.blob();

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

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-GB";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

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
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    if (this.currentUtterance) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    this.isSpeaking = false;
    this.config?.onSpeakingChange(false);
    // Start cooldown even on barge-in to catch echo tail
    this.ttsCooldownUntil = Date.now() + RealLiveService.TTS_COOLDOWN_MS;
  }
}

// ─── Helpers ───

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

/**
 * Detect if a transcript is an echo of the TTS output.
 * Compares significant words (3+ chars) between the transcript and the
 * last spoken text. If ≥40% of the transcript's words appear in the
 * spoken text, it's likely echo from speakers picked up by the mic.
 */
function isEcho(transcript: string, lastSpoken: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "");

  const transcriptWords = normalize(transcript)
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const spokenWords = new Set(
    normalize(lastSpoken)
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );

  if (transcriptWords.length === 0) return false;

  let matches = 0;
  for (const word of transcriptWords) {
    if (spokenWords.has(word)) matches++;
  }

  const overlapRatio = matches / transcriptWords.length;
  return overlapRatio >= 0.4;
}
