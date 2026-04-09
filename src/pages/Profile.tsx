import { motion } from "framer-motion";
import { ChevronRight, Brain, Bell, Shield, Database, Palette, Info, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

const Profile = () => {
  const navigate = useNavigate();
  const [trackDecisions, setTrackDecisions] = useState(true);
  const [trackHabits, setTrackHabits] = useState(true);
  const [trackPatterns, setTrackPatterns] = useState(true);
  const [trackGoals, setTrackGoals] = useState(false);

  const sections = [
    {
      title: "Memory Preferences",
      items: [
        { label: "Track Decisions", icon: Brain, toggle: true, value: trackDecisions, onChange: setTrackDecisions },
        { label: "Track Habits", icon: Brain, toggle: true, value: trackHabits, onChange: setTrackHabits },
        { label: "Track Patterns", icon: Brain, toggle: true, value: trackPatterns, onChange: setTrackPatterns },
        { label: "Track Goals", icon: Brain, toggle: true, value: trackGoals, onChange: setTrackGoals },
      ],
    },
    {
      title: "Notifications",
      items: [
        { label: "Check-in Schedule", icon: Bell, subtitle: "Daily, Morning" },
        { label: "Reminders", icon: Bell, subtitle: "Enabled" },
      ],
    },
    {
      title: "Privacy & Data",
      items: [
        { label: "Governance Rules", icon: Shield, subtitle: "3 active rules" },
        { label: "Export My Data", icon: Database },
        { label: "Delete My Data", icon: Database, destructive: true },
      ],
    },
    {
      title: "General",
      items: [
        { label: "Appearance", icon: Palette, subtitle: "System" },
        { label: "About Seven", icon: Info, subtitle: "v1.0.0" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-14 pb-24 px-4 max-w-lg mx-auto">
        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border mt-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-lg">
            U
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-medium text-foreground">User</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">user@example.com</p>
          </div>
          <button className="text-[13px] text-primary font-medium hover:underline transition-all">Edit</button>
        </motion.div>

        {/* Sections */}
        {sections.map((section, sectionIdx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIdx * 0.05, duration: 0.3 }}
            className="mb-6"
          >
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2.5 px-1">{section.title}</h3>
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              {section.items.map((item, i) => (
                <div key={item.label}
                  className={`flex items-center gap-3.5 px-4 py-3.5 ${i < section.items.length - 1 ? "border-b border-border" : ""} hover:bg-surface-hover transition-colors`}>
                  <item.icon size={18} className={`shrink-0 ${(item as any).destructive ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className={`text-[14px] font-medium ${(item as any).destructive ? "text-destructive" : "text-foreground"}`}>{item.label}</p>
                    {(item as any).subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{(item as any).subtitle}</p>}
                  </div>
                  {(item as any).toggle ? (
                    <button onClick={() => (item as any).onChange(!(item as any).value)}
                      className={`w-[42px] h-[26px] rounded-full transition-all duration-200 flex items-center px-0.5 ${(item as any).value ? "bg-primary" : "bg-border"}`}>
                      <div className={`w-[22px] h-[22px] rounded-full bg-card shadow-sm transition-transform duration-200 ${(item as any).value ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground opacity-50" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Sign out */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/login")}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-full text-destructive text-[14px] font-medium bg-card border border-border hover:shadow-sm transition-all duration-200"
        >
          <LogOut size={16} />
          Sign out
        </motion.button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
