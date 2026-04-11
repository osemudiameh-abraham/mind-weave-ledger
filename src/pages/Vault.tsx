import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Brain, Briefcase, Heart, Target, User, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const categories = [
  { key: "all", label: "All", icon: null },
  { key: "identity", label: "Identity", icon: User },
  { key: "work", label: "Work", icon: Briefcase },
  { key: "values", label: "Values", icon: Heart },
  { key: "goals", label: "Goals", icon: Target },
  { key: "patterns", label: "Patterns", icon: Brain },
];

interface Fact {
  id: string;
  category: string;
  text: string;
  source: string;
  date: string;
}

const Vault = () => {
  const { user } = useAuth();
  const [active, setActive] = useState("all");
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("memory_facts")
        .select("id, subject, attribute, value, category, source_type, created_at")
        .eq("user_id", user.id)
        .is("valid_until", null)
        .order("created_at", { ascending: false });

      if (data) {
        setFacts(
          data.map((f) => ({
            id: f.id,
            category: f.category || "general",
            text: `${f.subject}: ${f.attribute} — ${f.value}`,
            source: f.source_type === "explicit" ? "Stated directly" : f.source_type === "corrected" ? "Corrected by you" : "Inferred from conversation",
            date: new Date(f.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = active === "all" ? facts : facts.filter((f) => f.category === active);

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-5xl mx-auto">
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground">No facts yet. Start chatting and Seven will learn about you.</p>
          </div>
        ) : (
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
        )}
      </div>
    </AppLayout>
  );
};

export default Vault;
