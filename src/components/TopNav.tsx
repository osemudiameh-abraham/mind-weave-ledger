import { Menu } from "lucide-react";
import { motion } from "framer-motion";

interface TopNavProps {
  onMenuClick?: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 glass-surface border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <button onClick={onMenuClick} className="text-muted-foreground p-1">
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full gradient-bg animate-breathe" />
          <span className="font-semibold text-foreground text-sm tracking-tight">Seven Mynd</span>
        </div>

        <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground text-xs font-semibold">
          U
        </div>
      </div>
    </div>
  );
};

export default TopNav;
