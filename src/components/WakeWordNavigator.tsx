import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAlwaysListening } from "@/contexts/AlwaysListeningContext";

/**
 * WakeWordNavigator
 *
 * Subscribes to wake word detections from AlwaysListeningContext.
 * On detection:
 *   1. Unlocks mobile audio (creates + resumes an AudioContext). Wake word
 *      detection counts as a user-initiated session per Section 4.4, so
 *      browsers permit the resume.
 *   2. Navigates to /live to open Live voice mode, unless already there.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.5, Section 4.4 —
 * "Seamless Live mode entry: wake word triggers full Live page transition
 * automatically".
 *
 * Must be rendered at app root, inside both <BrowserRouter> and
 * <AlwaysListeningProvider>. Renders nothing visible.
 *
 * Contract: AlwaysListeningContext exposes `lastDetectionAt: number | null`
 * (monotonically increasing timestamp) and `enabled: boolean`.
 */
export function WakeWordNavigator(): null {
  const { lastDetectionAt, enabled } = useAlwaysListening();
  const navigate = useNavigate();
  const location = useLocation();
  const lastHandledRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (lastDetectionAt == null) return;
    if (lastHandledRef.current === lastDetectionAt) return;

    lastHandledRef.current = lastDetectionAt;

    // Mobile audio unlock. Safe to call even if already resumed; non-fatal
    // if it fails — the Live page has its own unlock path as a backstop.
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {
            /* non-fatal */
          });
        }
      }
    } catch {
      /* non-fatal */
    }

    // Avoid redundant navigation if the user is already on /live.
    if (location.pathname !== "/live") {
      navigate("/live", { state: { source: "wake-word" } });
    }
  }, [lastDetectionAt, enabled, navigate, location.pathname]);

  return null;
}

export default WakeWordNavigator;
