import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SevenLogo from "@/components/SevenLogo";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/onboarding");
    }, 1200);
  };

  const handleMagicLink = () => {
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/onboarding");
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <SevenLogo size={52} className="mb-5" />
          </motion.div>
          <h1 className="text-[24px] font-normal text-foreground tracking-[-0.02em]">
            Sign in to Seven
          </h1>
          <p className="text-[14px] text-muted-foreground mt-2">
            Your cognitive continuity layer
          </p>
        </div>

        {/* Google sign in */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 h-[52px] rounded-full bg-card border border-border text-foreground text-[15px] font-medium shadow-sm hover:shadow-md transition-all duration-200 mb-4"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </>
          )}
        </motion.button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[13px] text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Magic link */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
          placeholder="Email address"
          className="w-full bg-card rounded-full px-5 h-[52px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all mb-3"
        />

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleMagicLink}
          disabled={loading || !email.trim()}
          className="w-full h-[52px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] flex items-center justify-center shadow-sm transition-all disabled:opacity-50"
        >
          Send magic link
        </motion.button>

        <p className="text-[12px] text-muted-foreground text-center mt-8 leading-relaxed">
          By continuing, you agree to Seven's<br />
          <span className="text-primary">Terms of Service</span> and{" "}
          <span className="text-primary">Privacy Policy</span>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
