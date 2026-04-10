import { motion } from "framer-motion";
import LiveGlyph from "@/components/live/LiveGlyph";

interface LiveButtonProps {
  onClick: () => void;
}

const LiveButton = ({ onClick }: LiveButtonProps) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      aria-label="Open live mode"
      className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[hsl(var(--live-trigger))] text-[hsl(var(--live-trigger-foreground))]"
      style={{
        boxShadow: "0 8px 24px hsl(220 20% 16% / 0.08)",
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.18), transparent 58%)",
        }}
      />
      <div className="relative z-10 flex items-center justify-center">
        <LiveGlyph size={24} animated />
      </div>
    </motion.button>
  );
};

export default LiveButton;
