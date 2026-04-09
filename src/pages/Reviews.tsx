import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

const decisions = [
  {
    id: 1,
    title: "Switched to async standups",
    context: "You decided this on Mar 28 after noticing meeting fatigue patterns",
    date: "Mar 28",
    status: "pending",
  },
  {
    id: 2,
    title: "Started waking up at 6 AM",
    context: "Part of your energy optimization goal. Seven tracked 12 days of data",
    date: "Mar 15",
    status: "pending",
  },
  {
    id: 3,
    title: "Delegated design reviews to Sarah",
    context: "Freed up 4hrs/week. Confidence was medium at decision time",
    date: "Mar 10",
    status: "good",
  },
  {
    id: 4,
    title: "Declined Series B advisory role",
    context: "Aligned with your focus goal. You expressed uncertainty twice",
    date: "Feb 28",
    status: "neutral",
  },
];

const Reviews = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">
            Decision Reviews
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Reflect on past decisions. How did they turn out?
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {decisions.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-[15px] font-medium text-foreground leading-snug flex-1 mr-3">
                  {d.title}
                </h3>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {d.date}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                {d.context}
              </p>

              {d.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors">
                    <ThumbsUp size={14} className="text-primary" /> Good call
                  </button>
                  <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors">
                    <Minus size={14} /> Neutral
                  </button>
                  <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-card text-foreground text-[12px] font-medium hover:bg-muted transition-colors">
                    <ThumbsDown size={14} className="text-destructive" /> Revisit
                  </button>
                </div>
              ) : d.status === "good" ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-primary/10 text-primary">
                  <ThumbsUp size={14} /> Good call
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-muted text-muted-foreground">
                  <Minus size={14} /> Neutral
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Reviews;
