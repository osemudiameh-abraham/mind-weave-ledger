import { motion } from "framer-motion";
import { Mic, ScreenShare, Video, X } from "lucide-react";
import type { ReactNode } from "react";

interface LiveControlsProps {
  cameraOn: boolean;
  screenShareOn: boolean;
  micOn: boolean;
  volumeLevel: number;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}

const LiveControls = ({
  cameraOn,
  screenShareOn,
  micOn,
  volumeLevel,
  onToggleCamera,
  onToggleScreenShare,
  onToggleMic,
  onEnd,
}: LiveControlsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
      className="relative z-10 flex items-center justify-center gap-3.5 px-6"
      style={{ paddingBottom: "clamp(32px, 5vh, 48px)" }}
    >
      <ControlButton
        active={cameraOn}
        label="Toggle camera"
        onClick={onToggleCamera}
      >
        <Video size={26} strokeWidth={1.8} />
      </ControlButton>

      <ControlButton
        active={screenShareOn}
        label="Toggle screen share"
        onClick={onToggleScreenShare}
      >
        <ScreenShare size={26} strokeWidth={1.8} />
      </ControlButton>

      <ControlButton
        active={micOn}
        label="Toggle microphone"
        onClick={onToggleMic}
      >
        <Mic size={26} strokeWidth={1.8} />
        {/* Volume indicator ring */}
        {micOn && volumeLevel > 0.05 && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-[hsl(var(--live-glow-primary))]"
            animate={{ opacity: [0.6, 0.2, 0.6], scale: [1, 1.06, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </ControlButton>

      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onEnd}
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
    className="relative flex items-center justify-center rounded-2xl text-[hsl(var(--live-foreground))]"
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

export default LiveControls;
