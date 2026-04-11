/**
 * Mock Wake Word Detection Service
 * 
 * Simulates wake word detection for development/demo purposes.
 * In production, replace with a real implementation using:
 * - Porcupine (Picovoice) for on-device wake word detection
 * - Web Speech API for browser-based recognition
 * - Custom ML model via TensorFlow.js
 * 
 * To connect your real backend:
 * 1. Implement WakeWordService interface
 * 2. Use AudioWorklet or Web Speech API for mic processing
 * 3. Swap the import in AlwaysListeningProvider
 */

import type { WakeWordService, WakeWordServiceConfig } from "./types";

const DEFAULT_WAKE_WORD = "Hey Seven";

export class MockWakeWordService implements WakeWordService {
  private config: WakeWordServiceConfig | null = null;
  private listening = false;
  private wakeWord = DEFAULT_WAKE_WORD;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private volumeRaf: number | null = null;

  // Track sustained volume to simulate "someone is speaking"
  private sustainedVolumeCount = 0;
  private readonly SUSTAINED_THRESHOLD = 12; // ~frames of loud audio to trigger

  async startListening(config: WakeWordServiceConfig): Promise<void> {
    if (this.listening) return;

    this.config = config;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;
      source.connect(this.analyser);

      this.listening = true;
      config.onListeningChange(true);

      // Start monitoring audio for simulated wake word detection
      this.startVolumeMonitoring();
    } catch {
      config.onError("Microphone access denied for always-listening mode");
    }
  }

  stopListening(): void {
    if (this.volumeRaf) {
      cancelAnimationFrame(this.volumeRaf);
      this.volumeRaf = null;
    }
    this.analyser = null;
    this.audioContext?.close();
    this.audioContext = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.listening = false;
    this.sustainedVolumeCount = 0;
    this.config?.onListeningChange(false);
    this.config = null;
  }

  isListening(): boolean {
    return this.listening;
  }

  setWakeWord(word: string): void {
    this.wakeWord = word || DEFAULT_WAKE_WORD;
  }

  getWakeWord(): string {
    return this.wakeWord;
  }

  /**
   * Monitor audio levels to simulate wake word detection.
   * In a real implementation, this would:
   * 1. Feed audio to a wake word model (Porcupine, etc.)
   * 2. Compare against the trained wake word
   * 3. Fire onWakeWordDetected when confidence exceeds threshold
   * 
   * Mock behavior: detects sustained loud audio (simulating someone
   * saying the wake word) and triggers after sustained volume.
   */
  private startVolumeMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const check = () => {
      if (!this.listening || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;

      // Simulate: sustained volume above 0.15 counts as potential wake word
      if (avg > 0.15) {
        this.sustainedVolumeCount++;
      } else {
        // Reset if volume drops
        if (this.sustainedVolumeCount > 3 && this.sustainedVolumeCount < this.SUSTAINED_THRESHOLD) {
          this.sustainedVolumeCount = 0;
        }
      }

      // If we've heard sustained audio, trigger wake word
      if (this.sustainedVolumeCount >= this.SUSTAINED_THRESHOLD) {
        this.sustainedVolumeCount = 0;
        this.config?.onWakeWordDetected(this.wakeWord);
      }

      this.volumeRaf = requestAnimationFrame(check);
    };

    check();
  }
}
