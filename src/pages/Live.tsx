import { motion } from "framer-motion";
import { X, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const WAVEFORM_BARS = 48;

const Live = () => {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speaking, setSpeaking] = useState(false);
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
      setTranscript("I notice you've been more consistent this week with your morning routine. Your energy scores have also improved.");
      
      const timeout1 = setTimeout(() => {
        setSpeaking(false);
        setStatusText("Listening…");
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
  }, []);

  const formatTime = useCallback(
    (s: number) =>
      `${Math.floor(s / 60)
        .toString()
        .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`,
    []
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#1a1a2e] relative overflow-hidden">
      {/* Subtle ambient gradient */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-primary/3 blur-[100px]" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/home")}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X size={20} className="text-white/80" />
        </motion.button>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/60 text-[13px] font-mono tracking-wider">
            {formatTime(elapsed)}
          </span>
        </div>

        <div className="w-10" />
      </div>

      {/* Camera preview (when enabled) */}
      {cameraOn && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 mx-5 mt-2 mb-4"
        >
          <div className="w-full aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#2a2a4a] to-[#1a1a3a] border border-white/10 flex items-center justify-center overflow-hidden">
            {/* Simulated camera feed */}
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                <span className="text-white/70 text-[11px] font-medium">Camera</span>
              </div>
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                  <Video size={32} className="text-white/40" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        {/* Status */}
        <motion.div
          animate={{ opacity: 1 }}
          className="mb-8 text-center"
        >
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white text-[20px] font-normal tracking-[-0.01em]"
          >
            {statusText}
          </motion.p>
        </motion.div>

        {/* Waveform visualization */}
        <div className="flex items-center justify-center gap-[2.5px] h-20 mb-8">
          {Array.from({ length: WAVEFORM_BARS }).map((_, i) => {
            const center = WAVEFORM_BARS / 2;
            const distFromCenter = Math.abs(i - center) / center;
            const maxHeight = speaking ? 64 - distFromCenter * 40 : 12 - distFromCenter * 6;

            return (
              <motion.div
                key={i}
                animate={{
                  height: speaking
                    ? [
                        4,
                        Math.max(8, maxHeight * (0.5 + Math.random() * 0.5)),
                        4,
                        Math.max(6, maxHeight * (0.3 + Math.random() * 0.7)),
                        4,
                      ]
                    : [4, Math.max(4, 8 - distFromCenter * 6), 4],
                }}
                transition={{
                  duration: speaking ? 0.6 + Math.random() * 0.4 : 2 + Math.random() * 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.015,
                }}
                className="w-[3px] rounded-full"
                style={{
                  background: speaking
                    ? `linear-gradient(180deg, hsl(220, 82%, 65%) 0%, hsl(220, 82%, 46%) 100%)`
                    : "rgba(255,255,255,0.25)",
                  minHeight: 4,
                }}
              />
            );
          })}
        </div>

        {/* Transcript bubble */}
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-5 py-3.5 rounded-2xl bg-white/8 max-w-xs text-center mb-4"
          >
            <p className="text-white/70 text-[14px] leading-relaxed">{transcript}</p>
          </motion.div>
        )}

        {/* Listening indicator */}
        {!speaking && !transcript && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            className="text-white/40 text-[14px] mb-4"
          >
            Say something to get started…
          </motion.div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 pb-10 pt-4">
        <div className="flex items-center justify-center gap-5">
          {/* Mic toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMuted(!muted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              muted ? "bg-white/20" : "bg-white/10"
            }`}
          >
            {muted ? (
              <MicOff size={22} className="text-white/70" />
            ) : (
              <Mic size={22} className="text-white/70" />
            )}
          </motion.button>

          {/* End call — red button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/home")}
            className="w-[72px] h-[72px] rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/30"
          >
            <div className="w-6 h-6 bg-white rounded-sm" />
          </motion.button>

          {/* Camera toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCameraOn(!cameraOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              cameraOn ? "bg-primary/30" : "bg-white/10"
            }`}
          >
            {cameraOn ? (
              <Video size={22} className="text-white/70" />
            ) : (
              <VideoOff size={22} className="text-white/70" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Live;
