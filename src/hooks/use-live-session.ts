import { useState, useCallback, useRef, useEffect } from "react";
import type { TranscriptEntry } from "@/components/live/LiveTranscript";

// Simulated AI responses based on context
const CAMERA_RESPONSES = [
  "I can see what's in front of you. Would you like me to analyze anything specific?",
  "Interesting — I'm noticing some details here. Want me to describe what I see?",
  "I can help identify objects, read text, or give feedback on what you're showing me.",
  "Got it. I'm looking at this now. Anything particular you'd like to know?",
  "I see the scene clearly. I can provide context, identify items, or help with decisions.",
];

const SCREEN_SHARE_RESPONSES = [
  "I can see your screen. Want me to help with what you're viewing?",
  "I'm following along with your screen. Ask me anything about what's displayed.",
  "I can read and analyze the content on your screen. What would you like to discuss?",
  "Screen share is active. I can help navigate, explain, or provide feedback on the content.",
];

const GENERAL_RESPONSES = [
  "I'm here and listening. What's on your mind?",
  "Sure, I can help with that. Tell me more.",
  "That's a great question. Let me think about that for you.",
  "I understand. Here's what I'd suggest…",
  "Absolutely — I can walk you through that step by step.",
];

const GREETING = "I'm ready. You can show me something with the camera, share your screen, or just talk.";

export const useLiveSession = () => {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [alwaysListening, setAlwaysListening] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const responseIndexRef = useRef(0);
  const hasGreeted = useRef(false);

  // Simulate speaking pulse
  useEffect(() => {
    if (!micOn || !alwaysListening) {
      setSpeaking(false);
      return;
    }
    const interval = setInterval(() => setSpeaking((c) => !c), 1600);
    return () => clearInterval(interval);
  }, [micOn, alwaysListening]);

  // Greet on mount
  useEffect(() => {
    if (!hasGreeted.current) {
      hasGreeted.current = true;
      setTimeout(() => {
        addAIMessage(GREETING);
      }, 800);
    }
  }, []);

  const addAIMessage = useCallback((text: string) => {
    setTranscript((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, role: "ai", text },
    ]);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setTranscript((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text },
    ]);
  }, []);

  const getResponse = useCallback((pool: string[]) => {
    const idx = responseIndexRef.current % pool.length;
    responseIndexRef.current++;
    return pool[idx];
  }, []);

  const simulateAIResponse = useCallback(
    (context: "camera" | "screen" | "general") => {
      const pool =
        context === "camera"
          ? CAMERA_RESPONSES
          : context === "screen"
            ? SCREEN_SHARE_RESPONSES
            : GENERAL_RESPONSES;

      setTimeout(() => {
        addAIMessage(getResponse(pool));
      }, 1200 + Math.random() * 800);
    },
    [addAIMessage, getResponse],
  );

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      if (next) {
        setScreenShareOn(false);
        setTimeout(() => simulateAIResponse("camera"), 1500);
      }
      return next;
    });
  }, [simulateAIResponse]);

  const toggleScreenShare = useCallback(() => {
    setScreenShareOn((prev) => {
      const next = !prev;
      if (next) {
        setCameraOn(false);
        setTimeout(() => simulateAIResponse("screen"), 1500);
      }
      return next;
    });
  }, [simulateAIResponse]);

  const toggleMic = useCallback(() => {
    setMicOn((v) => !v);
  }, []);

  const sendTextMessage = useCallback(
    (text: string) => {
      addUserMessage(text);
      const context = cameraOn ? "camera" : screenShareOn ? "screen" : "general";
      simulateAIResponse(context);
    },
    [addUserMessage, simulateAIResponse, cameraOn, screenShareOn],
  );

  const handleScreenShareStopped = useCallback(() => {
    setScreenShareOn(false);
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
    toggleCamera,
    toggleScreenShare,
    toggleMic,
    setAlwaysListening,
    setShowTextInput,
    sendTextMessage,
    handleScreenShareStopped,
  };
};
