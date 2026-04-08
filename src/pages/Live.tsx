import { motion } from "framer-motion";
import { X, Mic, MicOff, Volume2, VolumeX, Square } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Live = () => {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate speaking toggling
  useEffect(() => {
    const interval = setInterval(() => setSpeaking((s) => !s), 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-between py-8 px-6"
      style={{ background: "linear-gradient(180deg, hsl(220 20% 8%) 0%, hsl(250 30% 12%) 50%, hsl(220 20% 8%) 100%)" }}
    >
      {/* Top bar */}
      <div className="w-full flex items-center justify-between">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <X size={18} className="text-white/80" />
        </motion.button>
        <span className="text-white/50 text-xs font-mono">{formatTime(elapsed)}</span>
      </div>

      {/* Orb */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          {/* Outer glow */}
          <motion.div
            animate={{ scale: speaking ? [1, 1.2, 1] : [1, 1.05, 1], opacity: speaking ? [0.3, 0.6, 0.3] : [0.15, 0.3, 0.15] }}
            transition={{ duration: speaking ? 0.8 : 3, repeat: Infinity }}
            className="absolute -inset-8 rounded-full gradient-bg blur-3xl"
          />

          {/* Main orb */}
          <motion.div
            animate={{
              scale: speaking ? [1, 1.12, 0.95, 1.08, 1] : [1, 1.03, 1],
              borderRadius: speaking
                ? ["60% 40% 30% 70% / 60% 30% 70% 40%", "30% 60% 70% 40% / 50% 60% 30% 60%", "50% 60% 30% 60% / 60% 40% 60% 40%", "60% 40% 60% 30% / 40% 50% 60% 50%", "60% 40% 30% 70% / 60% 30% 70% 40%"]
                : ["60% 40% 30% 70% / 60% 30% 70% 40%", "50% 60% 30% 60% / 60% 40% 60% 40%", "60% 40% 30% 70% / 60% 30% 70% 40%"],
            }}
            transition={{ duration: speaking ? 1.5 : 8, repeat: Infinity, ease: "easeInOut" }}
            className="w-40 h-40 gradient-bg relative overflow-hidden"
            style={{ boxShadow: "0 0 60px 20px hsla(246, 60%, 55%, 0.3)" }}
          >
            {/* Inner shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10" />
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />
          </motion.div>
        </div>
      </div>

      {/* Transcript */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: speaking ? 1 : 0.5 }}
        className="mb-8 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-lg max-w-xs text-center"
      >
        <p className="text-white/70 text-sm">
          {speaking ? "I notice you've been more consistent this week…" : "Listening…"}
        </p>
      </motion.div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMuted(!muted)}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          {muted ? <MicOff size={20} className="text-white/70" /> : <Mic size={20} className="text-white/70" />}
        </motion.button>

        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/")}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg">
          <Square size={20} className="text-destructive-foreground" fill="currentColor" />
        </motion.button>

        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSpeakerOff(!speakerOff)}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          {speakerOff ? <VolumeX size={20} className="text-white/70" /> : <Volume2 size={20} className="text-white/70" />}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Live;
