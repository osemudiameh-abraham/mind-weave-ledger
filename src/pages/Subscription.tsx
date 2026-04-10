import { motion } from "framer-motion";
import { Check, Crown, Zap, Shield } from "lucide-react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with Seven",
    features: ["Basic conversations", "1 connected device", "Weekly digest", "Standard privacy"],
    current: true,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "Unlock the full experience",
    icon: Zap,
    features: [
      "Unlimited conversations",
      "Up to 5 connected devices",
      "Real-time Live sessions",
      "Autonomous actions",
      "Priority voice processing",
      "Advanced pattern detection",
    ],
    highlighted: true,
  },
  {
    name: "Guardian",
    price: "$24",
    period: "/month",
    desc: "Maximum protection & insight",
    icon: Shield,
    features: [
      "Everything in Pro",
      "Unlimited devices",
      "Emergency response system",
      "Full autonomous agent mode",
      "Dedicated processing",
      "Early access to features",
      "Custom wake words (unlimited)",
    ],
  },
];

const Subscription = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="pt-16 pb-28 px-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown size={24} className="text-primary" />
          </div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-tight">Choose your plan</h1>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
            Unlock deeper understanding and let Seven work harder for you.
          </p>
        </motion.div>

        <div className="flex flex-col gap-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border p-5 transition-all ${
                plan.highlighted
                  ? "border-primary bg-primary/[0.03] shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[11px] font-semibold rounded-full uppercase tracking-wide">
                  Most Popular
                </span>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    {plan.icon && <plan.icon size={16} className="text-primary" />}
                    <h3 className="text-[16px] font-semibold text-foreground">{plan.name}</h3>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{plan.desc}</p>
                </div>
                <div className="text-right">
                  <span className="text-[24px] font-bold text-foreground">{plan.price}</span>
                  <span className="text-[12px] text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              <div className="space-y-2.5 mb-5">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <Check size={14} className="text-primary shrink-0" />
                    <span className="text-[13px] text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>

              <button
                className={`w-full py-3 rounded-xl text-[14px] font-medium transition-colors ${
                  plan.current
                    ? "bg-muted text-muted-foreground cursor-default"
                    : plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : "Upgrade"}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed"
        >
          Cancel anytime. Your data stays yours, always.
        </motion.p>
      </div>
      <BottomNav />
    </div>
  );
};

export default Subscription;
