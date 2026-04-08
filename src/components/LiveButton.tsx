import { motion } from "framer-motion";

interface LiveButtonProps {
  onClick: () => void;
}

const LiveButton = ({ onClick }: LiveButtonProps) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="relative w-14 h-14 flex items-center justify-center"
    >
      {/* Outer pulse ring */}
      <div className="absolute inset-0 rounded-full gradient-border animate-pulse-ring opacity-40" />
      
      {/* Spinning gradient border */}
      <div className="absolute inset-0 rounded-full animate-gradient-spin p-[2.5px]">
        <div className="gradient-border w-full h-full rounded-full" />
      </div>
      
      {/* Inner circle */}
      <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
        {/* Inner gradient dot */}
        <div className="w-5 h-5 rounded-full gradient-bg animate-breathe" />
      </div>
    </motion.button>
  );
};

export default LiveButton;
