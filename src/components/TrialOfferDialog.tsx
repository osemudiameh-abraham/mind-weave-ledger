import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, X } from "lucide-react";

interface TrialOfferDialogProps {
  open: boolean;
  onStartTrial: () => void;
  onDismiss: () => void;
}

const TrialOfferDialog = ({ open, onStartTrial, onDismiss }: TrialOfferDialogProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative z-10 w-full max-w-[340px] rounded-3xl border border-primary/20 bg-background p-6 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.25)]"
          >
            {/* Close */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Crown size={28} className="text-primary" />
              </div>
            </div>

            {/* Copy */}
            <h2 className="text-[20px] font-semibold text-foreground text-center tracking-tight">
              Unlock the full Seven experience
            </h2>
            <p className="text-[13px] text-muted-foreground text-center mt-2 leading-relaxed max-w-[260px] mx-auto">
              Start your 14-day free trial — full access to every feature, no card required.
            </p>

            {/* Highlights */}
            <div className="mt-5 space-y-2.5">
              {["Unlimited conversations & insights", "Real-time Live sessions", "Advanced pattern detection"].map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <Sparkles size={13} className="text-primary shrink-0" />
                  <span className="text-[12.5px] text-foreground/80">{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={onStartTrial}
              className="w-full mt-6 py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Start 14-Day Free Trial
            </button>
            <p className="text-[11px] text-muted-foreground text-center mt-2.5">
              No credit card · Cancel anytime
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TrialOfferDialog;
