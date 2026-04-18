import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email");
      return;
    }
    // Minimal client-side validity check — exact address validation is left to
    // Supabase. We only want to reject the obviously-wrong case up front.
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    // Supabase best practice: never reveal whether an email is registered,
    // to avoid account enumeration. We always show the "check your email"
    // success state regardless of the actual outcome (except for transient
    // network failures, which we do surface so the user can retry).
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetErr && /network|fetch|connection/i.test(resetErr.message)) {
      setError("We couldn't reach the server. Please check your connection and try again.");
      return;
    }

    // Any other error (including "user not found") is silently treated as
    // success from the user's perspective.
    setSent(true);
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

        {!sent ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-full text-center mb-6"
            >
              <h1 className="text-[18px] font-medium text-foreground tracking-tight mb-2">
                Reset your password
              </h1>
              <p className="text-[13px] text-muted-foreground leading-relaxed px-2">
                Enter the email you used to sign up and we'll send you a reset link.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="w-full space-y-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
                placeholder="Email address"
                autoFocus
                className="w-full bg-card rounded-full px-5 h-[50px] text-[15px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200"
              />

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
                disabled={loading || !email.trim()}
                className="w-full h-[50px] rounded-full bg-primary text-primary-foreground font-medium text-[15px] active:scale-[0.98] transition-all duration-150 disabled:opacity-35"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  "Send reset link"
                )}
              </button>
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <CheckCircle2 size={28} className="text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-[18px] font-medium text-foreground tracking-tight mb-2">
              Check your email
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed px-2 mb-6">
              If an account exists for <span className="text-foreground">{email.trim()}</span>,
              we've sent a link to reset your password. The link is valid for 1 hour.
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed px-2 mb-6">
              Didn't get it? Check your spam folder, or try again in a few minutes.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-[13px] text-primary font-medium hover:underline"
            >
              Try a different email
            </button>
          </motion.div>
        )}

        {/* Back to sign in */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          onClick={() => navigate("/login")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mt-10"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to sign in
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed"
        >
          Need help?{" "}
          <Link to="/privacy" className="text-primary hover:underline">Contact us</Link>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
