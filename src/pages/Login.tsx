import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState<"google" | "apple" | "email" | null>(null);
  const [error, setError] = useState("");

  // If already authenticated, redirect
  if (isAuthenticated && user?.onboardingComplete) {
    navigate("/home", { replace: true });
    return null;
  }

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }
    setLoading("email");
    setError("");

      const result = await signIn(email, password);
      setLoading(null);
      if (result.success) {
        if (result.needsVerification) {
          navigate("/verify", { replace: true });
        } else {
          navigate("/home", { replace: true });
        }
      } else {
        setError(result.error || "Login failed");
      }
  };

  const handleSocialAuth = async (method: "google" | "apple") => {
    if (method === "google") {
      setLoading("google");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/home` },
      });
      if (error) {
        toast.error(error.message);
        setLoading(null);
      }
    } else {
      toast("Apple login coming soon", { duration: 3000 });
    }
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

        {/* Social auth */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="w-full space-y-3"
        >
          <button
            onClick={() => handleSocialAuth("google")}
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

          <button
            onClick={() => handleSocialAuth("apple")}
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

        {/* Email + Password */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="w-full space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="Email address"
            className="w-full bg-card rounded-full px-5 h-[50px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
              placeholder="Password"
              className="w-full bg-card rounded-full px-5 h-[50px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 pr-12"
            />
            <button
              onClick={() => setShowPw(!showPw)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[12px] text-destructive px-2"
            >
              {error}
            </motion.p>
          )}

          <button
            onClick={handleEmailLogin}
            disabled={!!loading || !email.trim() || !password.trim()}
            className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] active:scale-[0.98] transition-all duration-150 disabled:opacity-35"
          >
            {loading === "email" ? (
              <Loader2 size={18} className="animate-spin mx-auto" />
            ) : (
              "Sign in"
            )}
          </button>
        </motion.div>

        {/* Sign up link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-center mt-8"
        >
          <span className="text-[13px] text-muted-foreground">Don't have an account? </span>
          <button
            onClick={() => navigate("/signup")}
            className="text-[13px] text-primary font-medium hover:underline"
          >
            Sign up
          </button>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed"
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
