import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, Mic, ScreenShare, Video, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import LiveGlyph from "@/components/live/LiveGlyph";
import { Switch } from "@/components/ui/switch";

const Live = () => {
  const navigate = useNavigate();
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Simulate speaking pulse
  useEffect(() => {
    if (!micOn) {
      setSpeaking(false);
      return;
    }
    const interval = setInterval(() => {
      setSpeaking((c) => !c);
    }, 1600);
    return () => clearInterval(interval);
  }, [micOn]);

  // Simulated transcript for demo
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setTranscript([{ speaker: "Seven", text: "Hey there! How can I help?", id: 1 }]);
    }, 2000);
    return () => clearTimeout(timer1);
  }, []);

  const active = micOn;

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

      {/* Aurora glow — Gemini style */}
      <motion.div
        animate={{
          opacity: active
            ? speaking
              ? [0.35, 0.55, 0.35]
              : [0.25, 0.38, 0.25]
            : [0.06, 0.1, 0.06],
          scaleX: speaking ? [1, 1.04, 1] : [1, 1.01, 1],
        }}
        transition={{
          duration: speaking ? 1.4 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute left-0 right-0"
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
          opacity: active
            ? speaking
              ? [0.08, 0.16, 0.08]
              : [0.04, 0.1, 0.04]
            : [0.01, 0.03, 0.01],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: "clamp(220px, 36vh, 320px)",
          background:
            "linear-gradient(180deg, transparent 0%, hsl(var(--live-glow-primary) / 0.06) 40%, hsl(var(--live-glow-primary) / 0.14) 100%)",
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 px-6"
        style={{ paddingTop: "clamp(54px, 8vh, 72px)", paddingBottom: "16px" }}
      >
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2">
            <LiveGlyph size={22} animated={active} className="text-[hsl(var(--live-foreground))]" />
            <span className="text-[17px] font-medium tracking-[-0.02em]">Live</span>
          </div>

          <button
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[hsl(var(--live-foreground))]"
            aria-label="Keyboard"
          >
            <Keyboard size={23} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {/* Transcript area */}
      <div className="relative z-10 flex flex-1 flex-col justify-end px-6 pb-8">
        <AnimatePresence mode="popLayout">
          {transcript.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mb-3"
            >
              <p className="text-[15px] leading-relaxed text-[hsl(var(--live-foreground))]">
                <span className="font-medium text-[hsl(var(--live-foreground-muted))]">
                  {entry.speaker}:
                </span>{" "}
                {entry.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom controls — flat, no dock */}
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
          onClick={() => setCameraOn((v) => !v)}
        >
          <Video size={26} strokeWidth={1.8} />
        </ControlButton>

        <ControlButton
          active={screenShareOn}
          label="Toggle screen share"
          onClick={() => setScreenShareOn((v) => !v)}
        >
          <ScreenShare size={26} strokeWidth={1.8} />
        </ControlButton>

        <ControlButton
          active={micOn}
          label="Toggle microphone"
          onClick={() => setMicOn((v) => !v)}
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
