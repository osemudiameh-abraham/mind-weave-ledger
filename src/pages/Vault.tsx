import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, Briefcase, Heart, Target, User, Pencil, Trash2, Check, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PageError } from "@/components/PageError";
import { VaultSkeleton } from "@/components/PageSkeletons";

const VAULT_EDIT_LIMIT = 30; // Max edits per hour

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
  subject: string;
  attribute: string;
  value_text: string;
  category: string;
  source_type: string;
  created_at: string;
}

const Vault = () => {
  const { user } = useAuth();
  const [active, setActive] = useState("all");
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editCountRef = useRef<{ count: number; resetAt: number }>({ count: 0, resetAt: Date.now() + 3600000 });

  const checkEditLimit = (): boolean => {
    const now = Date.now();
    if (now > editCountRef.current.resetAt) {
      editCountRef.current = { count: 0, resetAt: now + 3600000 };
    }
    if (editCountRef.current.count >= VAULT_EDIT_LIMIT) {
      toast.error("Too many edits. Please wait before making more changes.");
      return false;
    }
    editCountRef.current.count++;
    return true;
  };

  const loadFacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("memory_facts")
      .select("id, subject, attribute, value_text, category, source_type, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("valid_until", null)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error);
      setLoading(false);
      return;
    }
    if (data) setFacts(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadFacts();
  }, [user, loadFacts]);

  const startEdit = (fact: Fact) => {
    setEditingId(fact.id);
    setEditValue(fact.value_text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  // Edit = supersede old fact + insert corrected fact (Architecture Section 6.2)
  const saveEdit = async (fact: Fact) => {
    if (!user || !editValue.trim()) return;
    if (!checkEditLimit()) return;

    // Supersede the old fact
    await supabase.from("memory_facts").update({
      valid_until: new Date().toISOString(),
      status: "superseded",
    }).eq("id", fact.id);

    // Insert corrected fact
    const factKey = `${fact.subject.toLowerCase().trim()}::${fact.attribute.toLowerCase().trim()}`;
    const { error } = await supabase.from("memory_facts").insert({
      user_id: user.id,
      fact_key: factKey,
      subject: fact.subject,
      attribute: fact.attribute,
      value_text: editValue.trim(),
      canonical_text: `${fact.subject} ${fact.attribute} is ${editValue.trim()}`,
      category: fact.category,
      source_type: "corrected",
      confidence: 1.0,
      evidence_count: 1,
      status: "active",
      supersedes_fact_id: fact.id,
    });

    if (error) {
      toast.error("Failed to save correction");
    } else {
      toast.success("Fact corrected");
      setEditingId(null);
      setEditValue("");
      loadFacts();
    }
  };

  // Delete = set valid_until (soft delete, preserves history)
  const deleteFact = async (factId: string) => {
    if (!user) return;
    if (!checkEditLimit()) return;

    const { error } = await supabase.from("memory_facts").update({
      valid_until: new Date().toISOString(),
      status: "superseded",
    }).eq("id", factId);

    if (error) {
      toast.error("Failed to delete fact");
    } else {
      toast.success("Fact removed");
      setFacts((prev) => prev.filter((f) => f.id !== factId));
    }
  };

  const filtered = active === "all" ? facts : facts.filter((f) => f.category === active);

  const sourceLabel = (s: string) => s === "explicit" ? "Stated directly" : s === "corrected" ? "Corrected by you" : "Inferred";

  if (loading) {
    return (
      <AppLayout>
        <VaultSkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <PageError
          title="Unable to load vault"
          message="We couldn't load your memory vault right now. Please try again."
          onRetry={loadFacts}
          error={loadError}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        className="px-4 max-w-[780px] mx-auto"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 0.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
        }}
      >
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Memory Vault</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Everything Seven knows about you</p>
        </motion.div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActive(cat.key)}
              aria-pressed={active === cat.key}
              className={`flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                active === cat.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {cat.icon && <cat.icon size={14} aria-hidden="true" />}
              {cat.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground max-w-[420px] mx-auto leading-relaxed">
              Your memory vault is empty. Start chatting with Seven and it will remember what matters.
            </p>
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
                {editingId === fact.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[12px] text-muted-foreground">{fact.subject}: {fact.attribute}</p>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(fact)}
                      aria-label="Edit fact value"
                      className="bg-muted border border-border rounded-lg px-3 py-2 text-[14px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="Cancel edit"
                        className="w-11 h-11 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(fact)}
                        aria-label="Save edit"
                        className="w-11 h-11 rounded-lg hover:bg-primary/10 text-primary flex items-center justify-center"
                      >
                        <Check size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[14px] text-foreground leading-relaxed mb-3">
                      {fact.subject}: {fact.attribute} — {fact.value_text}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{sourceLabel(fact.source_type)}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(fact.created_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(fact)}
                          className="w-11 h-11 rounded-lg hover:bg-muted text-muted-foreground transition-colors flex items-center justify-center"
                          aria-label="Edit fact"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteFact(fact.id)}
                          className="w-11 h-11 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
                          aria-label="Delete fact"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Vault;
