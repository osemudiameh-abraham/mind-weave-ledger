import { Menu } from "lucide-react";

interface TopNavProps {
  onMenuClick?: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <button onClick={onMenuClick} className="text-foreground p-1">
          <Menu size={24} />
        </button>

        <div className="flex items-center gap-1.5">
          {/* Gemini sparkle icon */}
          <svg width="24" height="20" viewBox="0 0 36 28" fill="none">
            <path d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z" fill="url(#sparkle)"/>
            <defs>
              <linearGradient id="sparkle" x1="0" y1="0" x2="36" y2="28">
                <stop stopColor="hsl(217, 91%, 60%)" />
                <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-medium text-foreground text-base tracking-tight">Seven</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
          U
        </div>
      </div>
    </div>
  );
};

export default TopNav;
