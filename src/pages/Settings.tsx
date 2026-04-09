import { motion } from "framer-motion";
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
} from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

const sections = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Profile", desc: "Name, photo, bio" },
      { icon: Moon, label: "Appearance", desc: "Light / Dark / System" },
      { icon: Smartphone, label: "Devices", desc: "2 active sessions" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { icon: Mail, label: "Gmail", desc: "Connected — user@gmail.com", connected: true },
    ],
  },
  {
    title: "Notifications",
    items: [
      { icon: Bell, label: "Push Notifications", desc: "Weekly digests, reviews", toggle: true },
      { icon: Bell, label: "Email Notifications", desc: "Monthly summaries", toggle: true },
    ],
  },
  {
    title: "Data & Privacy",
    items: [
      { icon: Database, label: "Export Data", desc: "Download all your data" },
      { icon: Shield, label: "Privacy", desc: "Data handling, retention" },
      { icon: Trash2, label: "Delete Account", desc: "Permanently remove all data", danger: true },
    ],
  },
];

const Settings = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
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
              {section.items.map((item, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors text-left"
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
                  {item.toggle ? (
                    <div className="w-10 h-6 bg-primary rounded-full relative">
                      <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-primary-foreground rounded-full" />
                    </div>
                  ) : item.connected ? (
                    <span className="text-[11px] text-green-600 font-medium">Connected</span>
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
          className="w-full flex items-center justify-center gap-2 py-3 text-destructive text-[14px] font-medium mt-4"
        >
          <LogOut size={18} />
          Sign out
        </motion.button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Settings;
