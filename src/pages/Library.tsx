import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, MessageSquare, Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSections } from "@/hooks/use-sections";
import { PageError } from "@/components/PageError";
import { LibrarySkeleton } from "@/components/PageSkeletons";

interface ConvoItem {
  id: string;
  title: string;
  created_at: string;
  preview?: string;
}

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createSection } = useSections();
  const [search, setSearch] = useState("");
  const [convos, setConvos] = useState<ConvoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("sections")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setLoadError(error);
      setLoading(false);
      return;
    }
    if (data) setConvos(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const timeLabel = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(d).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  };

  const filtered = convos.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  const handleNewSection = () => {
    createSection();
    navigate("/home");
  };

  if (loading) {
    return (
      <AppLayout>
        <LibrarySkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <PageError
          title="Unable to load library"
          message="We couldn't load your conversations right now. Please try again."
          onRetry={load}
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
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Library</h1>
          <p className="text-[14px] text-muted-foreground mt-1">All your past conversations</p>
        </motion.div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full pl-10 pr-4 h-11 rounded-full bg-card border border-border text-[14px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center">
            <p className="text-[14px] text-muted-foreground max-w-[420px] mx-auto leading-relaxed mb-6">
              {search
                ? "No matching conversations"
                : "No sections yet. Start a conversation and it will appear here."}
            </p>
            {!search && (
              <button
                type="button"
                onClick={handleNewSection}
                aria-label="Start a new section"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
              >
                <Plus size={16} aria-hidden="true" />
                New Section
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((c, i) => (
              <motion.button
                key={c.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/home?section=${c.id}`)}
                aria-label={`Open conversation: ${c.title}`}
                className="w-full flex items-center gap-3 min-h-[44px] p-3.5 rounded-2xl bg-card border border-border hover:bg-muted transition-colors text-left"
              >
                <MessageSquare size={16} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-foreground truncate">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">{timeLabel(c.created_at)}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Library;
