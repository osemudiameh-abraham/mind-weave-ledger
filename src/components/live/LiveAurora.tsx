import { motion } from "framer-motion";

interface LiveAuroraProps {
  active: boolean;
  speaking: boolean;
  volumeLevel: number;
}

/**
 * Ambient aurora glow effect that responds to voice activity.
 * Intensifies when speaking/volume is detected.
 */
const LiveAurora = ({ active, speaking, volumeLevel }: LiveAuroraProps) => {
  const glowIntensity = Math.min(1, volumeLevel * 3);

  return (
    <>
      {/* Main aurora glow */}
      <motion.div
        animate={{
          opacity: active
            ? speaking
              ? [0.35 + glowIntensity * 0.2, 0.55 + glowIntensity * 0.15, 0.35 + glowIntensity * 0.2]
              : [0.25, 0.38, 0.25]
            : [0.06, 0.1, 0.06],
          scaleX: speaking ? [1, 1.04, 1] : [1, 1.01, 1],
        }}
        transition={{
          duration: speaking ? 1.4 : 3.2,
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
          opacity: active
            ? speaking
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
    </>
  );
};

export default LiveAurora;
