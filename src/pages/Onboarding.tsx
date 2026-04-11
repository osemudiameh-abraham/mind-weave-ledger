import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Mic, ShieldCheck, Lock, EyeOff, BanIcon, Smartphone, MessageSquare, Mail, Activity, Brain, AlertTriangle } from "lucide-react";
import SevenLogo from "@/components/SevenLogo";
import { useAuth } from "@/contexts/AuthContext";

const Onboarding = () => {
  const { completeOnboarding, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [safeWord, setSafeWord] = useState("");
  const [voiceVerify, setVoiceVerify] = useState(false);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const [deviceConsent, setDeviceConsent] = useState(false);
  const [emergencyConsent, setEmergencyConsent] = useState(false);
  const totalSteps = 7;

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) =>
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const next = () => {
    if (step === 1 && name.trim()) {
      localStorage.setItem("seven_user_name", name.trim());
      updateProfile({ name: name.trim() });
    }
    if (step === 5 && safeWord.trim()) {
      localStorage.setItem("seven_safe_word", safeWord.trim());
    }
    if (step < totalSteps) setStep(step + 1);
    else {
      completeOnboarding();
      navigate("/home", { replace: true });
    }
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

  const privacyPromises = [
    { icon: ShieldCheck, text: "Seven will never sell your information" },
    { icon: Lock, text: "Seven guarantees your privacy" },
    { icon: BanIcon, text: "Seven does not run ads — and never will" },
    { icon: EyeOff, text: "Your privacy is fully yours" },
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


          {/* Step 4: Device Access Consent */}
          {step === 4 && (
            <motion.div
              key="consent"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto"
            >
              <h2 className="text-[24px] font-normal text-foreground tracking-[-0.03em] leading-tight">
                Let Seven learn
                <br />
                from your world
              </h2>
              <p className="text-[14px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                Optionally allow Seven to access your devices and apps to deeply understand and assist you.
              </p>

              {/* Main consent toggle */}
              <div className="p-4 rounded-2xl border border-border bg-card mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Brain size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-foreground">Enable deep learning</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">Access device data & connected apps</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeviceConsent(!deviceConsent)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      deviceConsent ? "bg-primary" : "bg-input"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow-lg transition-transform ${
                      deviceConsent ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>

                {deviceConsent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-3 border-t border-border mt-3"
                  >
                    <p className="text-[12px] text-muted-foreground mb-3">Seven will be able to access:</p>
                    <div className="space-y-2">
                      {[
                        { icon: MessageSquare, label: "Messages & WhatsApp" },
                        { icon: Mail, label: "Gmail & email accounts" },
                        { icon: Smartphone, label: "Call logs & device history" },
                        { icon: Activity, label: "Health & activity data" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-1.5">
                          <item.icon size={14} className="text-primary shrink-0" />
                          <span className="text-[13px] text-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[12px] text-muted-foreground mt-4 mb-2 font-medium">Seven can act on your behalf:</p>
                    <div className="space-y-1.5">
                      {[
                        "Write & send emails",
                        "Respond to messages",
                        "Build your CV from your history",
                        "Review & accept opportunities",
                        "Make calls when instructed",
                      ].map((action, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <Check size={12} className="text-primary shrink-0" />
                          <span className="text-[12px] text-muted-foreground">{action}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Emergency consent */}
              <div className="p-4 rounded-2xl border border-border bg-card mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} className="text-destructive" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-foreground">Emergency response</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">Contact help if you're in danger</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEmergencyConsent(!emergencyConsent)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      emergencyConsent ? "bg-primary" : "bg-input"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow-lg transition-transform ${
                      emergencyConsent ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                {emergencyConsent && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border leading-relaxed"
                  >
                    If Seven is ≥95% certain you need help, it will contact local authorities or medical services, clearly identifying itself and providing a unique verification ID.
                  </motion.p>
                )}
              </div>

              {/* Security assurance */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 mb-8">
                <Lock size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  All data is end-to-end encrypted, stored locally on your devices, and never shared with anyone. Your information belongs only to you.
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px]"
              >
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* Step 5: Safe Word & Voice */}
          {step === 5 && (
            <motion.div
              key="safeword"
              custom={1}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="w-full max-w-sm mx-auto"
            >
              <h2 className="text-[24px] font-normal text-foreground tracking-[-0.03em] leading-tight">
                Set your wake word
              </h2>
              <p className="text-[14px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                Say this word to activate Seven hands-free on any connected device. The default is <span className="font-semibold text-foreground">"Hey Seven"</span>.
              </p>

              <input
                type="text"
                value={safeWord}
                onChange={(e) => setSafeWord(e.target.value)}
                placeholder="Choose a custom wake word (optional)"
                className="w-full bg-card rounded-2xl px-5 h-[52px] text-[16px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
              <p className="text-[12px] text-muted-foreground mt-2 px-1">
                Leave blank to use the default: "Hey Seven"
              </p>

              {/* Voice verification */}
              <div className="mt-8 p-4 rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[14px] font-medium text-foreground">Voice verification</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      Only activate for your voice
                    </p>
                  </div>
                  <button
                    onClick={() => setVoiceVerify(!voiceVerify)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      voiceVerify ? "bg-primary" : "bg-input"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow-lg transition-transform ${
                        voiceVerify ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {voiceVerify && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-3 border-t border-border"
                  >
                    <button
                      onClick={() => setVoiceRecorded(true)}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
                        voiceRecorded
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {voiceRecorded ? (
                        <>
                          <Check size={16} />
                          <span className="text-[13px] font-medium">Voice recorded</span>
                        </>
                      ) : (
                        <>
                          <Mic size={16} />
                          <span className="text-[13px] font-medium">Tap to record your voice</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      Say "Hey Seven" clearly so we can learn your voice
                    </p>
                  </motion.div>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] mt-8"
              >
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* Step 6: Privacy */}
          {step === 6 && (
            <motion.div
              key="privacy"
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
                transition={{ delay: 0.1, duration: 0.5 }}
                className="flex justify-center mb-6"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck size={28} className="text-primary" />
                </div>
              </motion.div>

              <h2 className="text-[24px] font-normal text-foreground tracking-[-0.03em] leading-tight text-center">
                Your trust matters
              </h2>
              <p className="text-[14px] text-muted-foreground text-center mt-2 mb-8 leading-relaxed">
                Seven is built with privacy at its core.
              </p>

              <div className="space-y-3 mb-10">
                {privacyPromises.map((promise, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                    className="flex items-center gap-3.5 p-4 rounded-2xl border border-border bg-card"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <promise.icon size={18} className="text-primary" />
                    </div>
                    <p className="text-[14px] font-medium text-foreground">{promise.text}</p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={next}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px]"
              >
                I understand
              </motion.button>
            </motion.div>
          )}

          {/* Step 7: Ready */}
          {step === 7 && (
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
