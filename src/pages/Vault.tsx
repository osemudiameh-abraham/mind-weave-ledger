import { motion } from "framer-motion";
import { useState } from "react";
import { Brain, Briefcase, Heart, Target, User } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const categories = [
  { key: "all", label: "All", icon: null },
  { key: "identity", label: "Identity", icon: User },
  { key: "work", label: "Work", icon: Briefcase },
  { key: "values", label: "Values", icon: Heart },
  { key: "goals", label: "Goals", icon: Target },
  { key: "patterns", label: "Patterns", icon: Brain },
];

const facts = [
  { id: 1, category: "identity", text: "You're a first-time founder building in AI", source: "Inferred from 14 conversations", date: "Apr 2" },
  { id: 2, category: "work", text: "You prefer async communication over meetings", source: "Stated directly on Mar 12", date: "Mar 12" },
  { id: 3, category: "values", text: "Autonomy is your #1 work value", source: "Consistent across 8 decisions", date: "Mar 8" },
  { id: 4, category: "goals", text: "Launch MVP by end of Q2 2026", source: "Set as primary goal on Feb 15", date: "Feb 15" },
  { id: 5, category: "patterns", text: "You make better decisions in the morning", source: "Tracked over 23 data points", date: "Mar 20" },
  { id: 6, category: "identity", text: "You grew up in a multilingual household", source: "Mentioned in conversation", date: "Feb 28" },
  { id: 7, category: "work", text: "Design reviews drain your energy the most", source: "Energy tracking pattern", date: "Mar 18" },
  { id: 8, category: "goals", text: "Run a half marathon by September", source: "Set on Jan 10", date: "Jan 10" },
];

const Vault = () => {
  const [active, setActive] = useState("all");
  const filtered = active === "all" ? facts : facts.filter((f) => f.category === active);

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Memory Vault</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Everything Seven knows about you</p>
        </motion.div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActive(cat.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                active === cat.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {cat.icon && <cat.icon size={14} />}
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map((fact, i) => (
            <motion.div
              key={fact.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <p className="text-[14px] text-foreground leading-relaxed mb-3">{fact.text}</p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{fact.source}</span>
                <span className="text-[11px] text-muted-foreground">{fact.date}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Vault;
