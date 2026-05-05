import { Eye, Mic, Monitor } from "lucide-react";
import OnboardingSheet from "./OnboardingSheet";
import LiveIllustration from "./illustrations/LiveIllustration";

/**
 * LiveOnboardingSheet -- Architecture v5.7 sec.4.13.
 *
 * Live-specific wrapper over OnboardingSheet. Triggered when user clicks
 * the LiveButton AND evaluateLiveOnboarding returns shouldShow=true.
 *
 * Content:
 *   - Hand-drawn camera illustration with purple aurora halo
 *   - Title: "Live mode -- Seven sees and hears you."
 *   - 3 bullets: vision / voice / screen
 *   - No extras (Live has no per-session config; mic/camera permissions
 *     are requested by the OS at session start)
 *   - Single primary CTA "Continue" -- closes sheet AND navigates to /live
 *
 * Persistence is handled by the parent (Home): on Continue, the parent
 * calls markOnboardingDismissed and then navigate("/live"). On Close,
 * only markOnboardingDismissed -- navigation does not happen.
 */

interface LiveOnboardingSheetProps {
  open: boolean;
  onContinue: () => void;
  onClose: () => void;
}

const LiveOnboardingSheet = ({ open, onContinue, onClose }: LiveOnboardingSheetProps) => {
  return (
    <OnboardingSheet
      open={open}
      onContinue={onContinue}
      onClose={onClose}
      illustration={<LiveIllustration size={170} />}
      title="Live mode -- Seven sees and hears you."
      bullets={[
        { icon: Eye, text: "Share your camera so Seven can see what you see" },
        { icon: Mic, text: "Speak naturally; Seven hears and responds in real time" },
        { icon: Monitor, text: "Share your screen for visual context Seven can react to" },
      ]}
      ctaLabel="Continue"
    />
  );
};

export default LiveOnboardingSheet;
