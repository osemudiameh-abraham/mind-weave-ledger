import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SUPPORTED_VOICE_LANGUAGES,
  setVoiceLanguage,
} from "@/lib/onboarding-triggers";

/**
 * LanguagePickerSheet -- the standalone language-selection UI.
 *
 * Architecture v5.7 sec.4.14.4 + sec.1.5 (Substrate Visibility):
 *   The user must always be able to see and change which language Seven is
 *   listening for. Before this component existed, the picker UI was inlined
 *   inside VoiceOnboardingSheet -- meaning users could only change language
 *   when the onboarding sheet re-triggered (first-time, post-update, or
 *   long-absence). After picking a language once, users were stuck without
 *   recourse. Closing that gap is what required this extraction.
 *
 * Form factor:
 *   Mobile (<= 640px): full-screen modal sheet (slides up via parent's
 *     z-stacking; this component itself uses fixed positioning and lets
 *     callers sit it above their own surface)
 *   Desktop (> 640px): centered modal with backdrop (uses C67-honored
 *     flex-center wrapper pattern -- backdrop is the flex container, the
 *     sheet sits inside as a relative motion.div, so framer-motion's
 *     transform writes don't fight Tailwind's centering classes)
 *
 * Behaviour:
 *   - Tapping a language: persists to localStorage via setVoiceLanguage,
 *     fires onSelect(code), then onClose. Caller decides what (if anything)
 *     to do after selection (e.g. update local state to reflect new chip).
 *   - Tapping Back / backdrop / Esc: fires onClose without persisting.
 *   - The CURRENTLY-selected language renders with a Check icon. Visual
 *     parity with the picker that previously lived inside VoiceOnboardingSheet
 *     so users see consistent UI whether they reach the picker via onboarding
 *     or via the always-visible chip near the mic.
 */

interface LanguagePickerSheetProps {
  open: boolean;
  currentLanguage: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

const LanguagePickerSheet = ({ open, currentLanguage, onSelect, onClose }: LanguagePickerSheetProps) => {
  const handleSelect = (code: string) => {
    setVoiceLanguage(code);
    onSelect(code);
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Mobile full-screen + Desktop centered modal share the same
              structure but render at different breakpoints. */}

          {/* Mobile sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Choose speech language"
            className="fixed inset-0 z-[110] sm:hidden bg-background flex flex-col"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <button
                type="button"
                onClick={onClose}
                className="text-[15px] text-foreground/70 hover:text-foreground transition-colors"
              >
                Back
              </button>
              <h2 className="text-[15px] font-semibold text-foreground">Speech language</h2>
              <span className="w-10" aria-hidden="true" />
            </div>

            <ul className="flex-1 overflow-y-auto py-2">
              {SUPPORTED_VOICE_LANGUAGES.map((l) => {
                const selected = l.code === currentLanguage;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(l.code)}
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
          </motion.div>

          {/* Desktop modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm hidden sm:flex sm:items-center sm:justify-center sm:p-4"
            onClick={onClose}
            aria-hidden="true"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Choose speech language"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[420px] max-w-full max-h-[80vh] rounded-3xl bg-background flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[15px] text-foreground/70 hover:text-foreground transition-colors"
                >
                  Back
                </button>
                <h2 className="text-[15px] font-semibold text-foreground">Speech language</h2>
                <span className="w-10" aria-hidden="true" />
              </div>

              <ul className="flex-1 overflow-y-auto py-2">
                {SUPPORTED_VOICE_LANGUAGES.map((l) => {
                  const selected = l.code === currentLanguage;
                  return (
                    <li key={l.code}>
                      <button
                        type="button"
                        onClick={() => handleSelect(l.code)}
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
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default LanguagePickerSheet;
