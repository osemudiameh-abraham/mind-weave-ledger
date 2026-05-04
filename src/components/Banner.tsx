import { motion, AnimatePresence } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";

/**
 * Banner -- Architecture v5.7 sec.4.13.
 *
 * Generic banner primitive used for first-time / post-update / long-absence
 * triggers on Home and Live surfaces. Pure presentational; persistence is
 * handled by the caller (banner-triggers.ts evaluates which banners to show
 * and writes the seen/dismissed flags to localStorage).
 *
 * Visible behaviour:
 *   - Slides in from above on mount (subtle, 0.25s)
 *   - Optional accent icon (lucide)
 *   - Title (semibold) + body (muted)
 *   - Optional CTA button (primary fill)
 *   - Always-present dismiss X
 *
 * The component never reads or writes localStorage itself. The caller passes
 * onDismiss / onCta callbacks; banner-triggers.ts encapsulates the
 * persistence side. This separation lets us unit-test the banner without
 * touching browser storage and lets the trigger logic evolve independently.
 */

export interface BannerProps {
  /** Optional accent icon shown left of the title. */
  icon?: LucideIcon;
  /** Banner title -- semibold, accent-color foreground. */
  title: string;
  /** Banner body -- muted, single-line preferred but wraps if needed. */
  body: string;
  /** Optional CTA button label. When absent, only the dismiss X is shown. */
  ctaLabel?: string;
  /** Called when the user clicks the CTA button. */
  onCta?: () => void;
  /** Called when the user clicks the dismiss X. */
  onDismiss: () => void;
  /** Visual variant. Default "info" matches the brand primary tone. */
  variant?: "info" | "voice" | "live";
  /** Whether the banner is visible. AnimatePresence handles exit animation. */
  visible: boolean;
}

const VARIANT_STYLES: Record<NonNullable<BannerProps["variant"]>, {
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
  ctaBg: string;
  ctaText: string;
}> = {
  info: {
    bg: "bg-primary/5",
    border: "border-primary/20",
    iconColor: "text-primary",
    titleColor: "text-foreground",
    ctaBg: "bg-primary text-primary-foreground hover:bg-primary/90",
    ctaText: "",
  },
  voice: {
    bg: "bg-[hsl(250,80%,65%)]/5",
    border: "border-[hsl(250,80%,65%)]/25",
    iconColor: "text-[hsl(250,80%,65%)]",
    titleColor: "text-foreground",
    ctaBg: "bg-[hsl(250,80%,65%)] text-white hover:bg-[hsl(250,80%,60%)]",
    ctaText: "",
  },
  live: {
    bg: "bg-[hsl(280,75%,60%)]/8",
    border: "border-[hsl(280,75%,60%)]/30",
    iconColor: "text-[hsl(280,75%,60%)]",
    titleColor: "text-foreground",
    ctaBg: "bg-[hsl(280,75%,60%)] text-white hover:bg-[hsl(280,75%,55%)]",
    ctaText: "",
  },
};

const Banner = ({
  icon: Icon,
  title,
  body,
  ctaLabel,
  onCta,
  onDismiss,
  variant = "info",
  visible,
}: BannerProps) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`relative rounded-xl border ${styles.bg} ${styles.border} px-3.5 py-3 flex items-start gap-3`}
          role="status"
          aria-live="polite"
        >
          {Icon ? (
            <div className="shrink-0 mt-0.5">
              <Icon size={18} className={styles.iconColor} aria-hidden="true" />
            </div>
          ) : null}

          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-semibold ${styles.titleColor}`}>{title}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{body}</div>

            {ctaLabel && onCta ? (
              <button
                type="button"
                onClick={onCta}
                className={`mt-2.5 inline-flex items-center px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${styles.ctaBg}`}
              >
                {ctaLabel}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 w-7 h-7 -mt-1 -mr-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default Banner;
