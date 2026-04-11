import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Fingerprint, KeyRound, Eye, EyeOff, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import SevenLogo from "@/components/SevenLogo";
import { toast } from "sonner";

const Verify = () => {
  const navigate = useNavigate();
  const { user, verifyIdentity, trustDevice, signOut } = useAuth();
  const [method, setMethod] = useState<"choose" | "password" | "biometric">("choose");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trustChecked, setTrustChecked] = useState(false);

  const handleBiometric = async () => {
    setLoading(true);
    setError("");

    // Try WebAuthn / platform authenticator
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          // Simulate biometric prompt — in production this would use navigator.credentials.get()
          await new Promise(r => setTimeout(r, 1500));
          const success = verifyIdentity("biometric");
          if (success) {
            if (trustChecked) trustDevice(true);
            toast.success("Identity verified");
            navigate("/home", { replace: true });
            return;
          }
        }
      } catch {
        // Fall through to simulated
      }
    }

    // Simulated biometric for demo
    await new Promise(r => setTimeout(r, 1500));
    verifyIdentity("biometric");
    if (trustChecked) trustDevice(true);
    toast.success("Identity verified");
    setLoading(false);
    navigate("/home", { replace: true });
  };

  const handlePassword = () => {
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    setTimeout(() => {
      const success = verifyIdentity("password", password);
      setLoading(false);
      if (success) {
        if (trustChecked) trustDevice(true);
        toast.success("Identity verified");
        navigate("/home", { replace: true });
      } else {
        setError("Incorrect password. Please try again.");
        setPassword("");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10">
          <SevenLogo size={36} />
          <h1 className="text-[22px] font-normal text-foreground tracking-[-0.02em] mt-4">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            Verify your identity to continue
          </p>
        </div>

        {method === "choose" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Biometric option */}
            <button
              onClick={() => { setMethod("biometric"); handleBiometric(); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Fingerprint size={24} className="text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="text-[14px] font-medium text-foreground">Face ID / Fingerprint</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Use biometric authentication</p>
              </div>
            </button>

            {/* Password option */}
            <button
              onClick={() => setMethod("password")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <KeyRound size={24} className="text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="text-[14px] font-medium text-foreground">Password</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Enter your account password</p>
              </div>
            </button>

            {/* Trust device */}
            <div className="pt-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  onClick={() => setTrustChecked(!trustChecked)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    trustChecked ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {trustChecked && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <ShieldCheck size={12} className="text-primary-foreground" />
                    </motion.div>
                  )}
                </button>
                <div>
                  <p className="text-[13px] text-foreground font-medium">Trust this device</p>
                  <p className="text-[11px] text-muted-foreground">Skip verification next time</p>
                </div>
              </label>
            </div>

            <button
              onClick={() => signOut()}
              className="w-full text-center text-[13px] text-muted-foreground hover:text-foreground mt-4 py-2 transition-colors"
            >
              Sign in with a different account
            </button>
          </motion.div>
        )}

        {method === "biometric" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-8"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
            >
              <Fingerprint size={40} className="text-primary" />
            </motion.div>
            <p className="text-[14px] text-foreground font-medium">Verifying...</p>
            <p className="text-[12px] text-muted-foreground mt-1">Use your device's biometric sensor</p>
            <button
              onClick={() => setMethod("choose")}
              className="text-[13px] text-primary mt-6 hover:underline"
            >
              Use a different method
            </button>
          </motion.div>
        )}

        {method === "password" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handlePassword()}
                placeholder="Enter your password"
                autoFocus
                className="w-full bg-card rounded-2xl px-4 h-12 text-[14px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all pr-11"
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
                className="text-[12px] text-destructive px-1"
              >
                {error}
              </motion.p>
            )}

            {/* Trust device */}
            <label className="flex items-center gap-3 cursor-pointer px-1">
              <button
                onClick={() => setTrustChecked(!trustChecked)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  trustChecked ? "bg-primary border-primary" : "border-border"
                }`}
              >
                {trustChecked && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <ShieldCheck size={12} className="text-primary-foreground" />
                  </motion.div>
                )}
              </button>
              <span className="text-[13px] text-muted-foreground">Trust this device</span>
            </label>

            <button
              onClick={handlePassword}
              disabled={loading || !password.trim()}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Verify"}
            </button>

            <button
              onClick={() => { setMethod("choose"); setPassword(""); setError(""); }}
              className="w-full text-center text-[13px] text-primary hover:underline py-1"
            >
              Use a different method
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Verify;
