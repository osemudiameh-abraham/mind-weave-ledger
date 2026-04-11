import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface ConvoItem {
  id: string;
  title: string;
  created_at: string;
  preview?: string;
}

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [convos, setConvos] = useState<ConvoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sections")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setConvos(data);
      setLoading(false);
    };
    load();
  }, [user]);

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

  return (
    <AppLayout>
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Library</h1>
          <p className="text-[14px] text-muted-foreground mt-1">All your past conversations</p>
        </motion.div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-10 pr-4 h-11 rounded-full bg-card border border-border text-[14px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[14px] text-muted-foreground">{search ? "No matching conversations" : "No conversations yet"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate("/home")}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border hover:bg-muted transition-colors text-left"
              >
                <MessageSquare size={16} className="text-muted-foreground flex-shrink-0" />
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
