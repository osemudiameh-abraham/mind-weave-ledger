import { motion } from "framer-motion";

interface GlowOrbProps {
  speaking: boolean;
  listening: boolean;
}

const GlowOrb = ({ speaking, listening }: GlowOrbProps) => {
  return (
    <div className="relative w-[200px] h-[200px] flex items-center justify-center">
      {/* Outermost glow ring */}
      <motion.div
        animate={{
          scale: speaking ? [1, 1.3, 1.15, 1.25, 1] : listening ? [1, 1.1, 1] : 1,
          opacity: speaking ? [0.3, 0.6, 0.4, 0.55, 0.3] : listening ? [0.15, 0.25, 0.15] : 0.1,
        }}
        transition={{
          duration: speaking ? 1.2 : 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-[-30px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(220 82% 60% / 0.3), hsl(262 83% 58% / 0.15), transparent 70%)",
        }}
      />

      {/* Mid glow ring */}
      <motion.div
        animate={{
          scale: speaking ? [1, 1.2, 1.05, 1.18, 1] : listening ? [1, 1.08, 1] : 1,
          opacity: speaking ? [0.4, 0.7, 0.5, 0.65, 0.4] : listening ? [0.2, 0.35, 0.2] : 0.15,
        }}
        transition={{
          duration: speaking ? 0.8 : 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.1,
        }}
        className="absolute inset-[-15px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(220 82% 60% / 0.4), hsl(330 81% 60% / 0.2), transparent 70%)",
        }}
      />

      {/* Main orb with gradient */}
      <motion.div
        animate={{
          scale: speaking ? [1, 1.08, 0.97, 1.05, 1] : listening ? [1, 1.03, 1] : 1,
        }}
        transition={{
          duration: speaking ? 0.6 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative w-full h-full rounded-full overflow-hidden"
      >
        {/* Animated gradient background */}
        <motion.div
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: speaking ? 3 : 8,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute inset-[-20%] rounded-full"
          style={{
            background: speaking
              ? "conic-gradient(from 0deg, hsl(220, 82%, 60%), hsl(262, 83%, 58%), hsl(330, 81%, 60%), hsl(262, 83%, 58%), hsl(220, 82%, 60%))"
              : listening
              ? "conic-gradient(from 0deg, hsl(220, 82%, 50%), hsl(220, 82%, 35%), hsl(262, 83%, 45%), hsl(220, 82%, 35%), hsl(220, 82%, 50%))"
              : "conic-gradient(from 0deg, hsl(220, 82%, 30%), hsl(220, 60%, 25%), hsl(220, 82%, 30%))",
          }}
        />

        {/* Inner shine */}
        <div
          className="absolute inset-[3px] rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15), transparent 60%)",
          }}
        />
      </motion.div>

      {/* Center sparkle icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.svg
          width="36"
          height="28"
          viewBox="0 0 36 28"
          fill="none"
          animate={{
            scale: speaking ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: speaking ? [0.9, 1, 0.9] : [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: speaking ? 0.8 : 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <path
            d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z"
            fill="white"
            fillOpacity="0.9"
          />
        </motion.svg>
      </div>
    </div>
  );
};

export default GlowOrb;
