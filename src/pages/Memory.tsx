import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Clock, TrendingUp, Eye, Shield, ChevronRight } from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

const decisions = [
  { text: "Wake up at 6am every day", date: "Apr 2", status: "kept" as const, outcome: "Maintained for 5 days straight" },
  { text: "No social media after 9pm", date: "Mar 28", status: "missed" as const, outcome: "Lasted 2 days, then slipped" },
  { text: "Read 30 minutes daily", date: "Mar 25", status: "progress" as const, outcome: "Averaging 20 minutes" },
  { text: "Reply to all pending emails", date: "Mar 20", status: "kept" as const, outcome: "Cleared inbox same day" },
];

const patterns = [
  { text: "You tend to abandon goals set on Mondays", confidence: 78, evidence: 12, detected: "Feb 15" },
  { text: "Your most productive window is 9–11am", confidence: 92, evidence: 24, detected: "Jan 8" },
  { text: "You follow through 3x more when you write it down", confidence: 85, evidence: 18, detected: "Mar 1" },
];

const identityData = {
  strengths: ["Morning routines", "Written commitments", "Short-term sprints"],
  blindSpots: ["Evening discipline", "Long-term consistency", "Delegation"],
  metrics: [
    { label: "Follow-through", value: 68 },
    { label: "Pattern awareness", value: 82 },
    { label: "Decision quality", value: 75 },
  ],
};

const facts = [
  { label: "Prefers morning work", source: "Self-reported", date: "Jan 5", confidence: "Confirmed" as const },
  { label: "Struggles with evening goals", source: "Pattern analysis", date: "Feb 20", confidence: "Inferred" as const },
  { label: "Best follow-through on written tasks", source: "Decision ledger", date: "Mar 1", confidence: "Confirmed" as const },
  { label: "Caffeine improves focus", source: "Self-reported", date: "Mar 10", confidence: "Confirmed" as const },
];

const tabs = ["Decisions", "Patterns", "Identity", "Memory"];

const Memory = () => {
  const [tab, setTab] = useState("Decisions");

  const statusBadge = (s: "kept" | "missed" | "progress") => {
    const map = {
      kept: { icon: <CheckCircle size={14} />, label: "Kept", cls: "text-green-600 bg-green-50" },
      missed: { icon: <XCircle size={14} />, label: "Missed", cls: "text-destructive bg-red-50" },
      progress: { icon: <Clock size={14} />, label: "In Progress", cls: "text-yellow-600 bg-yellow-50" },
    };
    const m = map[s];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
        {m.icon}{m.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-16 pb-24 px-4 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-foreground mt-2 mb-4">Memory Intelligence</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-2xl p-1 mb-6">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Decisions */}
        {tab === "Decisions" && (
          <div className="flex flex-col gap-3">
            {decisions.map((d, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-foreground flex-1">{d.text}</p>
                  {statusBadge(d.status)}
                </div>
                <p className="text-xs text-muted-foreground">{d.outcome}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{d.date}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Patterns */}
        {tab === "Patterns" && (
          <div className="flex flex-col gap-3">
            {patterns.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shrink-0">
                    <TrendingUp size={16} className="text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{p.text}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">{p.confidence}% confidence</span>
                      <span className="text-xs text-muted-foreground">{p.evidence} evidence points</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                      <div className="gradient-bg h-1.5 rounded-full transition-all" style={{ width: `${p.confidence}%` }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Identity */}
        {tab === "Identity" && (
          <div className="flex flex-col gap-4">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
              {identityData.metrics.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                  className="p-3 rounded-2xl bg-card border border-border text-center">
                  <div className="relative w-14 h-14 mx-auto mb-2">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="url(#grad)" strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${(m.value / 100) * 150.8} 150.8`} />
                      <defs><linearGradient id="grad"><stop offset="0%" stopColor="hsl(var(--gradient-start))" /><stop offset="100%" stopColor="hsl(var(--gradient-end))" /></linearGradient></defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">{m.value}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">{m.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Strengths & Blind Spots */}
            {[
              { title: "Strengths", items: identityData.strengths, color: "text-green-600" },
              { title: "Blind Spots", items: identityData.blindSpots, color: "text-yellow-600" },
            ].map((section) => (
              <div key={section.title} className="p-4 rounded-2xl bg-card border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">{section.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item) => (
                    <span key={item} className={`px-3 py-1 rounded-full bg-secondary text-xs font-medium ${section.color}`}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Memory Audit */}
        {tab === "Memory" && (
          <div className="flex flex-col gap-2">
            {facts.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  {f.confidence === "Confirmed" ? <Shield size={14} className="text-primary" /> : <Eye size={14} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.label}</p>
                  <p className="text-[10px] text-muted-foreground">{f.source} · {f.date}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${f.confidence === "Confirmed" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                  {f.confidence}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Memory;
