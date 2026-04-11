import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SignUp = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Fair", "Strong"];
  const strengthColor = ["", "bg-destructive", "bg-yellow-500", "bg-green-500"];

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }

    setLoading(true);
    const result = await signUp(name, email, password);
    setLoading(false);
    if (result.success) {
      toast.success("Account created!");
      navigate("/onboarding", { replace: true });
    } else {
      setError(result.error || "Sign up failed");
    }
  };

  const handleSocialAuth = (method: "google" | "apple") => {
    toast("Social sign up will be available when backend is connected", { duration: 3000 });
  };

  const inputClass = "w-full bg-card rounded-2xl px-4 h-12 text-[14px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10">
          <svg width="44" height="36" viewBox="0 0 36 28" fill="none" className="mb-4">
            <path d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z" fill="url(#signupsparkle)"/>
            <defs>
              <linearGradient id="signupsparkle" x1="0" y1="0" x2="36" y2="28">
                <stop stopColor="hsl(217, 91%, 60%)" />
                <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="text-[22px] font-normal text-foreground tracking-[-0.02em]">Create your account</h1>
          <p className="text-[13px] text-muted-foreground mt-1.5">Start building your cognitive layer</p>
        </div>

        {/* Social buttons */}
        <div className="flex gap-3 mb-6">
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleSocialAuth("google")} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-card border border-border text-foreground text-[14px] font-medium shadow-sm hover:shadow-md hover:bg-surface-hover transition-all duration-200">
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </motion.button>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => handleSocialAuth("apple")} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-full bg-card border border-border text-foreground text-[14px] font-medium shadow-sm hover:shadow-md hover:bg-surface-hover transition-all duration-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Apple
          </motion.button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-light">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Full name" className={inputClass} />
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="Email address" className={inputClass} />
          <div className="relative">
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Password"
              className={`${inputClass} pr-11`} />
            <button onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {password && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-center gap-2.5 px-1">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3].map((level) => (
                  <div key={level} className={`h-1 flex-1 rounded-full transition-all duration-300 ${strength >= level ? strengthColor[strength] : "bg-border"}`} />
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">{strengthLabel[strength]}</span>
            </motion.div>
          )}

          <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} placeholder="Confirm password" className={inputClass} />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[12px] text-destructive px-1 mb-3"
          >
            {error}
          </motion.p>
        )}

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleCreate} disabled={loading}
          className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium text-[14px] flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-60">
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Create account"}
        </motion.button>

        <p className="text-center mt-5">
          <button onClick={() => navigate("/login")} className="text-[13px] text-primary font-medium hover:underline transition-all">Already have an account? Sign in</button>
        </p>
      </motion.div>
    </div>
  );
};

export default SignUp;
