import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useAlwaysListening } from "@/contexts/AlwaysListeningContext";
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
  Mic,
  AudioLines,
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
import { supabase } from "@/lib/supabase";

type ThemeMode = "light" | "dark" | "system";

const Settings = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user } = auth;
  const { enabled: alwaysListeningEnabled, setEnabled: setAlwaysListeningEnabled, wakeWord } = useAlwaysListening();

  // Preferences state — initialised from localStorage cache, then overwritten by Supabase
  const [pushEnabled, setPushEnabled] = useState(() => {
    return localStorage.getItem("seven_push_notifs") !== "false";
  });
  const [emailEnabled, setEmailEnabled] = useState(() => {
    return localStorage.getItem("seven_email_notifs") !== "false";
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("seven_theme") as ThemeMode) || "system";
  });

  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [devicesSheetOpen, setDevicesSheetOpen] = useState(false);

  // Gmail connection — check oauth_tokens table
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnecting, setGmailConnecting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Delete account dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Sign out dialog
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  // ─── Load preferences from Supabase on mount ───
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const [prefsRes, gmailRes] = await Promise.all([
        supabase
          .from("user_preferences")
          .select("push_enabled, email_reminders, theme")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("oauth_tokens")
          .select("id")
          .eq("user_id", user.id)
          .eq("provider", "gmail")
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (prefsRes.data) {
        const p = prefsRes.data;
        setPushEnabled(p.push_enabled ?? false);
        setEmailEnabled(p.email_reminders ?? true);
        const dbTheme = (p.theme as ThemeMode) || "system";
        setTheme(dbTheme);
        // Sync localStorage cache
        localStorage.setItem("seven_push_notifs", String(p.push_enabled ?? false));
        localStorage.setItem("seven_email_notifs", String(p.email_reminders ?? true));
        localStorage.setItem("seven_theme", dbTheme);
        applyTheme(dbTheme);
      }

      setGmailConnected(!!gmailRes.data);
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  // ─── Apply theme to document ───
  const applyTheme = useCallback((mode: ThemeMode) => {
    document.documentElement.classList.remove("light", "dark");
    if (mode !== "system") {
      document.documentElement.classList.add(mode);
    }
  }, []);

  // ─── Update a single preference in Supabase ───
  const updatePref = useCallback(async (field: string, value: boolean | string) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_preferences")
      .update({ [field]: value })
      .eq("user_id", user.id);
    if (error) {
      console.error("[SETTINGS] Failed to update preference:", field, error.message);
    }
  }, [user]);

  const handleTogglePush = () => {
    const next = !pushEnabled;
    setPushEnabled(next);
    localStorage.setItem("seven_push_notifs", String(next));
    updatePref("push_enabled", next);
    toast(next ? "Push notifications enabled" : "Push notifications disabled");
  };

  const handleToggleEmail = () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    localStorage.setItem("seven_email_notifs", String(next));
    updatePref("email_reminders", next);
    toast(next ? "Email notifications enabled" : "Email notifications disabled");
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem("seven_theme", mode);
    applyTheme(mode);
    updatePref("theme", mode);
    setThemeSheetOpen(false);
    toast(`Theme set to ${mode}`);
  };

  const handleGmailToggle = () => {
    if (gmailConnected) {
      // Disconnect: remove oauth token
      if (user) {
        supabase.from("oauth_tokens").delete().eq("user_id", user.id).eq("provider", "gmail")
          .then(() => {
            setGmailConnected(false);
            toast("Gmail disconnected");
          });
      }
    } else {
      // Connect: OAuth flow placeholder — will be wired in GEL phase
      setGmailConnecting(true);
      setTimeout(() => {
        setGmailConnecting(false);
        toast("Gmail OAuth integration coming in Phase 6");
      }, 1500);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);

    try {
      const [factsRes, decisionsRes, outcomesRes, sectionsRes, prefsRes, identityRes] = await Promise.all([
        supabase.from("memory_facts").select("*").eq("user_id", user.id),
        supabase.from("decisions").select("*").eq("user_id", user.id),
        supabase.from("outcomes").select("*").eq("user_id", user.id),
        supabase.from("sections").select("id, title, created_at").eq("user_id", user.id),
        supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("identity_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        identity: identityRes.data || null,
        preferences: prefsRes.data || null,
        facts: factsRes.data || [],
        decisions: decisionsRes.data || [],
        outcomes: outcomesRes.data || [],
        sections: sectionsRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seven-mynd-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (err) {
      console.error("[EXPORT] Failed:", err);
      toast.error("Export failed. Please try again.");
    }

    setExporting(false);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") return;
    auth.deleteAccount();
    toast("Account deleted. Redirecting…");
    setDeleteDialogOpen(false);
    setTimeout(() => navigate("/login"), 1000);
  };

  const handleSignOut = () => {
    auth.signOut();
    toast("Signed out");
    setSignOutDialogOpen(false);
    navigate("/login", { replace: true });
  };

  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  // Hardcoded sessions for now — will wire to devices table in Phase 11
  const sessions = [
    { name: "This device", browser: "Current browser", lastActive: "Now", current: true },
  ];

  const sections = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Profile", desc: "Name, photo, bio", action: () => navigate("/profile") },
        { icon: ThemeIcon, label: "Appearance", desc: themeLabel, action: () => setThemeSheetOpen(true) },
        { icon: Smartphone, label: "Devices", desc: `${sessions.length} active session${sessions.length !== 1 ? "s" : ""}`, action: () => setDevicesSheetOpen(true) },
      ],
    },
    {
      title: "Live & Voice",
      items: [
        {
          icon: AudioLines,
          label: "Always Listening",
          desc: alwaysListeningEnabled ? `Active — wake word: "${wakeWord}"` : "Disabled",
          toggle: true,
          toggled: alwaysListeningEnabled,
          action: () => {
            setAlwaysListeningEnabled(!alwaysListeningEnabled);
            toast(alwaysListeningEnabled ? "Always Listening disabled" : "Always Listening enabled");
          },
        },
        {
          icon: Mic,
          label: "Wake Word",
          desc: `"${wakeWord}"`,
          action: () => toast("Wake word customization coming soon"),
        },
      ],
    },
    {
      title: "Integrations",
      items: [
        {
          icon: Mail,
          label: "Gmail",
          desc: gmailConnected ? "Connected" : "Not connected",
          connected: gmailConnected,
          loading: gmailConnecting,
          action: handleGmailToggle,
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: Bell, label: "Push Notifications", desc: pushEnabled ? "Enabled" : "Disabled", toggle: true, toggled: pushEnabled, action: handleTogglePush },
        { icon: Mail, label: "Email Notifications", desc: emailEnabled ? "Enabled" : "Disabled", toggle: true, toggled: emailEnabled, action: handleToggleEmail },
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
      <div className="pt-16 pb-24 px-4 max-w-3xl mx-auto">
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
