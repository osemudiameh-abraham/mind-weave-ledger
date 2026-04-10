import { useNavigate, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  Archive,
  ShieldCheck,
  BarChart3,
  Smartphone,
  Watch,
  Glasses,
  Headphones,
  Activity,
  Wifi,
  Settings,
  BookOpen,
  Brain,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import SevenLogo from "./SevenLogo";

interface SideMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navItems = [
  { icon: ClipboardCheck, label: "Reviews", path: "/reviews" },
  { icon: Archive, label: "Vault", path: "/vault" },
  { icon: ShieldCheck, label: "Trace", path: "/trace" },
  { icon: BarChart3, label: "Digest", path: "/digest" },
  { icon: BookOpen, label: "Library", path: "/library" },
  { icon: Brain, label: "Memory", path: "/memory" },
];

const deviceTypes = [
  { icon: Glasses, label: "Smart Glasses", desc: "Meta, Ray-Ban, etc." },
  { icon: Watch, label: "Smartwatch", desc: "Apple Watch, Galaxy Watch" },
  { icon: Activity, label: "Health Devices", desc: "Oura, Whoop, Fitbit" },
  { icon: Headphones, label: "Earbuds", desc: "AirPods, Pixel Buds" },
  { icon: Smartphone, label: "Phone", desc: "iOS, Android" },
  { icon: Wifi, label: "Other Devices", desc: "IoT, home assistants" },
];

const SideMenu = ({ open, onOpenChange }: SideMenuProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2.5">
            <SevenLogo size={20} />
            <span className="text-[16px] font-medium tracking-tight">Seven</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Navigation */}
          <div className="px-3 pt-4 pb-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Navigate
            </p>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon size={18} strokeWidth={active ? 2.2 : 1.5} />
                  <span className={`text-[14px] ${active ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Connect Devices */}
          <div className="px-3 pt-3 pb-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Connect Devices
            </p>
            <p className="text-[12px] text-muted-foreground px-2 mb-3 leading-relaxed">
              Let Seven see, hear, and learn through your devices — in real time.
            </p>
            {deviceTypes.map((device) => (
              <button
                key={device.label}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <device.icon size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{device.label}</p>
                  <p className="text-[11px] text-muted-foreground">{device.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings footer */}
        <div className="border-t border-border px-3 py-3">
          <button
            onClick={() => handleNav("/settings")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors"
          >
            <Settings size={18} className="text-muted-foreground" />
            <span className="text-[14px] font-medium text-foreground">Settings</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SideMenu;
