import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, Brain, Bell, Shield, Database, Palette, Info, LogOut, Moon, Sun, Monitor, Download, Trash2, X, Check, Camera } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "seven_profile_prefs";

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const Profile = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const saved = loadPrefs();

  const [trackDecisions, setTrackDecisions] = useState(saved?.trackDecisions ?? true);
  const [trackHabits, setTrackHabits] = useState(saved?.trackHabits ?? true);
  const [trackPatterns, setTrackPatterns] = useState(saved?.trackPatterns ?? true);
  const [trackGoals, setTrackGoals] = useState(saved?.trackGoals ?? false);

  const [checkinSchedule, setCheckinSchedule] = useState(saved?.checkinSchedule ?? "Daily, Morning");
  const [remindersEnabled, setRemindersEnabled] = useState(saved?.remindersEnabled ?? true);

  const [governanceRules, setGovernanceRules] = useState(saved?.governanceRules ?? 3);
  const [appearance, setAppearance] = useState(saved?.appearance ?? "System");

  // Sheets
  const [checkinSheet, setCheckinSheet] = useState(false);
  const [governanceSheet, setGovernanceSheet] = useState(false);
  const [appearanceSheet, setAppearanceSheet] = useState(false);
  const [aboutSheet, setAboutSheet] = useState(false);
  const [editSheet, setEditSheet] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState(saved?.userName ?? "User");
  const [editEmail, setEditEmail] = useState(saved?.userEmail ?? "user@example.com");
  const [userName, setUserName] = useState(saved?.userName ?? "User");
  const [userEmail, setUserEmail] = useState(saved?.userEmail ?? "user@example.com");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(saved?.avatarUrl ?? null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Checkin options
  const checkinOptions = ["Daily, Morning", "Daily, Evening", "Weekdays Only", "Weekly, Monday", "Custom"];
  const [selectedCheckin, setSelectedCheckin] = useState(checkinSchedule);

  // Governance rules
  const [rules, setRules] = useState<{ label: string; enabled: boolean }[]>(saved?.rules ?? [
    { label: "Auto-delete data older than 1 year", enabled: true },
    { label: "Require confirmation before sharing", enabled: true },
    { label: "Anonymize exported data", enabled: true },
    { label: "Block third-party access", enabled: false },
  ]);

  // Persist all prefs
  useEffect(() => {
    const prefs = {
      trackDecisions, trackHabits, trackPatterns, trackGoals,
      checkinSchedule, remindersEnabled, governanceRules: rules.filter(r => r.enabled).length,
      appearance, userName, userEmail, rules, avatarUrl,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [trackDecisions, trackHabits, trackPatterns, trackGoals, checkinSchedule, remindersEnabled, appearance, userName, userEmail, rules, avatarUrl]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (appearance === "Light") root.classList.add("light");
    else if (appearance === "Dark") root.classList.add("dark");
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    }
  }, [appearance]);

  const handleToggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(!value);
    toast.success(`${key} ${!value ? "enabled" : "disabled"}`);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      const data = {
        profile: { name: userName, email: userEmail },
        memoryPreferences: { trackDecisions, trackHabits, trackPatterns, trackGoals },
        notifications: { checkinSchedule, remindersEnabled },
        governance: { rules },
        appearance,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seven-profile-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
      toast.success("Data exported successfully");
    }, 1500);
  };

  const handleDelete = () => {
    if (deleteConfirmText !== "DELETE") return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("seven_connected_devices");
    localStorage.removeItem("seven_settings");
    toast.success("All data deleted");
    setDeleteDialog(false);
    setDeleteConfirmText("");
    navigate("/login");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setEditAvatarPreview(result);
    };
    reader.onerror = () => toast.error("Failed to read image");
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    if (!editName.trim() || !editEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setUserName(editName.trim());
    setUserEmail(editEmail.trim());
    if (editAvatarPreview) {
      setAvatarUrl(editAvatarPreview);
    }
    setEditSheet(false);
    setEditAvatarPreview(null);
    toast.success("Profile updated");
  };

  const handleSaveCheckin = () => {
    setCheckinSchedule(selectedCheckin);
    setCheckinSheet(false);
    toast.success(`Check-in schedule set to "${selectedCheckin}"`);
  };

  const handleToggleRule = (idx: number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  };

  const activeRules = rules.filter(r => r.enabled).length;

  const sections = [
    {
      title: "Memory Preferences",
      items: [
        { label: "Track Decisions", icon: Brain, toggle: true, value: trackDecisions, onChange: () => handleToggle("Track Decisions", trackDecisions, setTrackDecisions) },
        { label: "Track Habits", icon: Brain, toggle: true, value: trackHabits, onChange: () => handleToggle("Track Habits", trackHabits, setTrackHabits) },
        { label: "Track Patterns", icon: Brain, toggle: true, value: trackPatterns, onChange: () => handleToggle("Track Patterns", trackPatterns, setTrackPatterns) },
        { label: "Track Goals", icon: Brain, toggle: true, value: trackGoals, onChange: () => handleToggle("Track Goals", trackGoals, setTrackGoals) },
      ],
    },
    {
      title: "Notifications",
      items: [
        { label: "Check-in Schedule", icon: Bell, subtitle: checkinSchedule, onTap: () => setCheckinSheet(true) },
        { label: "Reminders", icon: Bell, toggle: true, value: remindersEnabled, onChange: () => handleToggle("Reminders", remindersEnabled, setRemindersEnabled) },
      ],
    },
    {
      title: "Privacy & Data",
      items: [
        { label: "Governance Rules", icon: Shield, subtitle: `${activeRules} active rule${activeRules !== 1 ? "s" : ""}`, onTap: () => setGovernanceSheet(true) },
        { label: "Export My Data", icon: Database, onTap: handleExport, loading: exporting },
        { label: "Delete My Data", icon: Database, destructive: true, onTap: () => setDeleteDialog(true) },
      ],
    },
    {
      title: "General",
      items: [
        { label: "Appearance", icon: Palette, subtitle: appearance, onTap: () => setAppearanceSheet(true) },
        { label: "About Seven", icon: Info, subtitle: "v1.0.0", onTap: () => setAboutSheet(true) },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="pt-14 pb-24 px-4 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border mt-4 mb-6">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-lg">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <button onClick={() => { setEditName(userName); setEditEmail(userEmail); setEditAvatarPreview(null); setEditSheet(true); }}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
              <Camera size={12} className="text-primary-foreground" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-medium text-foreground">{userName}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">{userEmail}</p>
          </div>
          <button onClick={() => { setEditName(userName); setEditEmail(userEmail); setEditSheet(true); }}
            className="text-[13px] text-primary font-medium hover:underline transition-all">Edit</button>
        </motion.div>

        {sections.map((section, sectionIdx) => (
          <motion.div key={section.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIdx * 0.05, duration: 0.3 }} className="mb-6">
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2.5 px-1">{section.title}</h3>
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              {section.items.map((item: any, i) => (
                <div key={item.label}
                  onClick={() => !item.toggle && item.onTap?.()}
                  className={`flex items-center gap-3.5 px-4 py-3.5 ${i < section.items.length - 1 ? "border-b border-border" : ""} ${!item.toggle && item.onTap ? "cursor-pointer hover:bg-accent/50" : ""} transition-colors`}>
                  <item.icon size={18} className={`shrink-0 ${item.destructive ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className={`text-[14px] font-medium ${item.destructive ? "text-destructive" : "text-foreground"}`}>
                      {item.loading ? "Exporting..." : item.label}
                    </p>
                    {item.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>}
                  </div>
                  {item.toggle ? (
                    <button onClick={item.onChange}
                      className={`w-[42px] h-[26px] rounded-full transition-all duration-200 flex items-center px-0.5 ${item.value ? "bg-primary" : "bg-border"}`}>
                      <div className={`w-[22px] h-[22px] rounded-full bg-card shadow-sm transition-transform duration-200 ${item.value ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground opacity-50" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.98 }}
          onClick={() => { auth.signOut(); toast.success("Signed out"); navigate("/login"); }}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-full text-destructive text-[14px] font-medium bg-card border border-border hover:shadow-sm transition-all duration-200">
          <LogOut size={16} />
          Sign out
        </motion.button>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={editSheet} onOpenChange={setEditSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader><SheetTitle>Edit Profile</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {(editAvatarPreview || avatarUrl) ? (
                  <img src={editAvatarPreview || avatarUrl!} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-2xl">
                    {editName.charAt(0).toUpperCase()}
                  </div>
                )}
                <button onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <Camera size={14} className="text-primary-foreground" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
              <p className="text-[11px] text-muted-foreground">Tap camera to change photo</p>
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground mb-1 block">Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground mb-1 block">Email</label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Your email" type="email" />
            </div>
            <button onClick={handleSaveProfile}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground text-[14px] font-medium">
              Save Changes
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Check-in Schedule Sheet */}
      <Sheet open={checkinSheet} onOpenChange={setCheckinSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader><SheetTitle>Check-in Schedule</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {checkinOptions.map(opt => (
              <button key={opt} onClick={() => setSelectedCheckin(opt)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${selectedCheckin === opt ? "border-primary bg-primary/10" : "border-border"}`}>
                <span className="text-[14px] text-foreground">{opt}</span>
                {selectedCheckin === opt && <Check size={16} className="text-primary" />}
              </button>
            ))}
            <button onClick={handleSaveCheckin}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground text-[14px] font-medium mt-3">
              Save
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Governance Rules Sheet */}
      <Sheet open={governanceSheet} onOpenChange={setGovernanceSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader><SheetTitle>Governance Rules</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {rules.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border">
                <span className="text-[13px] text-foreground flex-1 pr-3">{rule.label}</span>
                <button onClick={() => handleToggleRule(idx)}
                  className={`w-[42px] h-[26px] rounded-full transition-all duration-200 flex items-center px-0.5 ${rule.enabled ? "bg-primary" : "bg-border"}`}>
                  <div className={`w-[22px] h-[22px] rounded-full bg-card shadow-sm transition-transform duration-200 ${rule.enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Appearance Sheet */}
      <Sheet open={appearanceSheet} onOpenChange={setAppearanceSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader><SheetTitle>Appearance</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {([
              { label: "Light", icon: Sun },
              { label: "Dark", icon: Moon },
              { label: "System", icon: Monitor },
            ] as const).map(opt => (
              <button key={opt.label} onClick={() => { setAppearance(opt.label); setAppearanceSheet(false); toast.success(`Theme set to ${opt.label}`); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${appearance === opt.label ? "border-primary bg-primary/10" : "border-border"}`}>
                <opt.icon size={18} className="text-muted-foreground" />
                <span className="text-[14px] text-foreground">{opt.label}</span>
                {appearance === opt.label && <Check size={16} className="text-primary ml-auto" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* About Sheet */}
      <Sheet open={aboutSheet} onOpenChange={setAboutSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader><SheetTitle>About Seven</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4 text-[13px] text-muted-foreground">
            <p><span className="text-foreground font-medium">Version:</span> 1.0.0</p>
            <p><span className="text-foreground font-medium">Build:</span> 2026.04.11</p>
            <p>Seven is your AI-powered memory companion — tracking decisions, habits, and patterns to help you grow.</p>
            <button onClick={() => { navigate("/privacy"); setAboutSheet(false); }}
              className="text-primary text-[13px] font-medium hover:underline">Privacy Policy →</button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete All Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your data including memory preferences, connected devices, and settings. Type <strong>DELETE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder='Type "DELETE" to confirm' className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteConfirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Profile;
