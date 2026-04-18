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
  const {
    enabled: alwaysListeningEnabled,
    setEnabled: setAlwaysListeningEnabled,
    wakeWord,
    isListening: alwaysListeningActive,
    error: alwaysListeningError,
    usingFallback: alwaysListeningFallback,
  } = useAlwaysListening();

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
  const [deleting, setDeleting] = useState(false);

  // Sign out dialog
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  // ─── Apply theme to document ───
  const applyTheme = useCallback((mode: ThemeMode) => {
    document.documentElement.classList.remove("light", "dark");
    if (mode !== "system") {
      document.documentElement.classList.add(mode);
    }
  }, []);

  // ─── Load preferences from Supabase on mount ───
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const [prefsRes, gmailRes] = await Promise.all([
        supabase
          .from("user_preferences")
          .select("push_enabled, email_reminders, theme, always_listening_enabled")
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
        const p = prefsRes.data as {
          push_enabled: boolean | null;
          email_reminders: boolean | null;
          theme: string | null;
          always_listening_enabled: boolean | null;
        };
        setPushEnabled(p.push_enabled ?? false);
        setEmailEnabled(p.email_reminders ?? true);
        const dbTheme = (p.theme as ThemeMode) || "system";
        setTheme(dbTheme);
        // Sync localStorage cache
        localStorage.setItem("seven_push_notifs", String(p.push_enabled ?? false));
        localStorage.setItem("seven_email_notifs", String(p.email_reminders ?? true));
        localStorage.setItem("seven_theme", dbTheme);
        applyTheme(dbTheme);

        // Reconcile always_listening preference from DB -> context.
        // Context was initialised from localStorage; if DB disagrees, DB wins.
        const dbAlways = p.always_listening_enabled ?? false;
        if (dbAlways !== alwaysListeningEnabled) {
          setAlwaysListeningEnabled(dbAlways);
        }
      }

      setGmailConnected(!!gmailRes.data);
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, applyTheme]);

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

  const handleToggleAlwaysListening = () => {
    const next = !alwaysListeningEnabled;
    setAlwaysListeningEnabled(next);
    updatePref("always_listening_enabled", next);
    // Do not show a success toast yet — the context may emit an error
    // once it tries to start the mic. The inline error row below the toggle
    // is the source of truth.
    if (!next) {
      toast("Always Listening disabled");
    }
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || deleting) return;
    setDeleting(true);
    try {
      await auth.deleteAccount();
      toast.success("Account deleted. Redirecting…");
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      setTimeout(() => navigate("/login", { replace: true }), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Account deletion failed";
      console.error("[DELETE_ACCOUNT] Failed:", err);
      toast.error(message);
      setDeleting(false);
      // Keep the dialog open so the user can try again or contact support.
    }
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

  // Description for Always Listening row — reflects real service state.
  const alwaysListeningDesc = (() => {
    if (!alwaysListeningEnabled) return "Disabled";
    if (alwaysListeningError) return "Unable to start — see details below";
    if (alwaysListeningActive) {
      const activeLabel = alwaysListeningFallback ? "Computer" : wakeWord;
      return `Active — wake word: "${activeLabel}"`;
    }
    return "Starting…";
  })();

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
          desc: alwaysListeningDesc,
          toggle: true,
          toggled: alwaysListeningEnabled,
          action: handleToggleAlwaysListening,
        },
        {
          icon: Mic,
          label: "Wake Word",
          desc: `"${alwaysListeningFallback ? "Computer" : wakeWord}"`,
          action: () => toast("Wake word is set during build. Contact support to request a different keyword."),
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
      <div
        className="px-4 max-w-[780px] mx-auto"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 0.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
        }}
      >
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
              {section.items.map((item: {
                icon: typeof User;
                label: string;
                desc: string;
                action: () => void;
                toggle?: boolean;
                toggled?: boolean;
                connected?: boolean;
                loading?: boolean;
                danger?: boolean;
              }, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={item.action}
                  disabled={item.loading}
                  aria-label={item.label}
                  aria-pressed={item.toggle ? item.toggled : undefined}
                  className="w-full flex items-center gap-3 min-h-[44px] px-4 py-3.5 hover:bg-muted/50 transition-colors text-left disabled:opacity-60"
                >
                  <item.icon
                    size={20}
                    className={item.danger ? "text-destructive" : "text-muted-foreground"}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-medium ${item.danger ? "text-destructive" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                  {item.loading ? (
                    <Loader2 size={16} className="text-muted-foreground animate-spin" aria-hidden="true" />
                  ) : item.toggle ? (
                    <span
                      className={`w-10 h-6 rounded-full relative transition-colors ${
                        item.toggled ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                      aria-hidden="true"
                    >
                      <motion.span
                        animate={{ x: item.toggled ? 16 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-5 h-5 bg-primary-foreground rounded-full shadow-sm block"
                      />
                    </span>
                  ) : item.connected !== undefined ? (
                    <span className={`text-[11px] font-medium ${item.connected ? "text-primary" : "text-muted-foreground"}`}>
                      {item.connected ? "Connected" : "Connect"}
                    </span>
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>

            {/* Live & Voice: Always Listening error + fallback notices */}
            {section.title === "Live & Voice" && alwaysListeningEnabled && alwaysListeningError && (
              <div
                role="alert"
                className="mt-2 mx-1 p-3 rounded-xl border border-destructive/30 bg-destructive/5 flex items-start gap-2"
              >
                <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-destructive">Always Listening failed to start</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{alwaysListeningError}</p>
                </div>
              </div>
            )}
            {section.title === "Live & Voice" && alwaysListeningEnabled && !alwaysListeningError && alwaysListeningFallback && (
              <div className="mt-2 mx-1 p-3 rounded-xl border border-border bg-muted/50">
                <p className="text-[12px] text-muted-foreground">
                  Running with the built-in "Computer" wake word. The custom "Hey Seven" model couldn't be loaded.
                </p>
              </div>
            )}
          </motion.div>
        ))}

        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => setSignOutDialogOpen(true)}
          aria-label="Sign out"
          className="w-full flex items-center justify-center gap-2 min-h-[44px] py-3 text-destructive text-[14px] font-medium mt-4"
        >
          <LogOut size={18} aria-hidden="true" />
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
                type="button"
                onClick={() => handleThemeChange(opt.mode)}
                aria-pressed={theme === opt.mode}
                className={`w-full flex items-center gap-3 min-h-[44px] px-4 py-3.5 rounded-xl border transition-all ${
                  theme === opt.mode ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <opt.icon size={20} className={theme === opt.mode ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium text-foreground">{opt.label}</p>
                  <p className="text-[12px] text-muted-foreground">{opt.desc}</p>
                </div>
                {theme === opt.mode && <Check size={18} className="text-primary" aria-hidden="true" />}
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
                className="flex items-center gap-3 min-h-[44px] px-4 py-3.5 rounded-xl border border-border"
              >
                <Smartphone size={20} className="text-muted-foreground" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-foreground">
                    {s.name}
                    {s.current && <span className="ml-2 text-[11px] text-primary font-medium">Current</span>}
                  </p>
                  <p className="text-[12px] text-muted-foreground">{s.browser} · {s.lastActive}</p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() => toast("Session revoked")}
                    className="min-h-[44px] px-3 text-[11px] text-destructive font-medium hover:underline"
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
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          // Block dismissal while deletion is in flight to prevent mid-delete
          // navigation leaving the UI in an unknown state.
          if (deleting) return;
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmText("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-destructive" aria-hidden="true" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">This action is permanent and cannot be undone. All your data, sections, and connected devices will be permanently removed.</span>
              <span className="block">
                <span className="block text-[12px] text-foreground font-medium mb-1.5">Type DELETE to confirm:</span>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  aria-label="Type DELETE to confirm account deletion"
                  disabled={deleting}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[14px] outline-none focus:border-destructive/50 disabled:opacity-50"
                />
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete my account"}
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
