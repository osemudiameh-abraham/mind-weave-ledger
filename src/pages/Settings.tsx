import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Bell,
  Database,
  Shield,
  ChevronRight,
  LogOut,
  Moon,
  Smartphone,
  Trash2,
  Check,
  Sun,
  Monitor,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ThemeMode = "light" | "dark" | "system";

const Settings = () => {
  const navigate = useNavigate();

  // Toggles
  const [pushEnabled, setPushEnabled] = useState(() => {
    return localStorage.getItem("seven_push_notifs") !== "false";
  });
  const [emailEnabled, setEmailEnabled] = useState(() => {
    return localStorage.getItem("seven_email_notifs") !== "false";
  });

  // Theme
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("seven_theme") as ThemeMode) || "system";
  });
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);

  // Devices sheet
  const [devicesSheetOpen, setDevicesSheetOpen] = useState(false);
  const sessions = [
    { name: "This device", browser: "Chrome on macOS", lastActive: "Now", current: true },
    { name: "iPhone 16 Pro", browser: "Safari on iOS 18", lastActive: "2 hours ago", current: false },
  ];

  // Gmail connection
  const [gmailConnected, setGmailConnected] = useState(() => {
    return localStorage.getItem("seven_gmail_connected") !== "false";
  });
  const [gmailConnecting, setGmailConnecting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Delete account dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Sign out dialog
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  const handleTogglePush = () => {
    const next = !pushEnabled;
    setPushEnabled(next);
    localStorage.setItem("seven_push_notifs", String(next));
    toast(next ? "Push notifications enabled" : "Push notifications disabled");
  };

  const handleToggleEmail = () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    localStorage.setItem("seven_email_notifs", String(next));
    toast(next ? "Email notifications enabled" : "Email notifications disabled");
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem("seven_theme", mode);
    document.documentElement.classList.remove("light", "dark");
    if (mode !== "system") {
      document.documentElement.classList.add(mode);
    }
    setThemeSheetOpen(false);
    toast(`Theme set to ${mode}`);
  };

  const handleGmailToggle = () => {
    if (gmailConnected) {
      setGmailConnected(false);
      localStorage.setItem("seven_gmail_connected", "false");
      toast("Gmail disconnected");
    } else {
      setGmailConnecting(true);
      setTimeout(() => {
        setGmailConnecting(false);
        setGmailConnected(true);
        localStorage.setItem("seven_gmail_connected", "true");
        toast.success("Gmail connected successfully");
      }, 2000);
    }
  };

  const handleExportData = () => {
    setExporting(true);
    // Simulate export preparation
    setTimeout(() => {
      const data = {
        exportedAt: new Date().toISOString(),
        sections: [],
        settings: { pushEnabled, emailEnabled, theme },
        note: "This is a simulated data export. In production, this would contain all your data.",
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seven-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
      toast.success("Data exported successfully");
    }, 1500);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") return;
    localStorage.clear();
    toast("Account deleted. Redirecting…");
    setDeleteDialogOpen(false);
    setTimeout(() => navigate("/"), 1000);
  };

  const handleSignOut = () => {
    localStorage.clear();
    toast("Signed out");
    setSignOutDialogOpen(false);
    navigate("/");
  };

  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  const sections = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Profile", desc: "Name, photo, bio", action: () => navigate("/profile") },
        { icon: ThemeIcon, label: "Appearance", desc: themeLabel, action: () => setThemeSheetOpen(true) },
        { icon: Smartphone, label: "Devices", desc: "2 active sessions", action: () => setDevicesSheetOpen(true) },
      ],
    },
    {
      title: "Integrations",
      items: [
        {
          icon: Mail,
          label: "Gmail",
          desc: gmailConnected ? "Connected — user@gmail.com" : "Not connected",
          connected: gmailConnected,
          loading: gmailConnecting,
          action: handleGmailToggle,
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: Bell, label: "Push Notifications", desc: "Weekly digests, reviews", toggle: true, toggled: pushEnabled, action: handleTogglePush },
        { icon: Bell, label: "Email Notifications", desc: "Monthly summaries", toggle: true, toggled: emailEnabled, action: handleToggleEmail },
      ],
    },
    {
      title: "Data & Privacy",
      items: [
        { icon: Database, label: "Export Data", desc: exporting ? "Preparing export…" : "Download all your data", loading: exporting, action: handleExportData },
        { icon: Shield, label: "Privacy Policy", desc: "How we protect your data", action: () => navigate("/privacy") },
        { icon: Trash2, label: "Delete Account", desc: "Permanently remove all data", danger: true, action: () => setDeleteDialogOpen(true) },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Settings</h1>
        </motion.div>

        {sections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.08 }}
            className="mb-5"
          >
            <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
              {section.title}
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {section.items.map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={item.action}
                  disabled={item.loading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left disabled:opacity-60"
                >
                  <item.icon
                    size={20}
                    className={item.danger ? "text-destructive" : "text-muted-foreground"}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-medium ${item.danger ? "text-destructive" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                  {item.loading ? (
                    <Loader2 size={16} className="text-muted-foreground animate-spin" />
                  ) : item.toggle ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); item.action(); }}
                      className={`w-10 h-6 rounded-full relative transition-colors ${
                        item.toggled ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    >
                      <motion.div
                        animate={{ x: item.toggled ? 16 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-5 h-5 bg-primary-foreground rounded-full shadow-sm"
                      />
                    </button>
                  ) : item.connected !== undefined ? (
                    <span className={`text-[11px] font-medium ${item.connected ? "text-primary" : "text-muted-foreground"}`}>
                      {item.connected ? "Connected" : "Connect"}
                    </span>
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        ))}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => setSignOutDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-destructive text-[14px] font-medium mt-4"
        >
          <LogOut size={18} />
          Sign out
        </motion.button>
      </div>

      {/* Theme Sheet */}
      <Sheet open={themeSheetOpen} onOpenChange={setThemeSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-[16px]">Appearance</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            {([
              { mode: "light" as ThemeMode, icon: Sun, label: "Light", desc: "Always use light theme" },
              { mode: "dark" as ThemeMode, icon: Moon, label: "Dark", desc: "Always use dark theme" },
              { mode: "system" as ThemeMode, icon: Monitor, label: "System", desc: "Match your device settings" },
            ]).map((opt) => (
              <button
                key={opt.mode}
                onClick={() => handleThemeChange(opt.mode)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                  theme === opt.mode ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <opt.icon size={20} className={theme === opt.mode ? "text-primary" : "text-muted-foreground"} />
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium text-foreground">{opt.label}</p>
                  <p className="text-[12px] text-muted-foreground">{opt.desc}</p>
                </div>
                {theme === opt.mode && <Check size={18} className="text-primary" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Devices Sheet */}
      <Sheet open={devicesSheetOpen} onOpenChange={setDevicesSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-[16px]">Active Sessions</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            {sessions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border"
              >
                <Smartphone size={20} className="text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-foreground">
                    {s.name}
                    {s.current && <span className="ml-2 text-[11px] text-primary font-medium">Current</span>}
                  </p>
                  <p className="text-[12px] text-muted-foreground">{s.browser} · {s.lastActive}</p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => toast("Session revoked")}
                    className="text-[11px] text-destructive font-medium hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-destructive" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>This action is permanent and cannot be undone. All your data, sections, and connected devices will be permanently removed.</p>
              <div>
                <p className="text-[12px] text-foreground font-medium mb-1.5">Type DELETE to confirm:</p>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[14px] outline-none focus:border-destructive/50"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign Out Dialog */}
      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Settings;
