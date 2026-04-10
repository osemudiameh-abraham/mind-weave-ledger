import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import SevenLogo from "@/components/SevenLogo";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const totalSteps = 4;

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) =>
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const next = () => {
    if (step === 1 && name.trim()) {
      localStorage.setItem("seven_user_name", name.trim());
    }
    if (step < totalSteps) setStep(step + 1);
    else navigate("/home");
  };
  const back = () => step > 0 && setStep(step - 1);

  const focusOptions = [
    "Decision-making",
    "Focus & clarity",
    "Building habits",
    "Relationships",
    "Work performance",
    "Wellbeing",
  ];

  const goalOptions = [
    { emoji: "🎯", label: "Follow through on decisions" },
    { emoji: "🔍", label: "Understand my patterns" },
    { emoji: "⚡", label: "Build better habits" },
    { emoji: "🧠", label: "Think more clearly" },
  ];

  const slide = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
  };

  const chipActive =
    "bg-primary text-primary-foreground border-primary shadow-sm";
  const chipInactive =
    "bg-card text-foreground border-border hover:border-muted-foreground/30";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        {step > 0 && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={back}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft size={20} className="text-foreground" />
          </motion.button>
        )}
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: totalSteps + 1 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-[3px] flex-1 rounded-full"
              initial={false}
              animate={{
                backgroundColor:
                  i <= step
                    ? "hsl(var(--primary))"
                    : "hsl(var(--border))",
              }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <AnimatePresence mode="wait" custom={1}>
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-center mb-8"
              >
                <SevenLogo size={52} />
              </motion.div>

              <h1 className="text-[26px] font-normal text-foreground text-center tracking-[-0.03em] leading-tight">
                Your AI that never
                <br />
                forgets you
              </h1>
              <p className="text-[14px] text-muted-foreground text-center mt-3 mb-10 leading-relaxed">
                Seven learns how you think and helps you
                <br />
                make better decisions over time.
              </p>

              <div className="space-y-3 mb-10">
                {[
                  { title: "Remembers everything", desc: "Decisions, patterns, and context — always" },
                  { title: "Finds your patterns", desc: "What's working and what needs attention" },
                  { title: "Keeps you accountable", desc: "Gentle follow-ups that actually help" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                    className="flex items-start gap-3.5 py-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-foreground">{item.title}</p>
                      <p className="text-[13px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px]"
              >
                Get started
              </motion.button>
            </motion.div>
          )}

          {/* Step 1: Name */}
          {step === 1 && (
            <motion.div
              key="name"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto"
            >
              <h2 className="text-[24px] font-normal text-foreground tracking-[-0.03em] leading-tight">
                What should we
                <br />
                call you?
              </h2>
              <p className="text-[14px] text-muted-foreground mt-2 mb-8">
                This helps Seven personalize your experience.
              </p>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && next()}
                placeholder="Your first name"
                autoFocus
                className="w-full bg-card rounded-2xl px-5 h-[52px] text-[16px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                disabled={!name.trim()}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] mt-8 disabled:opacity-35 transition-opacity"
              >
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Focus areas */}
          {step === 2 && (
            <motion.div
              key="focus"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto"
            >
              <h2 className="text-[24px] font-normal text-foreground tracking-[-0.03em] leading-tight">
                What do you want to
                <br />
                get better at?
              </h2>
              <p className="text-[14px] text-muted-foreground mt-2 mb-8">
                Select as many as you like.
              </p>

              <div className="flex flex-wrap gap-2.5 mb-10">
                {focusOptions.map((opt, i) => (
                  <motion.button
                    key={opt}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    onClick={() => toggle(selected, opt, setSelected)}
                    className={`px-4 py-2.5 rounded-full text-[13px] font-medium border transition-all duration-200 ${
                      selected.includes(opt) ? chipActive : chipInactive
                    }`}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                disabled={selected.length === 0}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] disabled:opacity-35 transition-opacity"
              >
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <motion.div
              key="goals"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto"
            >
              <h2 className="text-[24px] font-normal text-foreground tracking-[-0.03em] leading-tight">
                What does success
                <br />
                look like for you?
              </h2>
              <p className="text-[14px] text-muted-foreground mt-2 mb-8">
                Pick what matters most.
              </p>

              <div className="space-y-2.5 mb-10">
                {goalOptions.map((g, i) => (
                  <motion.button
                    key={g.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    onClick={() => toggle(goals, g.label, setGoals)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200 ${
                      goals.includes(g.label)
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="text-xl">{g.emoji}</span>
                    <span className="text-[14px] font-medium text-foreground flex-1">{g.label}</span>
                    {goals.includes(g.label) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check size={12} className="text-primary-foreground" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                disabled={goals.length === 0}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] disabled:opacity-35 transition-opacity"
              >
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <motion.div
              key="ready"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto text-center"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="flex justify-center mb-6"
              >
                <SevenLogo size={64} />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-[26px] font-normal text-foreground tracking-[-0.03em]"
              >
                You're all set, {name || "friend"}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="text-[14px] text-muted-foreground mt-3 mb-10 leading-relaxed"
              >
                Seven gets smarter the more you use it.
                <br />
                Let's begin.
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                whileTap={{ scale: 0.98 }}
                onClick={next}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px]"
              >
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
