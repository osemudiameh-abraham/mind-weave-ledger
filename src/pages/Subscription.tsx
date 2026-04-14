import { motion } from "framer-motion";
import { Check, Crown, Sparkles } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useTrialStatus } from "@/hooks/use-trial-status";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const features = [
  "Unlimited conversations",
  "All connected devices",
  "Real-time Live sessions",
  "Autonomous actions",
  "Voice processing",
  "Pattern detection",
  "Document intelligence",
  "Weekly digest",
  "Early access to features",
];

const Subscription = () => {
  const { isTrialActive, startTrial, status } = useTrialStatus();
  const navigate = useNavigate();

  const handleActivateBeta = () => {
    startTrial();
    toast.success("Beta access activated! Enjoy full access to Seven Mynd.");
    navigate("/home");
  };

  const isBetaActive = isTrialActive || status === "trial";

  return (
    <AppLayout>
      <div className="pt-16 pb-28 px-4 max-w-3xl mx-auto">
        {isBetaActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20"
          >
            <Sparkles size={20} className="text-primary shrink-0" />
            <div>
              <p className="text-[14px] font-medium text-foreground">Beta Access — Active</p>
              <p className="text-[12px] text-muted-foreground">You have full access to all features</p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown size={24} className="text-primary" />
          </div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-tight">
            {isBetaActive ? "You're in the Beta" : "Join the Seven Mynd Beta"}
          </h1>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
            {isBetaActive
              ? "You have full access to Seven Mynd. Thank you for being an early adopter."
              : "Get free access to the full Seven Mynd experience. Help us shape the future of cognitive continuity."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative rounded-2xl border border-primary bg-primary/[0.03] shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)] p-6"
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[11px] font-semibold rounded-full uppercase tracking-wide flex items-center gap-1">
            <Sparkles size={12} /> Beta
          </span>

          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-[36px] font-bold text-foreground">Free</span>
            </div>
            <p className="text-[12px] text-primary mt-1 font-medium">Full access during beta period</p>
          </div>

          <div className="space-y-3 mb-6">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <Check size={14} className="text-primary shrink-0" />
                <span className="text-[13px] text-foreground/80">{f}</span>
              </div>
            ))}
          </div>

          {!isBetaActive ? (
            <button
              onClick={handleActivateBeta}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Activate Beta Access
            </button>
          ) : (
            <div className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground text-[14px] font-medium text-center">
              Beta Access Active
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center mt-3">
            No credit card required. Paid plans coming soon.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed"
        >
          Your data stays yours, always. Seven will never sell your information.
        </motion.p>
      </div>
    </AppLayout>
  );
};

export default Subscription;
