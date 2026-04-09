import { Menu } from "lucide-react";
import SevenLogo from "./SevenLogo";

interface TopNavProps {
  onMenuClick?: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <button onClick={onMenuClick} className="text-foreground/70 p-1 hover:bg-muted rounded-full transition-colors">
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2">
          <SevenLogo size={22} />
          <span className="font-medium text-foreground text-[15px] tracking-tight">Seven</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
          U
        </div>
      </div>
    </div>
  );
};

export default TopNav;
