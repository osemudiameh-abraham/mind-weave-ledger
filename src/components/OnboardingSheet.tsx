import { motion, AnimatePresence } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";

/**
 * OnboardingSheet -- Architecture v5.7 sec.4.13 (rebuild).
 *
 * Full-screen modal sheet for earned onboarding moments. Triggered ONLY by
 * user intent (clicking the mic button, opening Live), never on page load.
 * Replaces the page-load banner attempt that shipped in PR #34 and got
 * removed in PR #35 (lesson C65: ship surfaces only when value justifies
 * the visual interruption).
 *
 * Reference: Claude's voice onboarding sheet (Anthropic, May 2026). Same
 * shape: dismiss X, hero illustration, title, 3 bulleted benefits, optional
 * extras row (language picker for voice), single primary CTA pill.
 *
 * Form factor:
 *   Mobile (<= 640px): full-screen, edge-to-edge, slide up from bottom
 *   Desktop (> 640px): centered modal, max-w-md, fade in
 *
 * Persistence is handled by the caller (onboarding-triggers.ts). This
 * component is purely presentational -- it knows nothing about whether
 * a banner SHOULD show; the caller decides that and only mounts this when
 * the trigger fires.
 */

export interface OnboardingBullet {
  icon: LucideIcon;
  text: string;
}

interface OnboardingSheetProps {
  /** Hero illustration node, e.g. <MicrophoneIllustration size={180} /> */
  illustration: React.ReactNode;
  /** Sheet title - 2-3 short sentences max, large weight. */
  title: string;
  /** Bulleted list of benefits, 3 entries recommended. */
  bullets: OnboardingBullet[];
  /** Optional extras content shown above the CTA (e.g. language picker). */
  extras?: React.ReactNode;
  /** Primary CTA button label. */
  ctaLabel: string;
  /** Called when user clicks the primary CTA. Caller marks dismissed AND
   *  proceeds with the user's original intent (e.g. start recording). */
  onContinue: () => void;
  /** Called when user clicks the dismiss X. Caller marks dismissed but
   *  does NOT proceed with the original intent -- user said no. */
  onClose: () => void;
  /** Whether the sheet is visible. AnimatePresence handles exit animation. */
  open: boolean;
}

const OnboardingSheet = ({
  illustration,
  title,
  bullets,
  extras,
  ctaLabel,
  onContinue,
  onClose,
  open,
}: OnboardingSheetProps) => {
  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop -- desktop only fades; mobile sheet covers everything anyway. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm hidden sm:block"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-sheet-title"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[101] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[min(720px,calc(100vh-2rem))] sm:rounded-3xl bg-background flex flex-col overflow-hidden shadow-2xl"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Top bar with dismiss X */}
            <div className="flex items-center justify-start px-4 pt-4 pb-2 sm:pb-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted transition-colors text-foreground"
              >
                <X size={18} aria-hidden="true" strokeWidth={2.25} />
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 overflow-y-auto">
              {/* Illustration */}
              <div className="mt-2 mb-6 flex items-center justify-center">
                {illustration}
              </div>

              {/* Title */}
              <h1
                id="onboarding-sheet-title"
                className="text-[28px] sm:text-[26px] font-semibold text-foreground tracking-[-0.02em] leading-[1.2] text-center max-w-[420px]"
              >
                {title}
              </h1>

              {/* Bullets */}
              <ul className="mt-6 space-y-3.5 self-start w-full max-w-[420px] mx-auto px-2 sm:px-0">
                {bullets.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <li key={i} className="flex items-center gap-3 text-foreground">
                      <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-foreground/80">
                        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span className="text-[15px] leading-snug">{b.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Footer: extras + CTA */}
            <div
              className="px-6 pt-2 pb-4 flex flex-col gap-3 bg-background"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
            >
              {extras ? <div>{extras}</div> : null}

              <button
                type="button"
                onClick={onContinue}
                className="w-full h-[52px] rounded-full bg-foreground text-background text-[16px] font-medium hover:bg-foreground/90 transition-colors"
              >
                {ctaLabel}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default OnboardingSheet;
