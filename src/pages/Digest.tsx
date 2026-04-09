import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle } from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import SevenLogo from "@/components/SevenLogo";

const Digest = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-[12px] font-medium text-primary mb-1">WEEKLY DIGEST</p>
          <h1 className="text-[22px] font-medium text-foreground tracking-tight">Mar 31 – Apr 6</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Here's what Seven observed this week</p>
        </motion.div>

        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <SevenLogo size={18} />
            <span className="text-[13px] font-medium text-foreground">Seven's Summary</span>
          </div>
          <p className="text-[14px] text-foreground/80 leading-relaxed">
            Strong week for decision consistency. You followed through on 4 of 5 commitments.
            Energy patterns suggest Tuesday mornings are your peak. One area to watch: you're
            deferring the hiring decision again.
          </p>
        </motion.div>

        {/* Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 mb-4"
        >
          {[
            { label: "Decisions", value: "7", trend: "up" },
            { label: "Follow-through", value: "80%", trend: "up" },
            { label: "Avg Energy", value: "7.2", trend: "neutral" },
          ].map((m, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-[20px] font-medium text-foreground">{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
              <div className="flex items-center justify-center mt-2">
                {m.trend === "up" && <TrendingUp size={14} className="text-green-600" />}
                {m.trend === "down" && <TrendingDown size={14} className="text-destructive" />}
                {m.trend === "neutral" && <Minus size={14} className="text-muted-foreground" />}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Key moments */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl p-5 mb-4"
        >
          <h3 className="text-[14px] font-medium text-foreground mb-4">Key Moments</h3>
          <div className="flex flex-col gap-4">
            {[
              { icon: CheckCircle2, color: "text-green-600", text: "Successfully delegated design reviews — freed up 4 hours" },
              { icon: CheckCircle2, color: "text-green-600", text: "Maintained 6 AM wake-up for 5 consecutive days" },
              { icon: AlertCircle, color: "text-amber-500", text: "Hiring decision deferred for the 4th time" },
              { icon: CheckCircle2, color: "text-green-600", text: "Completed Q2 roadmap ahead of schedule" },
            ].map((m, i) => (
              <div key={i} className="flex items-start gap-3">
                <m.icon size={18} className={`${m.color} shrink-0 mt-0.5`} />
                <p className="text-[13px] text-foreground/80 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pattern insight */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-primary/5 border border-primary/20 rounded-2xl p-5"
        >
          <p className="text-[12px] font-semibold text-primary uppercase tracking-wide mb-2">Pattern Insight</p>
          <p className="text-[14px] text-foreground leading-relaxed">
            When you make decisions before 10 AM, your satisfaction rating is 40% higher.
            Consider scheduling important choices in your morning block.
          </p>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Digest;
