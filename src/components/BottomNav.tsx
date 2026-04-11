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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around max-w-5xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center py-2 px-3 min-w-[56px]"
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
    </div>
  );
};

export default BottomNav;
