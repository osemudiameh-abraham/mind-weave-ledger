import { motion, AnimatePresence } from "framer-motion";
import { X, Ear } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GlowOrb from "@/components/live/GlowOrb";
import LiveControls from "@/components/live/LiveControls";
import { Switch } from "@/components/ui/switch";

const Live = () => {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [alwaysListening, setAlwaysListening] = useState(false);
  const [statusText, setStatusText] = useState("Listening…");
  const [transcript, setTranscript] = useState("");

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate speaking cycle
  useEffect(() => {
    const cycle = () => {
      setSpeaking(true);
      setStatusText("Seven is speaking");
      setTranscript(
        "I notice you've been more consistent this week with your morning routine. Your energy scores have also improved."
      );

      const timeout1 = setTimeout(() => {
        setSpeaking(false);
        setStatusText(alwaysListening ? "Always listening…" : "Listening…");
        setTranscript("");
      }, 5000);

      return timeout1;
    };

    const initial = setTimeout(() => {
      const t = cycle();
      const interval = setInterval(() => {
        clearTimeout(t);
        cycle();
      }, 8000);
      return () => clearInterval(interval);
    }, 3000);

    return () => clearTimeout(initial);
  }, [alwaysListening]);

  // Update status text when always listening toggles
  useEffect(() => {
    if (!speaking) {
      setStatusText(alwaysListening ? "Always listening…" : "Listening…");
    }
  }, [alwaysListening, speaking]);

  const formatTime = useCallback(
    (s: number) =>
      `${Math.floor(s / 60)
        .toString()
        .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`,
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(220 20% 8%) 0%, hsl(225 25% 12%) 50%, hsl(220 20% 10%) 100%)",
      }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            opacity: speaking ? [0.08, 0.15, 0.08] : [0.03, 0.06, 0.03],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(220 82% 60% / 0.4), hsl(262 83% 58% / 0.2), transparent 70%)",
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/home")}
          className="w-10 h-10 rounded-full bg-white/8 backdrop-blur-sm flex items-center justify-center"
        >
          <X size={20} className="text-white/70" />
        </motion.button>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/50 text-[13px] font-mono tracking-wider">
            {formatTime(elapsed)}
          </span>
        </div>

        <div className="w-10" />
      </div>

      {/* Always Listening toggle */}
      <div className="relative z-10 flex items-center justify-center mt-2 mb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10"
        >
          <Ear size={16} className="text-white/50" />
          <span className="text-[13px] text-white/60 font-medium">Always listening</span>
          <Switch
            checked={alwaysListening}
            onCheckedChange={setAlwaysListening}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-white/20 scale-90"
          />
        </motion.div>
      </div>

      {/* Camera preview */}
      <AnimatePresence>
        {cameraOn && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative z-10 mx-5 mb-4 overflow-hidden"
          >
            <div className="w-full aspect-[4/3] rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/10" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content — orb area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        {/* Status text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-white/90 text-[18px] font-normal tracking-[-0.01em] mb-10"
          >
            {statusText}
          </motion.p>
        </AnimatePresence>

        {/* Glowing orb */}
        <GlowOrb speaking={speaking} listening={!muted} />

        {/* Transcript */}
        <div className="mt-10 min-h-[80px] flex items-start justify-center">
          <AnimatePresence>
            {transcript ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-5 py-3.5 rounded-2xl bg-white/[0.06] backdrop-blur-sm max-w-xs text-center border border-white/[0.06]"
              >
                <p className="text-white/70 text-[14px] leading-relaxed">{transcript}</p>
              </motion.div>
            ) : !speaking ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                className="text-white/40 text-[14px]"
              >
                {alwaysListening ? "I'm always here…" : "Say something to get started…"}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 pb-10 pt-4">
        <LiveControls
          muted={muted}
          cameraOn={cameraOn}
          onToggleMute={() => setMuted(!muted)}
          onToggleCamera={() => setCameraOn(!cameraOn)}
          onEnd={() => navigate("/home")}
        />
      </div>
    </motion.div>
  );
};

export default Live;
