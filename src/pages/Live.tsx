import { motion } from "framer-motion";
import { X, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BARS = 40;

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

  useEffect(() => {
    const interval = setInterval(() => setSpeaking((s) => !s), 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-between py-8 px-6 bg-background"
    >
      {/* Top bar */}
      <div className="w-full flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <X size={18} className="text-foreground/70" />
        </motion.button>
        <span className="text-muted-foreground text-xs font-mono">{formatTime(elapsed)}</span>
        <div className="w-10" />
      </div>

      {/* Status */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <motion.p
          animate={{ opacity: speaking ? 1 : 0.5 }}
          className="text-[18px] font-medium text-foreground text-center"
        >
          {speaking ? "Seven is speaking…" : "Listening…"}
        </motion.p>

        {/* Waveform */}
        <div className="flex items-center justify-center gap-[3px] h-16">
          {Array.from({ length: BARS }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: speaking
                  ? [4, Math.random() * 48 + 8, 4]
                  : [4, Math.random() * 12 + 4, 4],
              }}
              transition={{
                duration: speaking ? 0.4 + Math.random() * 0.3 : 1.2 + Math.random() * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.02,
              }}
              className="w-[3px] rounded-full bg-primary"
              style={{ minHeight: 4 }}
            />
          ))}
        </div>

        {/* Transcript */}
        <motion.div
          animate={{ opacity: speaking ? 1 : 0.6 }}
          className="px-5 py-3 rounded-2xl bg-card border border-border max-w-xs text-center"
        >
          <p className="text-foreground/70 text-[14px] leading-relaxed">
            {speaking
              ? "I notice you've been more consistent this week with your morning routine…"
              : "Say something to Seven…"}
          </p>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setMuted(!muted)}
          className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"
        >
          {muted ? <MicOff size={20} className="text-foreground/60" /> : <Mic size={20} className="text-foreground/60" />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/")}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg"
        >
          <div className="w-5 h-5 bg-destructive-foreground rounded-sm" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setSpeakerOff(!speakerOff)}
          className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"
        >
          {speakerOff ? <VolumeX size={20} className="text-foreground/60" /> : <Volume2 size={20} className="text-foreground/60" />}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Live;
