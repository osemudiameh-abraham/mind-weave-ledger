/**
 * onboarding-triggers -- Architecture v5.7 sec.4.13 (rebuild).
 *
 * Decides whether to show an OnboardingSheet when the user clicks an intent
 * button (mic for voice, Live entry button for Live). Replaces the previous
 * banner-triggers.ts which evaluated on page load -- C65 lesson: ship
 * surfaces only when value justifies the visual interruption, and only on
 * earned intent moments.
 *
 * Three trigger conditions, evaluated in priority order:
 *   1. First-time -- user has never used this surface before
 *   2. Post-update -- capability version changed since last seen
 *   3. Long-absence -- > 14 days since user last used this surface
 *
 * Single-trigger-at-a-time: at most one sheet shown per intent click. If
 * the user dismisses, the dismissed timestamp is stored and the sheet
 * doesn't fire again on the same trigger condition for at least 7 days
 * (long-absence) or until next capability bump (post-update) or never
 * (first-time -- once dismissed, treat surface as known).
 *
 * Storage keys are versioned `_v2` to evaluate fresh against everyone,
 * including users who saw and dismissed the broken PR #34 banner. The old
 * `_v1` keys are abandoned.
 */

const VOICE_USED_AT_KEY = "seven_voice_used_at_v2";
const LIVE_USED_AT_KEY = "seven_live_used_at_v2";
const VOICE_SHEET_DISMISSED_KEY = "seven_voice_sheet_dismissed_v2";
const LIVE_SHEET_DISMISSED_KEY = "seven_live_sheet_dismissed_v2";
const VOICE_LANGUAGE_KEY = "seven_voice_language_v2";

/**
 * Capability version. Bump this string when a meaningful voice/Live
 * capability changes. The post-update trigger fires when the user's
 * last-seen version differs.
 */
const CAPABILITY_VERSION = "0c-stage1-2026-05-05";
const SEEN_VERSION_KEY = "seven_seen_capability_version_v2";

const LONG_ABSENCE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
const REDISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type OnboardingSurface = "voice" | "live";

export type OnboardingTrigger = "first_time" | "post_update" | "long_absence";

export interface OnboardingDecision {
  shouldShow: boolean;
  trigger?: OnboardingTrigger;
  surface: OnboardingSurface;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable -- degrade gracefully. User may see sheet again
    // next click; that's acceptable for non-critical UX state.
  }
}

/**
 * Evaluate whether to show the voice onboarding sheet on a mic-click intent.
 * Call this when the user taps the mic button. If shouldShow=false, proceed
 * with the original intent (start recording). If shouldShow=true, show the
 * sheet; on dismiss/continue, then proceed with the original intent.
 */
export function evaluateVoiceOnboarding(): OnboardingDecision {
  return evaluateForSurface("voice", VOICE_USED_AT_KEY, VOICE_SHEET_DISMISSED_KEY);
}

/**
 * Evaluate whether to show the live onboarding sheet on a Live-button-click
 * intent. Same semantics as evaluateVoiceOnboarding.
 */
export function evaluateLiveOnboarding(): OnboardingDecision {
  return evaluateForSurface("live", LIVE_USED_AT_KEY, LIVE_SHEET_DISMISSED_KEY);
}

function evaluateForSurface(
  surface: OnboardingSurface,
  usedAtKey: string,
  dismissedKey: string,
): OnboardingDecision {
  const usedAtRaw = readStorage(usedAtKey);
  const dismissedAtRaw = readStorage(dismissedKey);
  const seenVersion = readStorage(SEEN_VERSION_KEY);

  // Priority 1: post-update.
  // Fires if user has used the surface before AND capability version changed.
  // Re-fires once per version bump; dismissal writes SEEN_VERSION_KEY so it
  // doesn't fire again until next bump.
  if (usedAtRaw && seenVersion !== CAPABILITY_VERSION) {
    return { shouldShow: true, trigger: "post_update", surface };
  }

  // Priority 2: long-absence.
  // Fires if used before AND > 14 days since last use AND not recently dismissed.
  if (usedAtRaw) {
    const usedAt = parseInt(usedAtRaw, 10);
    if (!isNaN(usedAt) && Date.now() - usedAt > LONG_ABSENCE_THRESHOLD_MS) {
      // Don't fire if dismissed within the last 7 days -- avoid spamming
      // the same banner during continued absence.
      if (dismissedAtRaw) {
        const dismissed = parseInt(dismissedAtRaw, 10);
        if (!isNaN(dismissed) && Date.now() - dismissed < REDISMISS_COOLDOWN_MS) {
          return { shouldShow: false, surface };
        }
      }
      return { shouldShow: true, trigger: "long_absence", surface };
    }
  }

  // Priority 3: first-time.
  // Fires if never used AND first-time sheet hasn't been dismissed.
  if (!usedAtRaw && !dismissedAtRaw) {
    return { shouldShow: true, trigger: "first_time", surface };
  }

  return { shouldShow: false, surface };
}

/**
 * Mark an onboarding sheet as dismissed. Writes a timestamp. For
 * post-update trigger, also bumps SEEN_VERSION_KEY so the post-update
 * trigger doesn't re-fire until the next capability bump.
 */
export function markOnboardingDismissed(decision: OnboardingDecision): void {
  if (!decision.trigger) return;
  const dismissedKey = decision.surface === "voice"
    ? VOICE_SHEET_DISMISSED_KEY
    : LIVE_SHEET_DISMISSED_KEY;
  writeStorage(dismissedKey, String(Date.now()));
  if (decision.trigger === "post_update") {
    writeStorage(SEEN_VERSION_KEY, CAPABILITY_VERSION);
  }
}

/**
 * Mark a surface as USED. Called when the user actually engages with the
 * surface (mic recording started; Live session started). Resets the
 * long-absence calculation.
 */
export function markSurfaceUsed(surface: OnboardingSurface): void {
  const key = surface === "voice" ? VOICE_USED_AT_KEY : LIVE_USED_AT_KEY;
  writeStorage(key, String(Date.now()));
}

/**
 * Read the user's saved voice language preference. Defaults to "en"
 * (English). Future PR will wire this through the voice-stt Edge Function
 * to set the Deepgram language param.
 */
export function getVoiceLanguage(): string {
  return readStorage(VOICE_LANGUAGE_KEY) || "en";
}

/**
 * Persist the user's voice language preference.
 */
export function setVoiceLanguage(lang: string): void {
  writeStorage(VOICE_LANGUAGE_KEY, lang);
}

/**
 * Supported voice languages list. Mirrors the Deepgram nova-3 model
 * capability set. The display name is shown in the language picker; the
 * code is the value persisted to localStorage and (future PR) sent to
 * voice-stt as the Deepgram language param.
 */
export const SUPPORTED_VOICE_LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Mandarin" },
  { code: "hi", name: "Hindi" },
];

export function getVoiceLanguageDisplayName(code: string): string {
  return SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === code)?.name || "English";
}
