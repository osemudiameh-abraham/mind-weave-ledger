import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Pin, Mic, MessageSquare } from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

interface ChatItem {
  id: string;
  title: string;
  preview: string;
  time: string;
  pinned?: boolean;
  type: "chat" | "voice" | "decision" | "pattern" | "checkin";
}

const demoChats: ChatItem[] = [
  { id: "1", title: "Morning reflection", preview: "I talked about my goals for the week and committed to...", time: "9:15 AM", pinned: true, type: "chat" },
  { id: "2", title: "Decision: career change", preview: "Explored pros and cons of switching roles at work...", time: "Yesterday", type: "decision" },
  { id: "3", title: "Live session — evening check-in", preview: "Voice session about stress management patterns...", time: "2 days ago", type: "voice" },
  { id: "4", title: "Pattern detected", preview: "You're 3x more likely to follow through on mornings...", time: "3 days ago", type: "pattern" },
  { id: "5", title: "Weekly habits review", preview: "Reviewed habit tracking, discussed sleep patterns...", time: "Last week", type: "checkin" },
  { id: "6", title: "Goal setting session", preview: "Set 3 new objectives for Q2, identified blockers...", time: "Last week", type: "chat" },
];

const filters = ["All", "Decisions", "Patterns", "Check-ins", "Voice"];

const Library = () => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = demoChats.filter((c) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Decisions") return c.type === "decision";
    if (activeFilter === "Patterns") return c.type === "pattern";
    if (activeFilter === "Check-ins") return c.type === "checkin";
    if (activeFilter === "Voice") return c.type === "voice";
    return true;
  });

  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  const typeIcon = (type: ChatItem["type"]) => {
    switch (type) {
      case "voice": return <Mic size={14} className="text-primary" />;
      default: return <MessageSquare size={14} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-14 pb-24 px-4 max-w-lg mx-auto">
        {/* Search */}
        <div className="relative mt-3 mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations"
            className="w-full bg-card rounded-full pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary transition-colors" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeFilter === f 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-card text-foreground border-border"
              }`}>
              {f}
            </button>
          ))}
        </div>

        {/* Pinned */}
        {pinned.length > 0 && (
          <>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Pinned</h3>
            {pinned.map((item) => (
              <ChatCard key={item.id} item={item} typeIcon={typeIcon} />
            ))}
          </>
        )}

        {/* Recent */}
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 mt-4">Recent</h3>
        {unpinned.map((item) => (
          <ChatCard key={item.id} item={item} typeIcon={typeIcon} />
        ))}
      </div>
      <BottomNav />
    </div>
  );
};

const ChatCard = ({ item, typeIcon }: { item: ChatItem; typeIcon: (t: ChatItem["type"]) => React.ReactNode }) => (
  <motion.div whileTap={{ scale: 0.98 }} className="flex items-start gap-3 p-3 rounded-2xl hover:bg-card transition-colors mb-1 cursor-pointer">
    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
      {typeIcon(item.type)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
        {item.pinned && <Pin size={12} className="text-primary shrink-0" />}
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.preview}</p>
    </div>
    <span className="text-[10px] text-muted-foreground shrink-0 mt-1">{item.time}</span>
  </motion.div>
);

export default Library;
