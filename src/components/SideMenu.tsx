import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
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
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  EyeOff,
  Eye,
  Crown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import SevenLogo from "./SevenLogo";
import DevicePairingSheet from "./DevicePairingSheet";
import type { Section } from "@/hooks/use-sections";

interface SideMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections?: Section[];
  activeSectionId?: string | null;
  onNewSection?: () => void;
  onSelectSection?: (id: string) => void;
  onRenameSection?: (id: string, name: string) => void;
  onDeleteSection?: (id: string) => void;
  onToggleHideSection?: (id: string) => void;
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

const SideMenu = ({
  open,
  onOpenChange,
  sections = [],
  activeSectionId,
  onNewSection,
  onSelectSection,
  onRenameSection,
  onDeleteSection,
  onToggleHideSection,
}: SideMenuProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("seven_connected_devices_v2") || "{}");
    } catch {
      return {};
    }
  });
  const [pairingCategory, setPairingCategory] = useState<string | null>(null);
  const [pairingOpen, setPairingOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("seven_connected_devices_v2", JSON.stringify(connectedDevices));
  }, [connectedDevices]);

  const getConnectedDeviceForCategory = (category: string): string | undefined => {
    // Look through connected device names and match to category
    return Object.values(connectedDevices).find(() => false); // simplified - tracked by category below
  };

  const connectedByCategory = Object.entries(connectedDevices).reduce<Record<string, string>>((acc, [id, name]) => {
    // We need to find the category - store it in a map
    return acc;
  }, {});

  const handleDeviceClick = (category: string) => {
    setPairingCategory(category);
    setPairingOpen(true);
  };

  const handleDeviceConnected = (deviceId: string, deviceName: string, category: string) => {
    setConnectedDevices((prev) => ({ ...prev, [deviceId]: deviceName }));
  };

  const handleDeviceDisconnected = (deviceId: string) => {
    setConnectedDevices((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
    toast(`Device disconnected`);
  };

  const handleNav = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const startRename = (section: Section) => {
    setEditingId(section.id);
    setEditName(section.name);
    setMenuOpenId(null);
  };

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      onRenameSection?.(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const visibleSections = sections.filter((s) => !s.hidden);
  const hiddenSections = sections.filter((s) => s.hidden);

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
          {/* Sections */}
          <div className="px-3 pt-4 pb-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Sections
              </p>
              <button
                onClick={() => {
                  onNewSection?.();
                  onOpenChange(false);
                }}
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Plus size={14} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/70 px-2 mb-3 leading-relaxed">
              All context is retained across sections — Seven never forgets.
            </p>

            {visibleSections.length === 0 && (
              <button
                onClick={() => {
                  onNewSection?.();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors text-muted-foreground"
              >
                <Plus size={16} />
                <span className="text-[13px] font-medium">Start a new section</span>
              </button>
            )}

            {visibleSections.map((section) => {
              const active = section.id === activeSectionId;
              return (
                <div key={section.id} className="relative group">
                  {editingId === section.id ? (
                    <div className="flex items-center gap-1 px-3 py-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={confirmRename}
                        onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                        className="flex-1 bg-muted rounded-lg px-2 py-1.5 text-[13px] text-foreground outline-none border border-primary/30"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectSection?.(section.id);
                        onOpenChange(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${active ? "font-semibold" : "font-medium"}`}>
                          {section.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {section.messages.length} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === section.id ? null : section.id);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                      >
                        <MoreHorizontal size={14} className="text-muted-foreground" />
                      </button>
                    </button>
                  )}

                  {/* Context menu */}
                  {menuOpenId === section.id && (
                    <div className="absolute right-2 top-full z-10 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => startRename(section)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={12} /> Rename
                      </button>
                      <button
                        onClick={() => { onToggleHideSection?.(section.id); setMenuOpenId(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground hover:bg-muted transition-colors"
                      >
                        <EyeOff size={12} /> Hide
                      </button>
                      <button
                        onClick={() => { onDeleteSection?.(section.id); setMenuOpenId(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-destructive hover:bg-muted transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show hidden toggle */}
            {hiddenSections.length > 0 && (
              <button
                onClick={() => setShowHidden(!showHidden)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                <Eye size={12} />
                {showHidden ? "Hide" : "Show"} {hiddenSections.length} hidden section{hiddenSections.length > 1 ? "s" : ""}
              </button>
            )}

            {showHidden &&
              hiddenSections.map((section) => (
                <div key={section.id} className="relative group opacity-50">
                  <button
                    onClick={() => {
                      onSelectSection?.(section.id);
                      onOpenChange(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-foreground hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{section.name}</p>
                      <p className="text-[10px] text-muted-foreground">{section.messages.length} messages</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHideSection?.(section.id);
                      }}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted"
                    >
                      <Eye size={12} className="text-muted-foreground" />
                    </button>
                  </button>
                </div>
              ))}
          </div>

          {/* Navigation */}
          <div className="px-3 pt-3 pb-2 border-t border-border">
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
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
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
            {deviceTypes.map((device) => {
              const connectedName = Object.values(connectedDevices).length > 0
                ? Object.values(connectedDevices).find(() => false) // will use pairing sheet
                : undefined;
              const hasConnection = Object.keys(connectedDevices).length > 0;
              return (
                <button
                  key={device.label}
                  onClick={() => handleDeviceClick(device.label)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10`}>
                    <device.icon size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{device.label}</p>
                    <p className="text-[11px] text-muted-foreground">{device.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Device Pairing Sheet */}
        <DevicePairingSheet
          open={pairingOpen}
          onOpenChange={setPairingOpen}
          deviceCategory={pairingCategory}
          connectedDevices={Object.keys(connectedDevices)}
          onDeviceConnected={handleDeviceConnected}
          onDeviceDisconnected={handleDeviceDisconnected}
        />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-3 space-y-0.5">
          <button
            onClick={() => handleNav("/subscription")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors"
          >
            <Crown size={18} className="text-primary" />
            <span className="text-[14px] font-medium text-foreground">Subscription</span>
          </button>
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
