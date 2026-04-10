import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Pin, Mic, MessageSquare } from "lucide-react";
import AppLayout from "@/components/AppLayout";

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
    <AppLayout>
      <div className="pt-14 pb-24 px-4 max-w-lg mx-auto">
        <div className="relative mt-3 mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations"
            className="w-full bg-card rounded-full pl-11 pr-4 h-11 text-[14px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200" />
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-0.5">
          {filters.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 border ${
                activeFilter === f 
                  ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                  : "bg-card text-foreground border-border hover:bg-surface-hover"
              }`}>
              {f}
            </button>
          ))}
        </div>

        {pinned.length > 0 && (
          <>
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3 px-1">Pinned</h3>
            {pinned.map((item, i) => (
              <ChatCard key={item.id} item={item} typeIcon={typeIcon} index={i} />
            ))}
          </>
        )}

        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3 mt-5 px-1">Recent</h3>
        {unpinned.map((item, i) => (
          <ChatCard key={item.id} item={item} typeIcon={typeIcon} index={i} />
        ))}
      </div>
    </AppLayout>
  );
};

const ChatCard = ({ item, typeIcon, index }: { item: ChatItem; typeIcon: (t: ChatItem["type"]) => React.ReactNode; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.04, duration: 0.3 }}
    whileTap={{ scale: 0.98 }}
    className="flex items-start gap-3 p-3.5 rounded-2xl hover:bg-card active:bg-card transition-all duration-150 mb-0.5 cursor-pointer"
  >
    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
      {typeIcon(item.type)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-medium text-foreground truncate">{item.title}</span>
        {item.pinned && <Pin size={12} className="text-primary shrink-0" />}
      </div>
      <p className="text-[12px] text-muted-foreground truncate mt-0.5 leading-relaxed">{item.preview}</p>
    </div>
    <span className="text-[10px] text-muted-foreground shrink-0 mt-1.5">{item.time}</span>
  </motion.div>
);

export default Library;
