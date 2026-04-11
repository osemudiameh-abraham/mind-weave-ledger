/**
 * Mock Live Service
 * 
 * Simulates AI responses for development/demo purposes.
 * Replace with RealLiveService when connecting your backend.
 * 
 * To connect your real backend:
 * 1. Create a new class implementing LiveService
 * 2. Use WebSocket/SSE to your server
 * 3. Forward audio chunks for STT
 * 4. Forward video frames for visual analysis
 * 5. Swap the import in use-live-session.ts
 */

import type { LiveService, LiveServiceConfig, LiveSessionStatus } from "./types";

const CAMERA_RESPONSES = [
  "I can see what's in front of you. The image is clear — would you like me to identify objects, read any text, or analyze the scene?",
  "Interesting scene! I notice several elements here. Want me to describe what I see in detail, or focus on something specific?",
  "I'm analyzing the visual feed now. I can help with identification, troubleshooting, styling advice, or contextual information about what I see.",
  "Got a clear view. I can provide real-time observations — just point at anything you'd like me to focus on.",
  "I see the scene clearly. Ask me about any object, text, label, or detail and I'll give you instant context.",
];

const SCREEN_RESPONSES = [
  "I can see your screen. I'll follow along and help with whatever you're viewing — shopping comparisons, articles, code, or anything else.",
  "Screen share is active. I can read content, compare options, help navigate, or explain what's on display.",
  "I'm watching your screen now. Feel free to browse naturally — I'll provide context and assistance as you go.",
  "I can see what you're looking at. Want me to summarize the content, help you make a decision, or guide you through something?",
];

const GENERAL_RESPONSES = [
  "I'm here and listening. What would you like to explore or discuss?",
  "Sure, I can help with that. Tell me more and I'll dive deeper.",
  "Great question — let me think about that and give you a thorough answer.",
  "I understand. Here's what I'd suggest based on what you've shared…",
  "Absolutely — let's work through this together step by step.",
  "That's an interesting angle. Let me build on that idea with you.",
];

const VISUAL_ANALYSIS_RESPONSES = [
  "Looking at the frame you shared — I can see several distinct objects. Want me to break down what I notice?",
  "I've captured that moment. Based on the visual, here's what stands out to me…",
  "Analyzing the image now. I can identify the main subjects and provide context about each.",
];

const GREETING = "I'm ready to help. Point your camera at anything, share your screen, or just talk — I'll provide instant, intelligent assistance.";

export class MockLiveService implements LiveService {
  private config: LiveServiceConfig | null = null;
  private status: LiveSessionStatus = "idle";
  private responseIndex = 0;
  private speakingInterval: ReturnType<typeof setInterval> | null = null;
  private mediaState = { camera: false, screen: false, mic: true };
  private frameCount = 0;

  async connect(config: LiveServiceConfig): Promise<void> {
    this.config = config;
    this.status = "connecting";
    config.onStatusChange("connecting");

    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 600));

    this.status = "connected";
    config.onStatusChange("connected");

    // Send greeting
    setTimeout(() => {
      this.emitAIMessage(GREETING);
    }, 800);

    // Start simulated speaking pulse
    this.startSpeakingSimulation();
  }

  disconnect(): void {
    this.stopSpeakingSimulation();
    this.status = "idle";
    this.config?.onStatusChange("idle");
    this.config = null;
    this.frameCount = 0;
  }

  sendText(text: string): void {
    if (!this.config) return;

    // Echo user message
    this.config.onMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text,
      timestamp: Date.now(),
    });

    // Simulate AI response with context awareness
    const context = this.mediaState.camera
      ? "camera"
      : this.mediaState.screen
        ? "screen"
        : "general";

    this.simulateResponse(context);
  }

  sendAudio(_audioData: Float32Array, _sampleRate: number): void {
    // In mock mode, we simulate occasional "heard something" responses
    // Real implementation: send to STT service, get transcript, forward to AI
    if (!this.config) return;

    // Simulate speech detection ~every 8 seconds
    if (Math.random() < 0.02) {
      const mockTranscripts = [
        "What am I looking at?",
        "Can you tell me more about that?",
        "What do you think?",
        "Help me understand this.",
      ];
      const text = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
      
      this.config.onMessage({
        id: `user-${Date.now()}`,
        role: "user",
        text,
        timestamp: Date.now(),
      });

      const context = this.mediaState.camera ? "camera" : this.mediaState.screen ? "screen" : "general";
      this.simulateResponse(context);
    }
  }

  sendFrame(frameBase64: string): void {
    if (!this.config) return;
    this.frameCount++;

    // In mock mode, respond to every ~10th frame to simulate periodic analysis
    // Real implementation: send frame to vision model for analysis
    if (this.frameCount % 10 === 0) {
      setTimeout(() => {
        const response = this.getResponse(VISUAL_ANALYSIS_RESPONSES);
        this.emitAIMessage(response);
      }, 800 + Math.random() * 600);
    }
  }

  setMediaState(state: { camera?: boolean; screen?: boolean; mic?: boolean }): void {
    const prev = { ...this.mediaState };
    Object.assign(this.mediaState, state);

    if (!this.config) return;

    // Announce mode changes
    if (state.camera && !prev.camera) {
      setTimeout(() => this.simulateResponse("camera"), 1200);
    }
    if (state.screen && !prev.screen) {
      setTimeout(() => this.simulateResponse("screen"), 1200);
    }
  }

  getStatus(): LiveSessionStatus {
    return this.status;
  }

  // --- Private helpers ---

  private emitAIMessage(text: string): void {
    this.config?.onMessage({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "ai",
      text,
      timestamp: Date.now(),
    });
  }

  private getResponse(pool: string[]): string {
    const idx = this.responseIndex % pool.length;
    this.responseIndex++;
    return pool[idx];
  }

  private simulateResponse(context: "camera" | "screen" | "general"): void {
    const pool =
      context === "camera"
        ? CAMERA_RESPONSES
        : context === "screen"
          ? SCREEN_RESPONSES
          : GENERAL_RESPONSES;

    const delay = 1000 + Math.random() * 800;
    setTimeout(() => {
      this.emitAIMessage(this.getResponse(pool));
    }, delay);
  }

  private startSpeakingSimulation(): void {
    this.speakingInterval = setInterval(() => {
      if (this.mediaState.mic) {
        this.config?.onSpeakingChange(true);
        setTimeout(() => this.config?.onSpeakingChange(false), 800);
      }
    }, 2400);
  }

  private stopSpeakingSimulation(): void {
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }
  }
}
