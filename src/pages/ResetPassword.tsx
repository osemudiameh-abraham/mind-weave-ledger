import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ViewState = "checking" | "form" | "invalid" | "success";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // When the user clicks the reset link in their email, Supabase handles the
  // recovery token automatically (via detectSessionInUrl in the client config)
  // and surfaces a PASSWORD_RECOVERY auth event. We wait for either that event
  // or a valid existing session before letting the user set a new password.
  useEffect(() => {
    let cancelled = false;

    // onAuthStateChange fires with PASSWORD_RECOVERY when arriving from a
    // valid reset link. That's the canonical signal we should accept.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setView("form");
      }
    });

    // Fallback check: if the auth event doesn't fire within 1200ms, we check
    // whether there's already a session. On a fresh arrival the session may
    // exist before the event listener is attached (race), so this covers that.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // We have a session. Move to the form — user can set a new password.
        // If they arrived here with a pre-existing logged-in session (not via
        // reset link), that's fine: they're authenticated and can change pw.
        setView("form");
      } else {
        setView("invalid");
      }
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleSubmit = async () => {
    if (!password || !confirm) {
      setError("Please fill in both fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setLoading(false);
      // If the recovery session expired while the user sat on the form,
      // surface it clearly so they know to request a new link.
      if (/session|token|expired|jwt/i.test(updateErr.message)) {
        setError("Your reset link has expired. Please request a new one.");
      } else {
        setError(updateErr.message || "We couldn't update your password. Please try again.");
      }
      return;
    }

    setLoading(false);
    setView("success");

    // Small delay so the user can see the success state before the redirect.
    setTimeout(() => {
      navigate("/home", { replace: true });
    }, 1800);
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

        {view === "checking" && (
          <div className="flex flex-col items-center">
            <Loader2 size={24} className="animate-spin text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-[13px] text-muted-foreground">Verifying your reset link…</p>
          </div>
        )}

        {view === "invalid" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
              <AlertCircle size={28} className="text-destructive" aria-hidden="true" />
            </div>
            <h1 className="text-[18px] font-medium text-foreground tracking-tight mb-2">
              Link invalid or expired
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed px-2 mb-6">
              This reset link has expired or already been used. Request a new one
              to set your password.
            </p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] active:scale-[0.98] transition-all duration-150"
            >
              Request a new link
            </button>
            <button
              onClick={() => navigate("/login")}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors mt-5"
            >
              Back to sign in
            </button>
          </motion.div>
        )}

        {view === "form" && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="w-full text-center mb-6"
            >
              <h1 className="text-[18px] font-medium text-foreground tracking-tight mb-2">
                Set a new password
              </h1>
              <p className="text-[13px] text-muted-foreground leading-relaxed px-2">
                Choose a password you haven't used before. At least 8 characters.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="w-full space-y-3"
            >
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="New password"
                  autoFocus
                  className="w-full bg-card rounded-full px-5 h-[50px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 pr-12"
                />
                <button
                  onClick={() => setShowPw(!showPw)}
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
                  placeholder="Confirm new password"
                  className="w-full bg-card rounded-full px-5 h-[50px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 pr-12"
                />
                <button
                  onClick={() => setShowConfirm(!showConfirm)}
                  type="button"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
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
                onClick={handleSubmit}
                disabled={loading || !password.trim() || !confirm.trim()}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] active:scale-[0.98] transition-all duration-150 disabled:opacity-35"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  "Update password"
                )}
              </button>
            </motion.div>
          </>
        )}

        {view === "success" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <CheckCircle2 size={28} className="text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-[18px] font-medium text-foreground tracking-tight mb-2">
              Password updated
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed px-2">
              Taking you to your dashboard…
            </p>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-[11px] text-muted-foreground text-center mt-10 leading-relaxed"
        >
          By continuing, you agree to Seven's{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms</Link> &{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
