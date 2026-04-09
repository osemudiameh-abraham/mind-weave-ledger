import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SevenLogo from "./SevenLogo";

interface TopNavProps {
  onMenuClick?: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const navigate = useNavigate();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background">
      <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
        <button
          onClick={onMenuClick}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Menu size={22} className="text-foreground/70" />
        </button>

        <button
          onClick={() => navigate("/home")}
          className="flex items-center gap-2"
        >
          <SevenLogo size={20} />
          <span className="font-medium text-foreground text-[16px] tracking-tight">Seven</span>
        </button>

        <button
          onClick={() => navigate("/settings")}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[13px] font-medium">
            U
          </div>
        </button>
      </div>
    </div>
  );
};

export default TopNav;
