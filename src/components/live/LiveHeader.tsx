import { motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import LiveGlyph from "@/components/live/LiveGlyph";
import type { LiveSessionStatus } from "@/services/live/types";

interface LiveHeaderProps {
  active: boolean;
  sessionStatus: LiveSessionStatus;
  onToggleTextInput: () => void;
}

const LiveHeader = ({ active, sessionStatus, onToggleTextInput }: LiveHeaderProps) => {
  return (
    <header
      className="relative z-10 px-6 pt-[env(safe-area-inset-top,16px)]"
      style={{ paddingTop: "max(env(safe-area-inset-top, 16px), 16px)", paddingBottom: "16px" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-10" />
        <div className="flex items-center gap-2">
          <LiveGlyph size={22} animated={active} className="text-[hsl(var(--live-foreground))]" />
          <span className="text-[17px] font-medium tracking-[-0.02em]">Live</span>
          {sessionStatus === "connecting" && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="ml-1 text-[11px] text-[hsl(var(--live-foreground-muted))]"
            >
              connecting…
            </motion.span>
          )}
        </div>

        <button
          className="w-10 flex items-center justify-center rounded-full p-1.5 text-[hsl(var(--live-foreground))]"
          aria-label="Keyboard"
          onClick={onToggleTextInput}
        >
          <Keyboard size={23} strokeWidth={1.9} />
        </button>
      </div>
    </header>
  );
};

export default LiveHeader;
