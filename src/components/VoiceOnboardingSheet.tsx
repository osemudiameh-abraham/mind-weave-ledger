import { useState } from "react";
import { Mic, Globe } from "lucide-react";
import OnboardingSheet from "./OnboardingSheet";
import MicrophoneIllustration from "./MicrophoneIllustration";
import LanguagePickerSheet from "./LanguagePickerSheet";
import {
  getVoiceLanguage,
  getVoiceLanguageDisplayName,
} from "@/lib/onboarding-triggers";

/**
 * Voice onboarding sheet (sec.4.13). Triggered the first time a user
 * intends to use voice (chat-input mic OR Live mode), again when the
 * voice capability version bumps, and again after a 14-day absence.
 *
 * Three primary bullets explain what the user is about to use, plus an
 * extras row that lets them pick which language Seven should listen for.
 *
 * The language picker UI itself was extracted into LanguagePickerSheet
 * (sec.4.14.4 + sec.1.5) so that the chip-in-input-bar entry on /home
 * can reuse the same component. Behaviour from the user's perspective
 * is unchanged: tap the language row -> picker opens -> select -> sheet
 * stays open with the new selection reflected.
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
    // setVoiceLanguage already called inside LanguagePickerSheet; we just
    // mirror to local state so the row label updates without a remount.
  };

  return (
    <>
      <OnboardingSheet
        open={open}
        onClose={onClose}
        onContinue={onContinue}
        icon={Mic}
        title="Talk to Seven"
        subtitle="Tap the mic and just speak. Seven listens, transcribes, and responds in your voice."
        illustration={<MicrophoneIllustration />}
        bullets={[
          { icon: Mic, text: "Tap to start, tap to stop" },
          { icon: Globe, text: "Choose a language to speak in" },
          { icon: Mic, text: "Voice messages get the same intelligence as typed ones" },
        ]}
        extras={
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border border-border hover:bg-muted/50 transition-colors text-left"
            aria-label="Change speech language"
          >
            <span className="flex flex-col">
              <span className="text-[12px] uppercase tracking-wide text-muted-foreground">
                Speech language
              </span>
              <span className="text-[15px] font-medium text-foreground mt-0.5">
                {getVoiceLanguageDisplayName(language)}
              </span>
            </span>
            <Globe size={18} className="text-muted-foreground" aria-hidden="true" />
          </button>
        }
      />

      <LanguagePickerSheet
        open={pickerOpen}
        currentLanguage={language}
        onSelect={handleLanguageSelect}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
};

export default VoiceOnboardingSheet;
