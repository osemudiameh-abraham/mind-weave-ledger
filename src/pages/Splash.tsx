import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/login"), 2800);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full gradient-bg opacity-[0.05] blur-[120px]" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex flex-col items-center gap-5 z-10"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="72" height="60" viewBox="0 0 36 28" fill="none">
              <path d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z" fill="url(#splashsparkle)"/>
              <defs>
                <linearGradient id="splashsparkle" x1="0" y1="0" x2="36" y2="28">
                  <stop stopColor="hsl(217, 91%, 60%)" />
                  <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                  <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
          className="text-2xl font-normal text-foreground tracking-[-0.02em]"
        >
          Seven
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="text-[13px] text-muted-foreground font-light tracking-wide"
        >
          Your mind. Structured.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Splash;
