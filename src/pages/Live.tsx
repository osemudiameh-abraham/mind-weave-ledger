import { motion } from "framer-motion";
import { Keyboard, Mic, MicOff, ScreenShare, Video, VideoOff, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

    const interval = setInterval(() => {
      setSpeaking((current) => !current);
    }, 1600);

    return () => clearInterval(interval);
  }, [alwaysListening, muted]);

  const liveActive = alwaysListening && !muted;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(var(--live-background-deep))] text-[hsl(var(--live-foreground))]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--live-background-deep)) 0%, hsl(var(--live-background)) 100%)",
        }}
      />

      <motion.div
        animate={{
          opacity: liveActive ? (speaking ? [0.32, 0.46, 0.32] : [0.24, 0.34, 0.24]) : [0.08, 0.14, 0.08],
          scale: speaking ? [1, 1.06, 1] : [1, 1.02, 1],
        }}
        transition={{
          duration: speaking ? 1.35 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[999px]"
        style={{
          bottom: "clamp(118px, 17vh, 156px)",
          width: "118%",
          height: "clamp(120px, 20vh, 180px)",
          background:
            "radial-gradient(ellipse 72% 78% at 50% 76%, hsl(var(--live-glow-primary) / 0.9) 0%, hsl(var(--live-glow-secondary) / 0.56) 28%, hsl(var(--live-glow-primary) / 0.18) 54%, transparent 78%)",
          filter: "blur(34px)",
        }}
      />

      <motion.div
        animate={{
          opacity: liveActive ? (speaking ? [0.12, 0.2, 0.12] : [0.08, 0.14, 0.08]) : [0.02, 0.05, 0.02],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: "clamp(180px, 28vh, 240px)",
          background:
            "linear-gradient(180deg, transparent 0%, hsl(var(--live-glow-primary) / 0.08) 52%, hsl(var(--live-glow-primary) / 0.16) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header
          className="px-6"
          style={{
            paddingTop: "clamp(72px, 11vh, 96px)",
            paddingBottom: "24px",
          }}
        >
          <div className="relative flex items-center justify-center">
            <div className="flex items-center gap-2">
              <LiveGlyph size={22} animated={liveActive} className="text-[hsl(var(--live-foreground))]" />
              <span className="text-[17px] font-medium tracking-[-0.02em]">Live</span>
            </div>

            <button
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[hsl(var(--live-foreground))]"
              aria-label="Keyboard"
            >
              <Keyboard size={23} strokeWidth={1.9} />
            </button>
          </div>
        </header>

        <div className="flex-1" />

        <div className="relative z-10 w-full overflow-hidden rounded-t-[44px] border-t border-white/5">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--live-dock) / 0.58) 0%, hsl(var(--live-dock) / 0.82) 16%, hsl(var(--live-background-elevated) / 0.94) 52%, hsl(var(--live-background-elevated)) 100%)",
            }}
          />

          <div
            className="relative px-5"
            style={{
              paddingTop: "clamp(18px, 3.5vh, 28px)",
              paddingBottom: "clamp(24px, 4vh, 36px)",
              minHeight: "clamp(188px, 28vh, 244px)",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.28 }}
              className="mb-6 flex items-center justify-center"
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
                  checked={alwaysListening}
                  onCheckedChange={setAlwaysListening}
                  className="h-[22px] w-[40px] scale-[0.92] data-[state=checked]:bg-primary data-[state=unchecked]:bg-white/15"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.32 }}
              className="flex items-end justify-center gap-3.5"
            >
              <ControlButton
                active={cameraOn}
                label="Toggle camera"
                onClick={() => setCameraOn((value) => !value)}
              >
                {cameraOn ? <Video size={28} strokeWidth={1.8} /> : <VideoOff size={28} strokeWidth={1.8} />}
              </ControlButton>

              <ControlButton
                active={screenShareOn}
                label="Toggle screen share"
                onClick={() => setScreenShareOn((value) => !value)}
              >
                <ScreenShare size={28} strokeWidth={1.8} />
              </ControlButton>

              <ControlButton
                active={!muted}
                label="Toggle microphone"
                onClick={() => setMuted((value) => !value)}
              >
                {muted ? <MicOff size={28} strokeWidth={1.8} /> : <Mic size={28} strokeWidth={1.8} />}
              </ControlButton>

              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => navigate("/home")}
                className="flex items-center justify-center rounded-[28px] bg-destructive text-destructive-foreground"
                style={{
                  width: "clamp(74px, 19vw, 82px)",
                  height: "clamp(66px, 18vw, 74px)",
                }}
                aria-label="End live session"
              >
                <X size={30} strokeWidth={2.45} />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ControlButtonProps {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

const ControlButton = ({ active, label, onClick, children }: ControlButtonProps) => {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="flex items-center justify-center rounded-[28px] text-[hsl(var(--live-foreground))]"
      style={{
        width: "clamp(66px, 17vw, 74px)",
        height: "clamp(66px, 18vw, 74px)",
        background: active ? "hsl(var(--live-control-active))" : "hsl(var(--live-control))",
      }}
      aria-label={label}
    >
      {children}
    </motion.button>
  );
};

export default Live;
