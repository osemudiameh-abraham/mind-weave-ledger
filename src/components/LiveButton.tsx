import { motion } from "framer-motion";

interface LiveButtonProps {
  onClick: () => void;
}

const LiveButton = ({ onClick }: LiveButtonProps) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="relative w-[52px] h-[52px] flex items-center justify-center"
    >
      {/* Outer pulse glow */}
      <div className="absolute inset-[-4px] rounded-full animate-pulse-ring opacity-30">
        <div className="w-full h-full rounded-full gradient-bg blur-sm" />
      </div>

      {/* Spinning gradient ring */}
      <div className="absolute inset-0 rounded-full animate-gradient-spin p-[2.5px]">
        <div className="gradient-border w-full h-full rounded-full" />
      </div>

      {/* Inner white/dark circle */}
      <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
        {/* Gemini sparkle icon inside */}
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <path d="M14 0C14 7.732 7.732 14 0 14c7.732 0 14 6.268 14 14 0-7.732 6.268-14 14-14-7.732 0-14-6.268-14-14z" fill="url(#livesparkle)"/>
          <defs>
            <linearGradient id="livesparkle" x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="hsl(217, 91%, 60%)" />
              <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
              <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </motion.button>
  );
};

export default LiveButton;
