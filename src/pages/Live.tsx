import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { useLiveSession } from "@/hooks/use-live-session";
import { useFrameCapture } from "@/hooks/use-frame-capture";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import LiveVideoFeed from "@/components/live/LiveVideoFeed";
import LiveScreenShare from "@/components/live/LiveScreenShare";
import LiveTranscript from "@/components/live/LiveTranscript";
import LiveTextInput from "@/components/live/LiveTextInput";
import LiveHeader from "@/components/live/LiveHeader";
import LiveControls from "@/components/live/LiveControls";
import LiveAurora from "@/components/live/LiveAurora";
import { useAlwaysListening } from "@/contexts/AlwaysListeningContext";
import { motion } from "framer-motion";
import { useRef, useEffect } from "react";

const Live = () => {
  const navigate = useNavigate();
  const session = useLiveSession();
  const { setIsInLiveSession } = useAlwaysListening();

  // Tell the global always-listening system to pause while Live is active
  // (Live has its own mic handling)
  useEffect(() => {
    setIsInLiveSession(true);
    return () => setIsInLiveSession(false);
  }, [setIsInLiveSession]);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Frame capture: sends video frames to the service for visual analysis
  useFrameCapture({
    videoRef: cameraVideoRef,
    active: session.cameraOn,
    intervalMs: 2000,
    onFrame: session.sendFrame,
  });

  useFrameCapture({
    videoRef: screenVideoRef,
    active: session.screenShareOn,
    intervalMs: 3000,
    onFrame: session.sendFrame,
  });

  // Audio capture: feeds raw PCM audio to RealLiveService for Deepgram STT.
  // Active when mic is on AND the voice-stt WebSocket is connected.
  // The service converts Float32 → Int16 and sends to the Deepgram proxy.
  // Volume levels drive the LiveAurora waveform visualization.
  useAudioCapture({
    active: session.micOn && session.sessionStatus === "connected",
    onAudioData: session.sendAudio,
    onVolumeLevel: session.setVolumeLevel,
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[hsl(var(--live-background-deep))] text-[hsl(var(--live-foreground))]">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--live-background-deep)) 0%, hsl(var(--live-background)) 100%)",
        }}
      />

      {/* Camera feed */}
      <LiveVideoFeed
        active={session.cameraOn}
        videoRef={cameraVideoRef}
      />

      {/* Screen share feed */}
      <LiveScreenShare
        active={session.screenShareOn}
        onStopped={session.handleScreenShareStopped}
        videoRef={screenVideoRef}
      />

      {/* Aurora glow */}
      <LiveAurora
        active={session.active}
        speaking={session.speaking}
        volumeLevel={session.volumeLevel}
      />

      {/* Header */}
      <LiveHeader
        active={session.active}
        sessionStatus={session.sessionStatus}
        onToggleTextInput={() => session.setShowTextInput((v) => !v)}
      />

      {/* Transcript overlay */}
      <LiveTranscript entries={session.transcript} visible />

      {/* Center spacer */}
      <div className="relative z-10 flex-1" />

      {/* Text input */}
      <LiveTextInput
        visible={session.showTextInput}
        onSend={session.sendTextMessage}
        onClose={() => session.setShowTextInput(false)}
      />

      {/* Always listening toggle */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.28 }}
        className="relative z-10 mb-6 flex items-center justify-center"
      >
        <div
          className="flex items-center gap-3 rounded-full px-4 py-2"
          style={{
            background: "hsl(var(--live-background-elevated) / 0.88)",
            boxShadow: "0 8px 24px hsl(var(--live-background-deep) / 0.18)",
          }}
        >
          <span className="text-[12px] font-medium text-[hsl(var(--live-foreground-muted))]">
            Always listening
          </span>
          <Switch
            checked={session.alwaysListening}
            onCheckedChange={session.setAlwaysListening}
            className="h-[22px] w-[40px] scale-[0.92] data-[state=checked]:bg-primary data-[state=unchecked]:bg-white/15"
          />
        </div>
      </motion.div>

      {/* Bottom controls */}
      <LiveControls
        cameraOn={session.cameraOn}
        screenShareOn={session.screenShareOn}
        micOn={session.micOn}
        volumeLevel={session.volumeLevel}
        onToggleCamera={session.toggleCamera}
        onToggleScreenShare={session.toggleScreenShare}
        onToggleMic={session.toggleMic}
        onEnd={() => navigate("/home")}
      />
    </div>
  );
};

export default Live;
