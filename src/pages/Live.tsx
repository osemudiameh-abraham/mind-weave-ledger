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

    const interval = setInterval(() => {
      setSpeaking((current) => !current);
    }, 1400);

    return () => clearInterval(interval);
  }, [alwaysListening, muted]);

  const liveActive = alwaysListening && !muted;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[hsl(var(--live-background-deep))] text-[hsl(var(--live-foreground))]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, hsl(var(--live-background-deep)) 0%, hsl(var(--live-background)) 100%)",
      }}
    >
      <motion.div
        animate={{
          opacity: liveActive ? [0.7, 1, 0.75] : [0.3, 0.45, 0.3],
          scale: speaking ? [1, 1.06, 1] : [1, 1.02, 1],
        }}
        transition={{ duration: speaking ? 1.2 : 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-[-14%] bottom-[-14%] h-[38%] rounded-[50%]"
        style={{
          background:
            "radial-gradient(60% 90% at 50% 100%, hsl(var(--live-glow-primary) / 0.88) 0%, hsl(var(--live-glow-secondary) / 0.55) 38%, transparent 75%)",
          filter: "blur(18px)",
        }}
      />

      <motion.div
        animate={{ opacity: liveActive ? [0.14, 0.22, 0.14] : [0.06, 0.1, 0.06] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, hsl(var(--live-glow-primary) / 0.12) 60%, hsl(var(--live-glow-primary) / 0.2) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col px-5 pb-10 pt-10">
        <div className="relative mt-8">
          <div className="flex items-center justify-center gap-2 text-[hsl(var(--live-foreground))]">
            <LiveGlyph size={24} animated={liveActive} className="text-[hsl(var(--live-foreground))]" />
            <span className="text-[18px] font-medium tracking-[-0.02em]">Live</span>
          </div>

          <div className="absolute right-0 top-1/2 -translate-y-1/2 rounded-2xl p-2 text-[hsl(var(--live-foreground))]">
            <Keyboard size={24} strokeWidth={2.1} />
          </div>
        </div>

        <div className="flex-1" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          className="mb-4 flex items-center justify-center"
        >
          <div
            className="flex items-center gap-3 rounded-full px-4 py-2 text-[13px]"
            style={{
              background: "hsl(var(--live-background-elevated) / 0.84)",
              color: "hsl(var(--live-foreground-muted))",
              boxShadow: "0 8px 30px hsl(225 22% 8% / 0.28)",
            }}
          >
            <span className="font-medium">Always listening</span>
            <Switch
              checked={alwaysListening}
              onCheckedChange={setAlwaysListening}
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-[hsl(var(--live-control))]"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="mx-auto w-full max-w-[360px] rounded-[34px] px-5 py-5"
          style={{
            background: "linear-gradient(180deg, hsl(var(--live-dock) / 0.88), hsl(var(--live-background-elevated) / 0.96))",
            boxShadow: "0 18px 50px hsl(225 22% 8% / 0.44)",
          }}
        >
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => setCameraOn((value) => !value)}
              className="flex h-[74px] items-center justify-center rounded-[28px] transition-transform active:scale-95"
              style={{ background: cameraOn ? "hsl(var(--live-control-active))" : "hsl(var(--live-control))" }}
              aria-label="Toggle camera"
            >
              {cameraOn ? <Video size={30} /> : <VideoOff size={30} />}
            </button>

            <button
              onClick={() => setScreenShareOn((value) => !value)}
              className="flex h-[74px] items-center justify-center rounded-[28px] transition-transform active:scale-95"
              style={{ background: screenShareOn ? "hsl(var(--live-control-active))" : "hsl(var(--live-control))" }}
              aria-label="Toggle screen share"
            >
              <ScreenShare size={30} />
            </button>

            <button
              onClick={() => setMuted((value) => !value)}
              className="flex h-[74px] items-center justify-center rounded-[28px] transition-transform active:scale-95"
              style={{ background: muted ? "hsl(var(--live-control-active))" : "hsl(var(--live-control))" }}
              aria-label="Toggle microphone"
            >
              {muted ? <MicOff size={30} /> : <Mic size={30} />}
            </button>

            <button
              onClick={() => navigate("/home")}
              className="flex h-[74px] items-center justify-center rounded-[28px] bg-destructive text-destructive-foreground transition-transform active:scale-95"
              aria-label="End live session"
            >
              <X size={34} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Live;
