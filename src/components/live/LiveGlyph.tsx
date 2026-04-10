import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LiveGlyphProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

const LiveGlyph = ({ size = 24, animated = false, className = "" }: LiveGlyphProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <motion.rect
        x="4"
        y="9.5"
        width="2.75"
        height="7"
        rx="1.375"
        fill="currentColor"
        animate={animated ? { y: [9.5, 8.2, 9.5], height: [7, 9.6, 7] } : undefined}
        transition={animated ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <motion.rect
        x="9.15"
        y="6.5"
        width="2.75"
        height="11"
        rx="1.375"
        fill="currentColor"
        animate={animated ? { y: [6.5, 5.3, 6.5], height: [11, 13.2, 11] } : undefined}
        transition={animated ? { duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.12 } : undefined}
      />
      <motion.rect
        x="14.3"
        y="8"
        width="2.75"
        height="8.5"
        rx="1.375"
        fill="currentColor"
        animate={animated ? { y: [8, 6.9, 8], height: [8.5, 10.8, 8.5] } : undefined}
        transition={animated ? { duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.24 } : undefined}
      />
      <motion.path
        d="M18.9 2.2C18.9 3.6 17.95 4.35 17.15 4.7C17.95 5.05 18.9 5.8 18.9 7.2C18.9 5.8 19.85 5.05 20.65 4.7C19.85 4.35 18.9 3.6 18.9 2.2Z"
        fill="currentColor"
        animate={animated ? { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] } : undefined}
        transition={animated ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
        style={{ transformOrigin: "18.9px 4.7px" }}
      />
    </svg>
  );
};

export default LiveGlyph;
