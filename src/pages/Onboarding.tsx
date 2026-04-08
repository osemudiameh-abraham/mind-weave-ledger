import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Search, Scale, Bell, Mic } from "lucide-react";

const steps = ["welcome", "identity", "goals", "notifications", "ready"] as const;

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>(["Morning"]);
  const [frequency, setFrequency] = useState("Daily");

  const interestOptions = ["Decision-making", "Focus", "Habits", "Relationships", "Work performance", "Wellbeing", "All of these"];
  const goalOptions = [
    { icon: "🎯", label: "Follow through on decisions" },
    { icon: "🔍", label: "Understand my patterns" },
    { icon: "⚡", label: "Build better habits" },
    { icon: "📊", label: "Hold myself accountable" },
    { icon: "🧠", label: "Think more clearly" },
  ];

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress */}
      {step > 0 && step < 4 && (
        <div className="px-6 pt-6">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "gradient-bg" : "bg-border"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Step {step + 1} of 5</p>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <motion.div key="welcome" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full max-w-sm">
              <div className="w-16 h-16 rounded-3xl gradient-bg flex items-center justify-center mb-6 shadow-lg mx-auto animate-breathe">
                <span className="text-primary-foreground text-xl font-bold">7M</span>
              </div>
              <h1 className="text-2xl font-semibold text-foreground text-center mb-2">Meet your cognitive layer</h1>
              <p className="text-sm text-muted-foreground text-center mb-8">Seven Mynd learns how you think, decide, and grow — and turns that into structured intelligence you can actually use.</p>

              <div className="flex flex-col gap-4 mb-8">
                {[
                  { icon: <Brain size={20} />, title: "Decision Tracking", desc: "Every commitment you make, logged and followed up" },
                  { icon: <Search size={20} />, title: "Pattern Detection", desc: "Seven Mynd finds what's working and what's not" },
                  { icon: <Scale size={20} />, title: "Governed Memory", desc: "Facts vs assumptions — always clear, always auditable" },
                ].map((f, i) => (
                  <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-card border border-border">
                    <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-primary-foreground shrink-0">{f.icon}</div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={next} className="w-full py-3 rounded-2xl gradient-bg text-primary-foreground font-medium text-sm shadow-md">
                Get started
              </motion.button>
            </motion.div>
          )}

          {/* STEP 1 — Identity */}
          {step === 1 && (
            <motion.div key="identity" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full max-w-sm">
              <h2 className="text-xl font-semibold text-foreground mb-2">What should Seven Mynd call you?</h2>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name"
                className="w-full bg-secondary rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 mb-8" />

              <h3 className="text-sm font-medium text-foreground mb-3">What do you want to get better at?</h3>
              <div className="flex flex-wrap gap-2 mb-8">
                {interestOptions.map((opt) => (
                  <motion.button key={opt} whileTap={{ scale: 0.95 }} onClick={() => toggle(interests, opt, setInterests)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${interests.includes(opt) ? "gradient-bg text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {opt}
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={next} className="w-full py-3 rounded-2xl gradient-bg text-primary-foreground font-medium text-sm shadow-md">
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* STEP 2 — Goals */}
          {step === 2 && (
            <motion.div key="goals" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full max-w-sm">
              <h2 className="text-xl font-semibold text-foreground mb-2">What does success look like for you?</h2>
              <p className="text-sm text-muted-foreground mb-6">Select all that apply</p>

              <div className="flex flex-col gap-3 mb-8">
                {goalOptions.map((g) => (
                  <motion.button key={g.label} whileTap={{ scale: 0.97 }} onClick={() => toggle(goals, g.label, setGoals)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${goals.includes(g.label) ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                    <span className="text-xl">{g.icon}</span>
                    <span className="text-sm font-medium text-foreground">{g.label}</span>
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={next} className="w-full py-3 rounded-2xl gradient-bg text-primary-foreground font-medium text-sm shadow-md">
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* STEP 3 — Notifications */}
          {step === 3 && (
            <motion.div key="notifs" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4 mx-auto">
                <Bell size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2 text-center">When should Seven Mynd check in?</h2>

              <div className="flex gap-2 justify-center mb-6 mt-6">
                {["Morning", "Midday", "Evening"].map((t) => (
                  <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => toggle(times, t, setTimes)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${times.includes(t) ? "gradient-bg text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {t}
                  </motion.button>
                ))}
              </div>

              <h3 className="text-sm font-medium text-foreground mb-3 text-center">How often?</h3>
              <div className="flex gap-2 justify-center mb-8">
                {["Daily", "A few times a week", "Weekly"].map((f) => (
                  <motion.button key={f} whileTap={{ scale: 0.95 }} onClick={() => setFrequency(f)}
                    className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${frequency === f ? "gradient-bg text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {f}
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={next} className="w-full py-3 rounded-2xl gradient-bg text-primary-foreground font-medium text-sm shadow-md">
                Allow notifications
              </motion.button>
              <button onClick={next} className="w-full py-2 text-xs text-muted-foreground mt-2">Not now</button>
            </motion.div>
          )}

          {/* STEP 4 — Ready */}
          {step === 4 && (
            <motion.div key="ready" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm text-center">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 rounded-3xl gradient-bg flex items-center justify-center mb-6 shadow-lg mx-auto">
                <span className="text-primary-foreground text-2xl font-bold">7M</span>
              </motion.div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">{name || "Friend"}, your cognitive layer is ready.</h1>
              <p className="text-sm text-muted-foreground mb-8">Seven Mynd will learn from every interaction. The longer you use it, the smarter it gets — about you.</p>

              <motion.button whileTap={{ scale: 0.97 }} onClick={next} className="w-full py-3 rounded-2xl gradient-bg text-primary-foreground font-medium text-sm shadow-md">
                Enter Seven Mynd
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
