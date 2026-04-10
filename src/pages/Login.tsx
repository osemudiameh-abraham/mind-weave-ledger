import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "apple" | "email" | null>(null);

  const handleAuth = (method: "google" | "apple" | "email") => {
    if (method === "email" && !email.trim()) return;
    setLoading(method);
    setTimeout(() => { setLoading(null); navigate("/onboarding"); }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[340px] flex flex-col items-center"
      >
        {/* Logo + Name */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-12"
        >
          <svg width="48" height="37" viewBox="0 0 36 28" fill="none">
            <path
              d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z"
              fill="hsl(var(--primary))"
            />
          </svg>
          <span className="text-[22px] font-medium text-foreground tracking-[-0.02em] mt-4">
            Seven
          </span>
        </motion.div>

        {/* Auth buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="w-full space-y-3"
        >
          {/* Google */}
          <button
            onClick={() => handleAuth("google")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 h-[50px] rounded-full bg-card border border-border text-foreground text-[15px] font-medium hover:bg-surface-hover active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
          >
            {loading === "google" ? (
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Apple */}
          <button
            onClick={() => handleAuth("apple")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 h-[50px] rounded-full bg-foreground text-background text-[15px] font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
          >
            {loading === "apple" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </>
            )}
          </button>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex items-center gap-4 w-full my-7"
        >
          <div className="flex-1 h-px bg-border" />
          <span className="text-[13px] text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </motion.div>

        {/* Email */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="w-full space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth("email")}
            placeholder="Email address"
            className="w-full bg-card rounded-full px-5 h-[50px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
          <button
            onClick={() => handleAuth("email")}
            disabled={!!loading || !email.trim()}
            className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] active:scale-[0.98] transition-all duration-150 disabled:opacity-35"
          >
            {loading === "email" ? (
              <Loader2 size={18} className="animate-spin mx-auto" />
            ) : (
              "Continue"
            )}
          </button>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-[11px] text-muted-foreground text-center mt-12 leading-relaxed"
        >
          By continuing, you agree to Seven's{" "}
          <span className="text-primary cursor-pointer">Terms</span> &{" "}
          <span className="text-primary cursor-pointer">Privacy Policy</span>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
