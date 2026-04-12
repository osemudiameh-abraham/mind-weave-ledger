import { useState, useCallback, useRef, useEffect } from "react";
import type { TranscriptEntry } from "@/components/live/LiveTranscript";
import type { LiveService, LiveMessage, LiveSessionStatus } from "@/services/live/types";
import { RealLiveService } from "@/services/live/RealLiveService";

/**
 * Main Live session hook.
 * 
 * Uses a pluggable LiveService backend — currently MockLiveService.
 * To connect your real backend:
 * 1. Implement LiveService interface (see src/services/live/types.ts)
 * 2. Replace MockLiveService with your implementation below
 */
export const useLiveSession = () => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [alwaysListening, setAlwaysListening] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<LiveSessionStatus>("idle");
  const [volumeLevel, setVolumeLevel] = useState(0);

  const serviceRef = useRef<LiveService | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize service on mount
  useEffect(() => {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Phase 4: Real voice service
    // STT: Browser SpeechRecognition
    // LLM: Supabase chat Edge Function
    // TTS: ElevenLabs → browser fallback
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const service = new RealLiveService();
    serviceRef.current = service;

    service.connect({
      onMessage: (msg: LiveMessage) => {
        setTranscript((prev) => [
          ...prev,
          { id: msg.id, role: msg.role, text: msg.text },
        ]);
      },
      onSpeakingChange: setSpeaking,
      onError: (err) => console.error("[LiveSession]", err),
      onStatusChange: setSessionStatus,
    });

    return () => {
      service.disconnect();
    };
  }, []);

  // Sync media state to service
  useEffect(() => {
    serviceRef.current?.setMediaState({
      camera: cameraOn,
      screen: screenShareOn,
      mic: micOn,
    });
  }, [cameraOn, screenShareOn, micOn]);

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      if (next) setScreenShareOn(false);
      return next;
    });
  }, []);

  const toggleScreenShare = useCallback(() => {
    setScreenShareOn((prev) => {
      const next = !prev;
      if (next) setCameraOn(false);
      return next;
    });
  }, []);

  const toggleMic = useCallback(() => {
    setMicOn((v) => !v);
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    serviceRef.current?.sendText(text);
  }, []);

  const handleScreenShareStopped = useCallback(() => {
    setScreenShareOn(false);
  }, []);

  const sendFrame = useCallback((base64: string) => {
    serviceRef.current?.sendFrame(base64);
  }, []);

  const sendAudio = useCallback((data: Float32Array, sampleRate: number) => {
    serviceRef.current?.sendAudio(data, sampleRate);
  }, []);

  const active = alwaysListening && micOn;

  return {
    transcript,
    cameraOn,
    screenShareOn,
    micOn,
    alwaysListening,
    speaking,
    showTextInput,
    active,
    sessionStatus,
    volumeLevel,
    videoRef,
    screenVideoRef,
    toggleCamera,
    toggleScreenShare,
    toggleMic,
    setAlwaysListening,
    setShowTextInput,
    setVolumeLevel,
    sendTextMessage,
    handleScreenShareStopped,
    sendFrame,
    sendAudio,
  };
};
