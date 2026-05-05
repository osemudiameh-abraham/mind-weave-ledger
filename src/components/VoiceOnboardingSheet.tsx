import { useState } from "react";
import { Globe, Clock, Zap, Check, ChevronRight } from "lucide-react";
import OnboardingSheet from "./OnboardingSheet";
import MicrophoneIllustration from "./illustrations/MicrophoneIllustration";
import {
  getVoiceLanguage,
  setVoiceLanguage,
  getVoiceLanguageDisplayName,
  SUPPORTED_VOICE_LANGUAGES,
} from "@/lib/onboarding-triggers";

/**
 * VoiceOnboardingSheet -- Architecture v5.7 sec.4.13.
 *
 * Voice-specific wrapper over OnboardingSheet. Triggered when user clicks
 * the mic button AND evaluateVoiceOnboarding returns shouldShow=true.
 *
 * Content:
 *   - Hand-drawn microphone illustration with warm halo
 *   - Title: "Talk to Seven using your voice."
 *   - 3 bullets: language / dictation length / speed-and-feel
 *   - Extras: language picker (writes localStorage; full Deepgram wiring
 *     is deferred to a separate PR)
 *   - Single primary CTA "Continue" -- closes sheet AND starts recording
 *
 * Persistence is handled by the parent (ChatInput): on Continue, the
 * parent calls markOnboardingDismissed + markSurfaceUsed and then starts
 * recording. On Close, the parent only calls markOnboardingDismissed --
 * recording does not start.
 */

interface VoiceOnboardingSheetProps {
  open: boolean;
  onContinue: () => void;
  onClose: () => void;
}

const VoiceOnboardingSheet = ({ open, onContinue, onClose }: VoiceOnboardingSheetProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [language, setLanguage] = useState(() => getVoiceLanguage());

  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
    setVoiceLanguage(code);
    setPickerOpen(false);
  };

  return (
    <>
      <OnboardingSheet
        open={open && !pickerOpen}
        onContinue={onContinue}
        onClose={onClose}
        illustration={<MicrophoneIllustration size={170} />}
        title="Talk to Seven using your voice."
        bullets={[
          { icon: Globe, text: "Choose a language to speak in" },
          { icon: Clock, text: "Dictate for up to 10 minutes" },
          { icon: Zap, text: "Faster and more natural than typing" },
        ]}
        extras={
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border hover:bg-muted/40 transition-colors text-left"
            aria-label="Change speech language"
          >
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Speech language
              </span>
              <span className="text-[16px] text-foreground">
                {getVoiceLanguageDisplayName(language)}
              </span>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" aria-hidden="true" />
          </button>
        }
        ctaLabel="Continue"
      />

      {/* Secondary sheet: language picker. Stacked above the main sheet. */}
      {pickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose speech language"
          className="fixed inset-0 z-[110] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[440px] sm:max-w-[calc(100vw-2rem)] sm:max-h-[min(720px,calc(100vh-2rem))] sm:rounded-3xl bg-background flex flex-col overflow-hidden shadow-2xl"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-[15px] text-foreground/70 hover:text-foreground transition-colors"
            >
              Back
            </button>
            <h2 className="text-[15px] font-semibold text-foreground">Speech language</h2>
            <span className="w-10" aria-hidden="true" />
          </div>

          <ul className="flex-1 overflow-y-auto py-2">
            {SUPPORTED_VOICE_LANGUAGES.map((l) => {
              const selected = l.code === language;
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => handleLanguageSelect(l.code)}
                    className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className={`text-[16px] ${selected ? "font-semibold text-foreground" : "text-foreground/85"}`}>
                      {l.name}
                    </span>
                    {selected ? <Check size={18} className="text-foreground" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
};

export default VoiceOnboardingSheet;
