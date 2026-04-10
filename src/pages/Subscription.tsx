import { motion } from "framer-motion";
import { Check, Crown, Sparkles } from "lucide-react";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";

const features = [
  "Unlimited conversations",
  "All connected devices",
  "Real-time Live sessions",
  "Autonomous actions",
  "Priority voice processing",
  "Advanced pattern detection",
  "Emergency response system",
  "Custom wake words",
  "Early access to features",
];

const Subscription = () => {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  return (
    <AppLayout>
      <div className="pt-16 pb-28 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown size={24} className="text-primary" />
          </div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-tight">Unlock Seven</h1>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-[280px] mx-auto leading-relaxed">
            Start with 14 days free. Full access, no card required.
          </p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted/50 mb-6 max-w-[280px] mx-auto"
        >
          <button
            onClick={() => setBilling("monthly")}
            className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${
              billing === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${
              billing === "annual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Annual
          </button>
        </motion.div>

        {/* Plan card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative rounded-2xl border border-primary bg-primary/[0.03] shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)] p-6"
        >
          {billing === "annual" && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[11px] font-semibold rounded-full uppercase tracking-wide flex items-center gap-1">
              <Sparkles size={12} /> 2 Months Free
            </span>
          )}

          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-[36px] font-bold text-foreground">
                {billing === "monthly" ? "£39" : "£390"}
              </span>
              <span className="text-[14px] text-muted-foreground">
                {billing === "monthly" ? "/month" : "/year"}
              </span>
            </div>
            {billing === "annual" && (
              <p className="text-[12px] text-primary mt-1 font-medium">
                £32.50/month · Save £78/year
              </p>
            )}
          </div>

          <div className="space-y-3 mb-6">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <Check size={14} className="text-primary shrink-0" />
                <span className="text-[13px] text-foreground/80">{f}</span>
              </div>
            ))}
          </div>

          <button className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors">
            Start 14-Day Free Trial
          </button>

          <p className="text-[11px] text-muted-foreground text-center mt-3">
            No credit card required · Cancel anytime
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
