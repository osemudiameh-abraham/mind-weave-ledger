import { motion } from "framer-motion";
import { Keyboard, Mic, MicOff, ScreenShare, Video, VideoOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LiveGlyph from "@/components/live/LiveGlyph";
import { Switch } from "@/components/ui/switch";

const Live = () => {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [alwaysListening, setAlwaysListening] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!alwaysListening || muted) {
      setSpeaking(false);
      return;
    }
    const interval = setInterval(() => setSpeaking((c) => !c), 1400);
    return () => clearInterval(interval);
  }, [alwaysListening, muted]);

  const active = alwaysListening && !muted;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "hsl(224, 22%, 8%)" }}>
      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-center px-5 pt-12 pb-3">
        <div className="flex items-center gap-1.5">
          <LiveGlyph size={20} animated={active} className="text-white" />
          <span className="text-[17px] font-medium text-white tracking-[-0.01em]">Live</span>
        </div>
        <button
          className="absolute right-5 top-12 p-1 text-white/70"
          aria-label="Keyboard"
        >
          <Keyboard size={22} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Glow band ── */}
      <div className="relative z-0 mx-5 mb-5">
        {/* Primary bright glow pill */}
        <motion.div
          animate={{
            opacity: active ? (speaking ? [0.85, 1, 0.85] : [0.6, 0.8, 0.6]) : [0.2, 0.3, 0.2],
            scaleX: speaking ? [1, 1.02, 1] : [1, 1.005, 1],
            scaleY: speaking ? [1, 1.15, 1] : [1, 1.04, 1],
          }}
          transition={{
            duration: speaking ? 1.2 : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="h-[72px] w-full rounded-[36px]"
          style={{
            background: "linear-gradient(90deg, hsl(213, 80%, 52%) 0%, hsl(220, 84%, 58%) 40%, hsl(220, 84%, 55%) 60%, hsl(213, 80%, 52%) 100%)",
            boxShadow: active
              ? "0 0 60px 10px hsl(220, 84%, 55% / 0.5), 0 0 120px 30px hsl(220, 84%, 55% / 0.25)"
              : "0 0 40px 8px hsl(220, 84%, 55% / 0.2)",
          }}
        />
        {/* Soft diffused glow behind */}
        <motion.div
          animate={{
            opacity: active ? [0.3, 0.5, 0.3] : [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -inset-x-4 -top-10 -bottom-4 rounded-[48px]"
          style={{
            background: "radial-gradient(ellipse 100% 80% at 50% 60%, hsl(220, 84%, 55% / 0.35), transparent 70%)",
            filter: "blur(20px)",
            zIndex: -1,
          }}
        />
      </div>

      {/* ── Always listening toggle ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-center mb-5"
      >
        <div
          className="flex items-center gap-3 rounded-full px-4 py-2"
          style={{ background: "hsl(224, 18%, 14% / 0.9)" }}
        >
          <span className="text-[13px] font-medium text-white/60">Always listening</span>
          <Switch
            checked={alwaysListening}
            onCheckedChange={setAlwaysListening}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-white/15 h-[22px] w-[40px]"
          />
        </div>
      </motion.div>

      {/* ── Controls dock ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="flex items-center justify-center gap-[10px] px-5 pb-10"
      >
        <ControlButton
          active={cameraOn}
          onClick={() => setCameraOn((v) => !v)}
          label="Camera"
        >
          {cameraOn ? <Video size={26} strokeWidth={1.8} /> : <VideoOff size={26} strokeWidth={1.8} />}
        </ControlButton>

        <ControlButton
          active={screenShareOn}
          onClick={() => setScreenShareOn((v) => !v)}
          label="Screen share"
        >
          <ScreenShare size={26} strokeWidth={1.8} />
        </ControlButton>

        <ControlButton
          active={!muted}
          onClick={() => setMuted((v) => !v)}
          label="Microphone"
        >
          {muted ? <MicOff size={26} strokeWidth={1.8} /> : <Mic size={26} strokeWidth={1.8} />}
        </ControlButton>

        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => navigate("/home")}
          className="flex h-[66px] flex-1 items-center justify-center rounded-[24px] bg-destructive text-white"
          aria-label="End session"
        >
          <X size={30} strokeWidth={2.5} />
        </motion.button>
      </motion.div>
    </div>
  );
};

/* ── Reusable control button ── */
interface ControlButtonProps {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

const ControlButton = ({ active, onClick, label, children }: ControlButtonProps) => (
  <motion.button
    whileTap={{ scale: 0.93 }}
    onClick={onClick}
    className="flex h-[60px] w-[68px] items-center justify-center rounded-[22px] text-white transition-colors"
    style={{
      background: active ? "hsl(220, 28%, 26%)" : "hsl(220, 20%, 18%)",
    }}
    aria-label={label}
  >
    {children}
  </motion.button>
);

export default Live;
