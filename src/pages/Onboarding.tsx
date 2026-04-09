import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Search, Scale, Bell, ArrowLeft } from "lucide-react";

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
    else navigate("/home");
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const chipClass = (active: boolean) =>
    `px-4 py-2.5 rounded-full text-[13px] font-medium transition-all duration-200 border ${
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-card text-foreground border-border hover:bg-surface-hover"
    }`;

  const btnClass = "w-full h-12 rounded-full bg-primary text-primary-foreground font-medium text-[14px] shadow-sm hover:shadow-md transition-all duration-200";

  const slideVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar with back + progress */}
      {step > 0 && step < 4 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-5 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={back} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-card transition-colors">
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <div className="flex gap-1.5 flex-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${s <= step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <motion.div key="welcome" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm">
              <div className="flex justify-center mb-8">
                <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                  <svg width="56" height="46" viewBox="0 0 36 28" fill="none">
                    <path d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z" fill="url(#obsparkle)"/>
                    <defs>
                      <linearGradient id="obsparkle" x1="0" y1="0" x2="36" y2="28">
                        <stop stopColor="hsl(217, 91%, 60%)" />
                        <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                        <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
                      </linearGradient>
                    </defs>
                  </svg>
                </motion.div>
              </div>
              <h1 className="text-[24px] font-normal text-foreground text-center mb-2 tracking-[-0.02em]">Meet your cognitive layer</h1>
              <p className="text-[13px] text-muted-foreground text-center mb-8 leading-relaxed">Seven learns how you think, decide, and grow — and turns that into structured intelligence.</p>

              <div className="flex flex-col gap-3 mb-8">
                {[
                  { icon: <Brain size={20} />, title: "Decision Tracking", desc: "Every commitment you make, logged and followed up" },
                  { icon: <Search size={20} />, title: "Pattern Detection", desc: "Seven finds what's working and what's not" },
                  { icon: <Scale size={20} />, title: "Governed Memory", desc: "Facts vs assumptions — always clear, always auditable" },
                ].map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                    className="flex gap-4 items-start p-4 rounded-2xl bg-card border border-border hover:shadow-sm transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">{f.icon}</div>
                    <div>
                      <h3 className="text-[14px] font-medium text-foreground">{f.title}</h3>
                      <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={next} className={btnClass}>
                Get started
              </motion.button>
            </motion.div>
          )}

          {/* STEP 1 — Identity */}
          {step === 1 && (
            <motion.div key="identity" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm">
              <h2 className="text-[22px] font-normal text-foreground mb-2 tracking-[-0.02em]">What should Seven call you?</h2>
              <p className="text-[13px] text-muted-foreground mb-6">We'll personalize your experience.</p>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name"
                className="w-full bg-card rounded-2xl px-4 h-12 text-[14px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200 mb-8" />

              <h3 className="text-[14px] font-medium text-foreground mb-3">What do you want to get better at?</h3>
              <div className="flex flex-wrap gap-2 mb-8">
                {interestOptions.map((opt) => (
                  <motion.button key={opt} whileTap={{ scale: 0.95 }} onClick={() => toggle(interests, opt, setInterests)}
                    className={chipClass(interests.includes(opt))}>
                    {opt}
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={next} className={btnClass}>
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* STEP 2 — Goals */}
          {step === 2 && (
            <motion.div key="goals" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm">
              <h2 className="text-[22px] font-normal text-foreground mb-2 tracking-[-0.02em]">What does success look like?</h2>
              <p className="text-[13px] text-muted-foreground mb-6">Select all that apply</p>

              <div className="flex flex-col gap-2.5 mb-8">
                {goalOptions.map((g, i) => (
                  <motion.button
                    key={g.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(goals, g.label, setGoals)}
                    className={`flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 ${
                      goals.includes(g.label) ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-surface-hover"
                    }`}
                  >
                    <span className="text-xl">{g.icon}</span>
                    <span className="text-[14px] font-medium text-foreground">{g.label}</span>
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={next} className={btnClass}>
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* STEP 3 — Notifications */}
          {step === 3 && (
            <motion.div key="notifs" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 mx-auto">
                <Bell size={28} className="text-primary" />
              </div>
              <h2 className="text-[22px] font-normal text-foreground mb-2 tracking-[-0.02em]">When should Seven check in?</h2>
              <p className="text-[13px] text-muted-foreground mb-6">Choose your preferred times</p>

              <div className="flex gap-2 justify-center mb-8">
                {["Morning", "Midday", "Evening"].map((t) => (
                  <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => toggle(times, t, setTimes)}
                    className={chipClass(times.includes(t))}>
                    {t}
                  </motion.button>
                ))}
              </div>

              <h3 className="text-[14px] font-medium text-foreground mb-3">How often?</h3>
              <div className="flex gap-2 justify-center mb-8">
                {["Daily", "Few times/week", "Weekly"].map((f) => (
                  <motion.button key={f} whileTap={{ scale: 0.95 }} onClick={() => setFrequency(f)}
                    className={chipClass(frequency === f)}>
                    {f}
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={next} className={btnClass}>
                Allow notifications
              </motion.button>
              <button onClick={next} className="w-full py-3 text-[13px] text-muted-foreground mt-1 hover:text-foreground transition-colors">Not now</button>
            </motion.div>
          )}

          {/* STEP 4 — Ready */}
          {step === 4 && (
            <motion.div key="ready" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm text-center">
              <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                <svg width="72" height="60" viewBox="0 0 36 28" fill="none" className="mx-auto mb-8">
                  <path d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z" fill="url(#readysparkle)"/>
                  <defs>
                    <linearGradient id="readysparkle" x1="0" y1="0" x2="36" y2="28">
                      <stop stopColor="hsl(217, 91%, 60%)" />
                      <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                      <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
              <h1 className="text-[24px] font-normal text-foreground mb-3 tracking-[-0.02em]">{name || "Friend"}, you're all set.</h1>
              <p className="text-[13px] text-muted-foreground mb-8 leading-relaxed">Seven will learn from every interaction.<br />The longer you use it, the smarter it gets.</p>

              <motion.button whileTap={{ scale: 0.98 }} onClick={next} className={btnClass}>
                Enter Seven
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
