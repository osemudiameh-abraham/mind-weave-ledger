import { motion } from "framer-motion";
import { Keyboard, Mic, ScreenShare, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LiveGlyph from "@/components/live/LiveGlyph";
import LiveVideoFeed from "@/components/live/LiveVideoFeed";
import LiveScreenShare from "@/components/live/LiveScreenShare";
import LiveTranscript from "@/components/live/LiveTranscript";
import LiveTextInput from "@/components/live/LiveTextInput";
import { Switch } from "@/components/ui/switch";
import { useLiveSession } from "@/hooks/use-live-session";
import type { ReactNode } from "react";

const Live = () => {
  const navigate = useNavigate();
  const session = useLiveSession();

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
      <LiveVideoFeed active={session.cameraOn} />

      {/* Screen share feed */}
      <LiveScreenShare
        active={session.screenShareOn}
        onStopped={session.handleScreenShareStopped}
      />

      {/* Aurora glow */}
      <motion.div
        animate={{
          opacity: session.active
            ? session.speaking
              ? [0.35, 0.55, 0.35]
              : [0.25, 0.38, 0.25]
            : [0.06, 0.1, 0.06],
          scaleX: session.speaking ? [1, 1.04, 1] : [1, 1.01, 1],
        }}
        transition={{
          duration: session.speaking ? 1.4 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute left-0 right-0 z-[6]"
        style={{
          bottom: "80px",
          height: "clamp(160px, 26vh, 220px)",
          background:
            "radial-gradient(ellipse 90% 100% at 50% 90%, hsl(var(--live-glow-primary) / 0.85) 0%, hsl(var(--live-glow-secondary) / 0.5) 30%, hsl(var(--live-glow-primary) / 0.15) 60%, transparent 85%)",
          filter: "blur(40px)",
        }}
      />

      {/* Soft upper reflection */}
      <motion.div
        animate={{
          opacity: session.active
            ? session.speaking
              ? [0.08, 0.16, 0.08]
              : [0.04, 0.1, 0.04]
            : [0.01, 0.03, 0.01],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[6]"
        style={{
          height: "clamp(220px, 36vh, 320px)",
          background:
            "linear-gradient(180deg, transparent 0%, hsl(var(--live-glow-primary) / 0.06) 40%, hsl(var(--live-glow-primary) / 0.14) 100%)",
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 px-6 pt-[env(safe-area-inset-top,16px)]"
        style={{ paddingTop: "max(env(safe-area-inset-top, 16px), 16px)", paddingBottom: "16px" }}
      >
        <div className="flex items-center justify-between">
          <div className="w-10" />
          <div className="flex items-center gap-2">
            <LiveGlyph size={22} animated={session.active} className="text-[hsl(var(--live-foreground))]" />
            <span className="text-[17px] font-medium tracking-[-0.02em]">Live</span>
          </div>

          <button
            className="w-10 flex items-center justify-center rounded-full p-1.5 text-[hsl(var(--live-foreground))]"
            aria-label="Keyboard"
            onClick={() => session.setShowTextInput((v) => !v)}
          >
            <Keyboard size={23} strokeWidth={1.9} />
          </button>
        </div>
      </header>

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="relative z-10 flex items-center justify-center gap-3.5 px-6"
        style={{ paddingBottom: "clamp(32px, 5vh, 48px)" }}
      >
        <ControlButton
          active={session.cameraOn}
          label="Toggle camera"
          onClick={session.toggleCamera}
        >
          <Video size={26} strokeWidth={1.8} />
        </ControlButton>

        <ControlButton
          active={session.screenShareOn}
          label="Toggle screen share"
          onClick={session.toggleScreenShare}
        >
          <ScreenShare size={26} strokeWidth={1.8} />
        </ControlButton>

        <ControlButton
          active={session.micOn}
          label="Toggle microphone"
          onClick={session.toggleMic}
        >
          <Mic size={26} strokeWidth={1.8} />
        </ControlButton>

        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => navigate("/home")}
          className="flex items-center justify-center rounded-2xl bg-destructive text-destructive-foreground"
          style={{
            width: "clamp(68px, 17vw, 76px)",
            height: "clamp(56px, 15vw, 64px)",
          }}
          aria-label="End live session"
        >
          <X size={28} strokeWidth={2.4} />
        </motion.button>
      </motion.div>
    </div>
  );
};

interface ControlButtonProps {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

const ControlButton = ({ active, label, onClick, children }: ControlButtonProps) => (
  <motion.button
    whileTap={{ scale: 0.94 }}
    onClick={onClick}
    className="flex items-center justify-center rounded-2xl text-[hsl(var(--live-foreground))]"
    style={{
      width: "clamp(60px, 15vw, 68px)",
      height: "clamp(56px, 15vw, 64px)",
      background: active ? "hsl(var(--live-control-active))" : "hsl(var(--live-control))",
    }}
    aria-label={label}
  >
    {children}
  </motion.button>
);

export default Live;
