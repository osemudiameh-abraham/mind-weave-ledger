import { Home, Library, Compass, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import LiveButton from "./LiveButton";

const tabs = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Library, label: "Library", path: "/library" },
  { icon: null, label: "Live", path: "/live" },
  { icon: Compass, label: "Explore", path: "/memory" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-end justify-around px-2 pb-1 pt-1 max-w-lg mx-auto">
          {tabs.map((tab) => {
            if (tab.label === "Live") {
              return (
                <div key="live" className="relative -mt-4 flex flex-col items-center">
                  <LiveButton onClick={() => navigate("/live")} />
                  <span className="text-[10px] font-medium text-muted-foreground mt-0.5">Live</span>
                </div>
              );
            }
            const Icon = tab.icon!;
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
