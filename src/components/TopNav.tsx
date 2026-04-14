import { Menu, ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import SevenLogo from "./SevenLogo";
import RemindersSheet from "./RemindersSheet";
import type { Reminder } from "@/hooks/use-reminders";

interface TopNavProps {
  onMenuClick?: () => void;
  reminders?: Reminder[];
  unseenCount?: number;
  onAddReminder?: (title: string, dueAt: Date, description?: string) => void;
  onDismissReminder?: (id: string) => void;
  onMarkAllSeen?: () => void;
}

const TopNav = ({ onMenuClick, reminders, unseenCount = 0, onAddReminder, onDismissReminder, onMarkAllSeen }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const mainPages = ["/home", "/reviews", "/vault", "/trace", "/digest"];
  const isSubPage = !mainPages.includes(location.pathname);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center justify-between px-4 h-14">
        {isSubPage ? (
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft size={22} className="text-foreground/70" />
          </button>
        ) : (
          <button
            onClick={onMenuClick}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Menu size={22} className="text-foreground/70" />
          </button>
        )}

        <button
          onClick={() => navigate("/home")}
          className="flex items-center gap-2"
        >
          <SevenLogo size={20} />
          <span className="font-medium text-foreground text-[16px] tracking-tight">Seven</span>
        </button>

        <div className="flex items-center gap-1">
          {reminders && onAddReminder && onDismissReminder && onMarkAllSeen && (
            <RemindersSheet
              reminders={reminders}
              unseenCount={unseenCount}
              onAdd={onAddReminder}
              onDismiss={onDismissReminder}
              onMarkAllSeen={onMarkAllSeen}
            />
          )}
          <button
            onClick={() => navigate("/settings")}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[13px] font-medium">
              {(localStorage.getItem("seven_user_name") || "U").charAt(0).toUpperCase()}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
