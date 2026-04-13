/**
 * Real Live Service — Deepgram Nova-2 STT + Streaming Chat + Sentence-Level TTS
 *
 * Architecture v5.5, Part IV:
 *   - STT: Deepgram Nova-2 via token endpoint + direct browser WebSocket (Section 4.6)
 *   - LLM: Streaming chat Edge Function — tokens streamed via SSE (Section 4.7, 4.8)
 *   - TTS: OpenAI TTS (tts-1-hd, nova voice) — sentence-level streaming (Section 4.7)
 *
 * Voice state machine (Section 4.2):
 *   idle → listening → thinking → speaking → listening (loop)
 *   Barge-in: user speaks during speaking → stop TTS, flush queue, return to listening
 *
 * Key improvements over batch mode:
 *   - LLM response streamed token-by-token
 *   - Each sentence sent to TTS immediately (not waiting for full response)
 *   - AudioQueue plays sentences sequentially without gaps
 *   - User hears first word within ~2 seconds, not 4-8 seconds
 *   - Barge-in flushes queue and cancels in-flight requests
 *   - TTS cooldown reduced from 3000ms to 500ms (Section 4.6)
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

// ─── AudioQueue: sequential sentence-level TTS playback (Section 4.7) ───

class AudioQueue {
  // Pipeline: each entry is a TTS fetch already in-flight, not just text.
  // When sentence 2 is enqueued while sentence 1 is playing, the TTS fetch
  // for sentence 2 starts immediately. No gap between sentences.
  private queue: { audioPromise: Promise<Blob | null>; controller: AbortController }[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private onSpeakingChange: (speaking: boolean) => void;
  private onFinished: () => void;

  constructor(
    onSpeakingChange: (speaking: boolean) => void,
    onFinished: () => void
  ) {
    this.onSpeakingChange = onSpeakingChange;
    this.onFinished = onFinished;
  }

  enqueue(sentence: string): void {
    // Start TTS fetch IMMEDIATELY — don't wait for current sentence to finish
    const controller = new AbortController();
    const audioPromise = this.fetchTTS(sentence, controller.signal);
    this.queue.push({ audioPromise, controller });

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onSpeakingChange(true);
      this.playNext();
    }
  }

  flush(): void {
    for (const entry of this.queue) {
      try { entry.controller.abort(); } catch { /* ignore */ }
    }
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;
    this.onSpeakingChange(false);
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onSpeakingChange(false);
      this.onFinished();
      return;
    }

    const entry = this.queue.shift()!;

    try {
      // Audio is already being fetched (or already fetched) — just await it
      const audioBlob = await entry.audioPromise;

      if (audioBlob) {
        await this.playAudio(audioBlob);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("[AudioQueue] TTS error, skipping sentence:", err);
    }

    this.playNext();
  }

  private async fetchTTS(
    text: string,
    signal: AbortSignal
  ): Promise<Blob | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const response = await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal,
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("audio")) return null;
    return response.blob();
  }

  private playAudio(blob: Blob): Promise<void> {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        resolve();
      };

      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        resolve();
      });
    });
  }
}

// ─── Sentence boundary detection ───

/**
 * Find the last sentence boundary in text.
 * Returns the index of the boundary character, or -1 if none found.
 * A sentence boundary is . ? ! followed by a space or end of string.
 */
function findSentenceBoundary(text: string): number {
  let lastBoundary = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "." || ch === "?" || ch === "!") {
      // Check it's not part of an abbreviation (e.g. "Mr." "Dr." "U.S.")
      // Simple heuristic: boundary if followed by space, newline, or end of string
      const next = text[i + 1];
      if (next === undefined || next === " " || next === "\n") {
        lastBoundary = i;
      }
    }
  }
  return lastBoundary;
}

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

  // Keepalive
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  // Transcript accumulation
  private finalTranscriptParts: string[] = [];
  // Architecture Section 4.6: 700ms turn-taking timer.
  // On speech_final, wait 700ms before committing. If user speaks again, cancel and keep accumulating.
  private turnTakingTimer: ReturnType<typeof setTimeout> | null = null;

  // TTS / AudioQueue
  private audioQueue: AudioQueue;
  // After TTS ends, mute for a short cooldown to catch residual echo.
  // Architecture Section 4.6: 500ms, NOT seconds.
  private ttsCooldownUntil = 0;
  private static TTS_COOLDOWN_MS = 500;
  private lastSpokenText = "";

  // Streaming LLM abort controller (for barge-in cancellation)
  private streamAbortController: AbortController | null = null;

  // Media & session state
  private mediaState = { camera: false, screen: false, mic: true };
  private shouldBeConnected = false;

  constructor() {
    this.audioQueue = new AudioQueue(
      (speaking) => this.config?.onSpeakingChange(speaking),
      () => {
        // AudioQueue finished playing all sentences
        this.ttsCooldownUntil = Date.now() + RealLiveService.TTS_COOLDOWN_MS;
        this.finalTranscriptParts = [];
      }
    );
  }

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
      this.audioQueue.enqueue(greeting);
      this.lastSpokenText = greeting;
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
    this.audioQueue.flush();
    this.cancelStream();
    this.closeSTTConnection();

    if (this.turnTakingTimer) {
      clearTimeout(this.turnTakingTimer);
      this.turnTakingTimer = null;
    }

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

    if (this.audioQueue.playing) {
      this.audioQueue.flush();
      this.cancelStream();
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
    // Architecture Section 4.6: ALWAYS send audio to Deepgram — never block.
    // Echo prevention is handled by discarding transcripts in handleTranscriptResult.
    // Blocking audio here causes the first part of user speech to be lost.
    if (
      !this.sttSocket ||
      this.sttSocket.readyState !== WebSocket.OPEN ||
      !this.sttReady
    ) {
      return;
    }

    const int16 = float32ToInt16(audioData);

    try {
      this.sttSocket.send(int16.buffer);
    } catch (err) {
      console.error("[VOICE] Failed to send audio frame:", err);
    }
  }

  sendFrame(_frameBase64: string): void {
    // Visual analysis: future priority
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

  // ─── PRIVATE: Cancel in-flight streaming LLM request ───

  private cancelStream(): void {
    if (this.streamAbortController) {
      try { this.streamAbortController.abort(); } catch { /* ignore */ }
      this.streamAbortController = null;
    }
  }

  // ─── PRIVATE: STT WebSocket Connection ───

  private async openSTTConnection(): Promise<void> {
    if (this.isConnecting) {
      console.log("[VOICE] Connection already in progress, skipping");
      return;
    }
    this.isConnecting = true;

    try {
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

      if (this.sttSocket) {
        try { this.sttSocket.close(1000); } catch { /* ignore */ }
        this.sttSocket = null;
      }

      this.sttSocket = new WebSocket(deepgramUrl, ["token", deepgramKey]);
      this.sttSocket.binaryType = "arraybuffer";

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Voice connection timed out. Check your internet and try again."));
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
            reject(new Error(`Voice connection closed: code=${event.code} ${event.reason}`));
          }
        };
      });

      // Set up persistent event handlers
      this.sttSocket.onmessage = (event: MessageEvent) => {
        this.handleSTTMessage(event.data);
      };

      this.sttSocket.onerror = () => {
        console.error("[VOICE] Deepgram WebSocket error");
      };

      this.sttSocket.onclose = (event: CloseEvent) => {
        console.log(`[VOICE] Deepgram closed: code=${event.code} reason=${event.reason}`);
        this.sttReady = false;
        this.stopKeepalive();

        if (this.shouldBeConnected && event.code !== 1011) {
          this.attemptReconnect();
        } else if (this.shouldBeConnected && event.code === 1011) {
          console.log("[VOICE] Deepgram idle timeout — will reconnect when audio resumes");
        }
      };

      this.startKeepalive();
    } finally {
      this.isConnecting = false;
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.sttSocket && this.sttSocket.readyState === WebSocket.OPEN) {
        try { this.sttSocket.send(JSON.stringify({ type: "KeepAlive" })); } catch { /* ignore */ }
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
        try { this.sttSocket.send(JSON.stringify({ type: "CloseStream" })); } catch { /* ignore */ }
      }
      try { this.sttSocket.close(1000, "Client disconnected"); } catch { /* ignore */ }
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
      this.config?.onError("Voice connection lost. Please refresh to reconnect.");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);
    console.log(`[VOICE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

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
      console.error("[VOICE] Deepgram error:", dgErr.message, dgErr.description);
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
    // During cooldown: discard everything (residual echo)
    if (Date.now() < this.ttsCooldownUntil) return;

    const alt = result.channel?.alternatives?.[0];
    if (!alt) return;

    const transcript = alt.transcript;

    if (!result.is_final) return;

    if (transcript.trim()) {
      // During TTS playback: check for barge-in
      if (this.audioQueue.playing) {
        // Run echo detection — if this is NOT echo, it's a barge-in
        if (this.lastSpokenText && isEcho(transcript, this.lastSpokenText)) {
          // Echo from speakers, discard
          return;
        }
        // Real speech during TTS → BARGE-IN
        console.log("[VOICE] Barge-in detected — interrupting TTS");
        this.audioQueue.flush();
        this.cancelStream();
        this.finalTranscriptParts = [];
      }

      // New speech arrived — cancel any pending turn-taking timer
      if (this.turnTakingTimer) {
        clearTimeout(this.turnTakingTimer);
        this.turnTakingTimer = null;
      }

      this.finalTranscriptParts.push(transcript.trim());
    }

    if (result.speech_final) {
      // Architecture Section 4.6: start a 700ms silence timer before committing.
      // If user speaks again within 700ms, the timer is cancelled above and
      // speech is appended to the same utterance. This prevents cutting off
      // users who pause briefly mid-sentence.
      if (this.turnTakingTimer) {
        clearTimeout(this.turnTakingTimer);
      }
      this.turnTakingTimer = setTimeout(() => {
        this.turnTakingTimer = null;
        this.commitTranscript();
      }, 700);
    }
  }

  private commitTranscript(): void {
    if (this.finalTranscriptParts.length === 0) return;

    // Discard if still in cooldown
    if (Date.now() < this.ttsCooldownUntil) {
      this.finalTranscriptParts = [];
      return;
    }

    const fullText = this.finalTranscriptParts.join(" ").trim();
    this.finalTranscriptParts = [];

    if (!fullText) return;

    // Echo detection for post-TTS transcripts
    if (this.lastSpokenText && isEcho(fullText, this.lastSpokenText)) {
      console.log("[VOICE] Echo detected — discarding transcript");
      return;
    }

    // If TTS is still playing, flush it (barge-in)
    if (this.audioQueue.playing) {
      this.audioQueue.flush();
      this.cancelStream();
    }

    this.config?.onMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text: fullText,
      timestamp: Date.now(),
    });

    this.processMessage(fullText);
  }

  // ─── PRIVATE: Process message through streaming LLM ───
  // Architecture v5.5, Section 4.7: sentence-level streaming TTS

  private async processMessage(text: string): Promise<void> {
    if (!this.config) return;

    this.config.onSpeakingChange(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        this.config?.onError("Not authenticated. Please sign in again.");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      // Create abort controller for this stream (so barge-in can cancel it)
      this.streamAbortController = new AbortController();

      const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          section_id: this.sectionId,
          metadata: { source: "voice" },
          response_mode: "stream",
        }),
        signal: this.streamAbortController.signal,
      });

      if (!response.ok || !response.body) {
        console.error("[VOICE] Chat stream error:", response.status);
        this.config?.onError("Failed to get a response. Please try again.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let tokenBuffer = "";
      let fullText = "";
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() || "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const jsonStr = event.slice(6).trim();
          if (!jsonStr) continue;

          let parsed: { type: string; text?: string; section_id?: string };
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (parsed.type === "token" && parsed.text) {
            tokenBuffer += parsed.text;
            fullText += parsed.text;

            // Detect sentence boundaries and send to TTS
            const boundary = findSentenceBoundary(tokenBuffer);
            if (boundary > -1) {
              const sentence = tokenBuffer.slice(0, boundary + 1).trim();
              tokenBuffer = tokenBuffer.slice(boundary + 1);

              if (sentence) {
                this.lastSpokenText = fullText;
                this.audioQueue.enqueue(sentence);
              }
            }
          }

          if (parsed.type === "done") {
            this.sectionId = parsed.section_id || this.sectionId;
            // Flush any remaining text in buffer to TTS
            if (tokenBuffer.trim()) {
              this.lastSpokenText = fullText;
              this.audioQueue.enqueue(tokenBuffer.trim());
              tokenBuffer = "";
            }
          }

          if (parsed.type === "error") {
            this.config?.onError(parsed.text || "Something went wrong.");
          }
        }
      }

      this.streamAbortController = null;

      // Add full text to transcript
      if (fullText) {
        this.lastSpokenText = fullText;
        this.config?.onMessage({
          id: `ai-${Date.now()}`,
          role: "ai",
          text: fullText,
          timestamp: Date.now(),
        });
      }

      // If there's still buffered text that never hit a sentence boundary, send it
      if (tokenBuffer.trim()) {
        this.audioQueue.enqueue(tokenBuffer.trim());
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Barge-in cancelled the stream — this is expected
        console.log("[VOICE] Stream aborted (barge-in)");
        return;
      }
      console.error("[VOICE] Process message failed:", err);
      this.config?.onError("Something went wrong. Please try again.");
    }
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
 * last spoken text. If ≥40% overlap, it's likely echo.
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
