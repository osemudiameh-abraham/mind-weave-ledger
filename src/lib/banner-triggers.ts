/**
 * banner-triggers -- Architecture v5.7 sec.4.13.
 *
 * Pure logic for evaluating which banners should currently be visible on
 * each surface (Home or Live), based on three trigger conditions:
 *
 *   1. First-time (sec.4.13.1): user has never used voice/Live.
 *   2. Post-update (sec.4.13.2): a meaningful capability changed since
 *      the user's last seen-banner version.
 *   3. Long-absence (sec.4.13.3): user hasn't used voice/Live in 14+ days.
 *
 * Persistence: localStorage keys, no backend, no schema. The module does
 * NOT mutate localStorage during evaluation -- that's the caller's job
 * (via the dismiss/cta callbacks the Banner component fires). Pure read
 * during evaluation; pure write during dismissal.
 *
 * Single-banner-at-a-time rule: if multiple triggers fire for the same
 * surface, the highest-priority one wins. Priority order: post-update >
 * long-absence > first-time. Lower-priority triggers re-arm on next page
 * load if their condition still holds.
 */

const VOICE_USED_AT_KEY = "seven_voice_used_at";
const LIVE_USED_AT_KEY = "seven_live_used_at";
const VOICE_BANNER_DISMISSED_KEY = "seven_voice_banner_dismissed_v1";
const LIVE_BANNER_DISMISSED_KEY = "seven_live_banner_dismissed_v1";

/**
 * Capability version. Bump this string when a meaningful voice/Live
 * capability changes (new TTS model, new STT provider, new Live feature).
 * The post-update trigger fires when the user's last-seen version differs
 * from this. Future schema-bundle automation may compute this from the
 * latest deploy SHA, but for now it's a manual constant.
 */
const CAPABILITY_VERSION = "0c-stage1-2026-05-04";
const SEEN_VERSION_KEY = "seven_seen_capability_version";

const LONG_ABSENCE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type BannerSurface = "home" | "live";

export type BannerTrigger = "first_time" | "post_update" | "long_absence";

export interface BannerSpec {
  surface: BannerSurface;
  trigger: BannerTrigger;
  /** The localStorage key to mark as dismissed when the user dismisses or
   *  acts on this banner. Caller writes timestamp on dismiss. */
  dismissedKey: string;
}

/**
 * Read a localStorage value safely. Returns null on parse error or missing.
 */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a localStorage value safely. Silently noops on quota error.
 */
function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or quota exceeded -- banner state is non-critical,
    // we just won't persist dismissal. User will see the banner again.
  }
}

/**
 * Evaluate which banners should be visible on the Home surface RIGHT NOW.
 * Returns at most one banner spec (single-banner-at-a-time rule).
 */
export function evaluateHomeBanners(): BannerSpec | null {
  // The Home surface shows the VOICE banner (encouraging users to try the
  // mic affordance in ChatInput, since voice is a Phase 0.C surface).
  return evaluateForSurface("home", VOICE_USED_AT_KEY, VOICE_BANNER_DISMISSED_KEY);
}

/**
 * Evaluate which banners should be visible on the Live surface RIGHT NOW.
 * Returns at most one banner spec.
 */
export function evaluateLiveBanners(): BannerSpec | null {
  return evaluateForSurface("live", LIVE_USED_AT_KEY, LIVE_BANNER_DISMISSED_KEY);
}

function evaluateForSurface(
  surface: BannerSurface,
  usedAtKey: string,
  dismissedKey: string,
): BannerSpec | null {
  const dismissedAt = readStorage(dismissedKey);
  const usedAtRaw = readStorage(usedAtKey);
  const seenVersion = readStorage(SEEN_VERSION_KEY);

  // Priority 1: post-update trigger.
  // Fires if the user has used the surface before AND the capability
  // version changed since they last saw a banner. Re-fires once per
  // version bump; the user dismisses, and CAPABILITY_VERSION is written
  // to SEEN_VERSION_KEY, so it doesn't fire again until next bump.
  if (usedAtRaw && seenVersion !== CAPABILITY_VERSION) {
    return { surface, trigger: "post_update", dismissedKey };
  }

  // Priority 2: long-absence trigger.
  // Fires if user has used the surface before but not in 14+ days.
  // Resets on each new use (use callers update usedAtKey).
  if (usedAtRaw) {
    const usedAt = parseInt(usedAtRaw, 10);
    if (!isNaN(usedAt) && Date.now() - usedAt > LONG_ABSENCE_THRESHOLD_MS) {
      // Don't fire if already dismissed within the last 7 days -- avoid
      // spamming the same banner repeatedly during continued absence.
      if (dismissedAt) {
        const dismissed = parseInt(dismissedAt, 10);
        if (!isNaN(dismissed) && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) {
          return null;
        }
      }
      return { surface, trigger: "long_absence", dismissedKey };
    }
  }

  // Priority 3: first-time trigger.
  // Fires if user has never used the surface AND the first-time banner
  // hasn't been dismissed yet.
  if (!usedAtRaw && !dismissedAt) {
    return { surface, trigger: "first_time", dismissedKey };
  }

  return null;
}

/**
 * Mark a banner dismissed. Writes a timestamp to the dismissedKey. For the
 * post-update trigger, also bumps SEEN_VERSION_KEY to the current
 * CAPABILITY_VERSION so the post-update trigger doesn't re-fire.
 */
export function markBannerDismissed(spec: BannerSpec): void {
  writeStorage(spec.dismissedKey, String(Date.now()));
  if (spec.trigger === "post_update") {
    writeStorage(SEEN_VERSION_KEY, CAPABILITY_VERSION);
  }
}

/**
 * Mark a surface as used. Called when the user actually uses voice/Live.
 * Resets long-absence calculations.
 */
export function markSurfaceUsed(surface: BannerSurface): void {
  const key = surface === "home" ? VOICE_USED_AT_KEY : LIVE_USED_AT_KEY;
  writeStorage(key, String(Date.now()));
}

/**
 * Banner content lookup -- given a spec, returns title/body/cta strings.
 * Centralized here so the surface components stay declarative.
 */
export function getBannerContent(spec: BannerSpec): {
  title: string;
  body: string;
  ctaLabel?: string;
  variant: "voice" | "live";
} {
  const variant: "voice" | "live" = spec.surface === "home" ? "voice" : "live";

  if (spec.surface === "home") {
    switch (spec.trigger) {
      case "first_time":
        return {
          title: "Talk to Seven, hands-free",
          body: "Tap the mic to dictate, or open Live for full conversation. Seven hears as well as it reads.",
          ctaLabel: "Got it",
          variant,
        };
      case "post_update":
        return {
          title: "Voice quality just improved",
          body: "Seven now streams responses token-by-token and surfaces what it consulted. Try a question.",
          ctaLabel: "Got it",
          variant,
        };
      case "long_absence":
        return {
          title: "Welcome back",
          body: "Seven has kept track of every decision and pattern since you were last here. Pick up where you left off.",
          ctaLabel: "Continue",
          variant,
        };
    }
  } else {
    switch (spec.trigger) {
      case "first_time":
        return {
          title: "Live mode -- Seven sees and hears you",
          body: "Camera and mic together. Seven holds context across the whole session and remembers it after.",
          ctaLabel: "Got it",
          variant,
        };
      case "post_update":
        return {
          title: "Live just got better",
          body: "Improved transcription latency and visual frame analysis. Try sharing your screen.",
          ctaLabel: "Got it",
          variant,
        };
      case "long_absence":
        return {
          title: "Live, ready when you are",
          body: "Pick up the conversation. Seven still has every prior session in memory.",
          ctaLabel: "Continue",
          variant,
        };
    }
  }
}
