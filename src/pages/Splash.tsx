import { motion } from "framer-motion";
import SevenLogo from "@/components/SevenLogo";
import { Brain, Shield, Activity } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  { icon: Brain, title: "Total Recall", desc: "Every conversation remembered permanently. No resets. No forgetting." },
  { icon: Shield, title: "Decision Intelligence", desc: "Tracks your decisions, schedules reviews, and closes the outcome loop." },
  { icon: Activity, title: "Pattern Detection", desc: "Surfaces behavioural patterns before they become costly mistakes." },
];

const Splash = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isVerified, user } = useAuth();
  const [phase, setPhase] = useState<"intro" | "reveal" | "landing">("intro");
  const hasRedirected = useRef(false);

  // Auth redirect — completely separate from animation
  useEffect(() => {
    if (hasRedirected.current) return;
    if (isAuthenticated && user) {
      hasRedirected.current = true;
      if (!user.onboardingComplete) {
        navigate("/onboarding", { replace: true });
      } else if (!isVerified) {
        navigate("/verify", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    }
  }, [isAuthenticated, isVerified, user, navigate]);

  // Animation — runs once on mount, never resets
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 1000);
    const t2 = setTimeout(() => setPhase("landing"), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-[0.08]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)" }}
      />

      {/* Phase 1+2: Animated intro */}
      {phase !== "landing" && (
        <div className="min-h-screen flex items-center justify-center absolute inset-0 z-10">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.06, 0], scale: [0.2, 1.8, 2.5] }}
              transition={{ duration: 2.5, delay: 0.3 + i * 0.4, ease: "easeOut" }}
              className="absolute rounded-full"
              style={{ width: 300, height: 300, border: "1px solid hsl(var(--primary) / 0.15)" }}
            />
          ))}

          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <SevenLogo size={72} />
              </motion.div>
            </motion.div>

            {phase === "reveal" && (
              <motion.div className="mt-6 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="flex items-center justify-center gap-[2px]">
                  {"Seven".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="text-[28px] font-medium text-foreground tracking-[-0.02em] inline-block"
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 0.5, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
                  className="text-[12px] text-muted-foreground text-center mt-2 tracking-widest uppercase font-light"
                >
                  Your mind. Structured.
                </motion.p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Phase 3: Landing page */}
      {phase === "landing" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center px-4 pt-12 pb-12 max-w-3xl mx-auto"
        >
          <SevenLogo size={48} />
          <h2 className="text-[16px] font-medium text-foreground tracking-[-0.02em] mt-3">Seven Mynd</h2>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-[28px] md:text-[36px] font-semibold text-foreground tracking-tight text-center mt-6 leading-tight"
          >
            The AI that actually<br />remembers you
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-[14px] md:text-[15px] text-muted-foreground text-center mt-4 max-w-[480px] leading-relaxed"
          >
            Seven Mynd is a cognitive continuity system. It remembers your conversations,
            tracks your decisions, detects your behavioural patterns, and helps you make
            better choices over time. Every conversation builds on the last — so the longer
            you use it, the smarter it gets about you.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8 w-full">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                className="bg-card border border-border rounded-2xl p-4 text-center"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2.5">
                  <f.icon size={18} className="text-primary" />
                </div>
                <h3 className="text-[14px] font-medium text-foreground mb-1">{f.title}</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-[340px]"
          >
            <Link to="/signup" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium text-center hover:bg-primary/90 transition-colors">
              Get Started
            </Link>
            <Link to="/login" className="flex-1 py-3 rounded-xl bg-card border border-border text-foreground text-[14px] font-medium text-center hover:bg-muted transition-colors">
              Sign In
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="flex items-center gap-3 mt-6 text-[11px] text-muted-foreground"
          >
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </motion.div>
        </motion.div>
      )}
    </main>
  );
};

export default Splash;
