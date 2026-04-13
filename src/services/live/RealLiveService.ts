/**
 * Real Live Service
 *
 * Implements the LiveService interface with:
 * - STT: Browser SpeechRecognition API (Chrome/Safari/Edge). Deepgram upgrade path in Phase 4.1.
 * - LLM: Supabase chat Edge Function (same pipeline as typed messages — full context assembly).
 * - TTS: ElevenLabs via voice-tts Edge Function, falling back to browser speechSynthesis.
 *
 * Voice state machine (Architecture v5.5, Section 4.2):
 *   idle → listening → thinking → speaking → listening (loop)
 *   Barge-in: user speaks during speaking → stop TTS, return to listening
 */

import type { LiveService, LiveServiceConfig, LiveSessionStatus, LiveMessage } from "./types";
import { supabase } from "@/lib/supabase";

// Extend Window to include webkit speech recognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

type BrowserSpeechRecognition = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): BrowserSpeechRecognition | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export class RealLiveService implements LiveService {
  private config: LiveServiceConfig | null = null;
  private status: LiveSessionStatus = "idle";
  private recognition: InstanceType<BrowserSpeechRecognition> | null = null;
  private mediaState = { camera: false, screen: false, mic: true };
  private sectionId: string | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private shouldRestart = true;
  private interimTranscript = "";

  async connect(config: LiveServiceConfig): Promise<void> {
    this.config = config;
    this.status = "connecting";
    config.onStatusChange("connecting");

    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      this.status = "error";
      config.onStatusChange("error");
      config.onError("Speech recognition is not supported in this browser. Use Chrome, Safari, or Edge.");
      return;
    }

    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-GB";
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log("[VOICE] SpeechRecognition started");
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      this.interimTranscript = interim;

      if (final.trim()) {
        // Barge-in: if TTS is playing, stop it
        if (this.isSpeaking) {
          this.stopTTS();
        }

        // Emit user message
        this.config?.onMessage({
          id: `user-${Date.now()}`,
          role: "user",
          text: final.trim(),
          timestamp: Date.now(),
        });

        // Process through LLM
        this.processMessage(final.trim());
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are normal — don't treat as fatal
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      console.error("[VOICE] SpeechRecognition error:", event.error);
      if (event.error === "not-allowed") {
        this.config?.onError("Microphone access denied. Please allow microphone access and try again.");
        // Show error in transcript so user sees it
        this.config?.onMessage({
          id: `error-${Date.now()}`,
          role: "ai",
          text: "I can't access your microphone. Please allow microphone access in your browser settings and refresh the page. You can also type using the text input button.",
          timestamp: Date.now(),
        });
      } else {
        this.config?.onMessage({
          id: `error-${Date.now()}`,
          role: "ai",
          text: `Voice recognition error: ${event.error}. Try refreshing the page or use the text input.`,
          timestamp: Date.now(),
        });
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if we should still be listening
      if (this.shouldRestart && this.mediaState.mic) {
        try {
          this.recognition?.start();
        } catch {
          // Already started — ignore
        }
      }
    };

    // Start listening
    this.shouldRestart = true;
    try {
      this.recognition.start();
    } catch {
      // May fail if already started
    }

    this.status = "connected";
    config.onStatusChange("connected");

    // Send greeting via TTS
    const greeting = "I'm listening. What's on your mind?";
    this.config.onMessage({
      id: `ai-greeting-${Date.now()}`,
      role: "ai",
      text: greeting,
      timestamp: Date.now(),
    });
    this.speak(greeting);
  }

  disconnect(): void {
    this.shouldRestart = false;
    this.stopTTS();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }

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

  sendAudio(_audioData: Float32Array, _sampleRate: number): void {
    // Audio processing handled by SpeechRecognition API directly
    // When Deepgram is integrated, raw audio will be forwarded via WebSocket
  }

  sendFrame(_frameBase64: string): void {
    // Visual analysis will be implemented with Gemini 2.0 Flash in Phase 4.1
    // For now, frames are captured but not processed
  }

  setMediaState(state: { camera?: boolean; screen?: boolean; mic?: boolean }): void {
    Object.assign(this.mediaState, state);

    if (state.mic === false) {
      this.shouldRestart = false;
      try {
        this.recognition?.stop();
      } catch {
        // Ignore
      }
    } else if (state.mic === true && this.status === "connected") {
      this.shouldRestart = true;
      try {
        this.recognition?.start();
      } catch {
        // Already started
      }
    }
  }

  getStatus(): LiveSessionStatus {
    return this.status;
  }

  // ─── Private: Process message through LLM ───

  private async processMessage(text: string): Promise<void> {
    if (!this.config) return;

    this.config.onSpeakingChange(false); // thinking state

    try {
      const response = await supabase.functions.invoke("chat", {
        body: {
          message: text,
          section_id: this.sectionId,
        },
      });

      if (response.error) {
        console.error("[VOICE] Chat error:", response.error);
        this.config?.onError("Failed to get a response. Please try again.");
        return;
      }

      const data = response.data;
      this.sectionId = data.section_id;

      const aiText = data.response;

      // Emit AI response
      this.config?.onMessage({
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiText,
        timestamp: Date.now(),
      });

      // Speak the response
      this.speak(aiText);
    } catch (err) {
      console.error("[VOICE] Process message failed:", err);
      this.config?.onError("Something went wrong. Please try again.");
    }
  }

  // ─── Private: TTS ───

  private async speak(text: string): Promise<void> {
    this.isSpeaking = true;
    this.config?.onSpeakingChange(true);

    // Try ElevenLabs first, fall back to browser speechSynthesis
    const elevenlabsSuccess = await this.speakElevenLabs(text);
    if (!elevenlabsSuccess) {
      await this.speakBrowser(text);
    }
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
      const audioBlob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: "audio/mpeg" });

      return new Promise<boolean>((resolve) => {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          this.isSpeaking = false;
          this.config?.onSpeakingChange(false);
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
        this.isSpeaking = false;
        this.config?.onSpeakingChange(false);
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
      const preferred = voices.find((v) =>
        v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel")
      );
      if (preferred) utterance.voice = preferred;

      this.currentUtterance = utterance;

      utterance.onend = () => {
        this.isSpeaking = false;
        this.config?.onSpeakingChange(false);
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.config?.onSpeakingChange(false);
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
