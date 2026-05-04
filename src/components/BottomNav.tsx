import { Home, ClipboardCheck, Archive, ShieldCheck, BarChart3 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: ClipboardCheck, label: "Reviews", path: "/reviews" },
  { icon: Archive, label: "Vault", path: "/vault" },
  { icon: ShieldCheck, label: "Trace", path: "/trace" },
  { icon: BarChart3, label: "Digest", path: "/digest" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide bottom nav on /home so the chat input has full breathing room at
  // the bottom of the viewport. Side menu (top-left hamburger) provides
  // navigation to Reviews / Vault / Trace / Digest from /home -- routes
  // remain fully reachable. On every non-home route, bottom nav renders
  // as before, including the highlighted active tab. Architecture v5.7
  // sec.10 (chat-first interaction) + sec.15.10 (Premium Quality Gate) --
  // mobile chat surface should not compete with persistent navigation
  // chrome at the bottom of the viewport.
  if (location.pathname === "/home") {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-label={`Go to ${tab.label}`}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] px-3"
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                  active ? "bg-primary/12" : ""
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.5}
                  className={active ? "text-primary" : "text-muted-foreground"}
                  aria-hidden="true"
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 leading-tight ${
                  active ? "font-semibold text-primary" : "font-medium text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
