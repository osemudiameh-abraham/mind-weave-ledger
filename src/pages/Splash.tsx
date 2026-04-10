import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Splash = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "reveal" | "exit">("intro");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 1000);
    const t2 = setTimeout(() => setPhase("exit"), 2600);
    const t3 = setTimeout(() => navigate("/login"), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Animated radial rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.06, 0], scale: [0.2, 1.8, 2.5] }}
          transition={{
            duration: 2.5,
            delay: 0.3 + i * 0.4,
            ease: "easeOut",
          }}
          className="absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            border: "1px solid hsl(var(--primary) / 0.15)",
          }}
        />
      ))}

      {/* Soft glow behind star */}
      <motion.div
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 0.12, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute w-[280px] h-[280px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)",
        }}
      />

      <AnimatePresence mode="wait">
        {phase !== "exit" ? (
          <motion.div
            key="splash-content"
            exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
            transition={{ duration: 0.5, ease: "easeIn" }}
            className="flex flex-col items-center z-10"
          >
            {/* Star with draw-in + rotation */}
            <motion.div
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                animate={{
                  scale: [1, 1.08, 1],
                  rotate: [0, 3, -3, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <svg width="72" height="56" viewBox="0 0 36 28" fill="none">
                  <defs>
                    <linearGradient id="starGrad" x1="0" y1="0" x2="36" y2="28">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(250, 80%, 58%)" />
                    </linearGradient>
                    <filter id="starGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z"
                    fill="url(#starGrad)"
                    filter="url(#starGlow)"
                  />
                </svg>
              </motion.div>
            </motion.div>

            {/* Name with letter stagger */}
            <motion.div
              className="mt-6 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={phase === "reveal" ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-center gap-[2px]">
                {"Seven".split("").map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={phase === "reveal" ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: 0.4,
                      delay: i * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="text-[28px] font-medium text-foreground tracking-[-0.02em] inline-block"
                  >
                    {char}
                  </motion.span>
                ))}
              </div>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={phase === "reveal" ? { opacity: 0.5, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
                className="text-[12px] text-muted-foreground text-center mt-2 tracking-widest uppercase font-light"
              >
                Your mind. Structured.
              </motion.p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Bottom loading bar */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-primary/20 overflow-hidden"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 120, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.8, delay: 0.9, ease: "easeInOut" }}
        />
      </motion.div>
    </div>
  );
};

export default Splash;
