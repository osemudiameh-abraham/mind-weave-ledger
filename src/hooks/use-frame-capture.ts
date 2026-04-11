import { useCallback, useRef, useEffect } from "react";

interface UseFrameCaptureOptions {
  /** Video element to capture from */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether to actively capture frames */
  active: boolean;
  /** Capture interval in ms (default 2000 = 0.5 fps, good balance for analysis) */
  intervalMs?: number;
  /** JPEG quality 0-1 (default 0.7) */
  quality?: number;
  /** Max dimension to resize to (default 720) */
  maxDimension?: number;
  /** Called with base64 JPEG string on each capture */
  onFrame: (base64: string) => void;
}

/**
 * Captures frames from a video element at intervals.
 * Frames are resized and compressed as JPEG for efficient transport.
 * 
 * Backend integration: The onFrame callback receives a base64 JPEG
 * string ready to send to your vision API (Gemini, GPT-4V, etc.)
 */
export const useFrameCapture = ({
  videoRef,
  active,
  intervalMs = 2000,
  quality = 0.7,
  maxDimension = 720,
  onFrame,
}: UseFrameCaptureOptions) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return; // HAVE_CURRENT_DATA

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;

    // Calculate scaled dimensions maintaining aspect ratio
    let { videoWidth: w, videoHeight: h } = video;
    if (w === 0 || h === 0) return;

    const scale = Math.min(1, maxDimension / Math.max(w, h));
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);

    canvas.width = sw;
    canvas.height = sh;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, sw, sh);

    // Export as base64 JPEG (strip data:image/jpeg;base64, prefix)
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1];
    if (base64) {
      onFrame(base64);
    }
  }, [videoRef, quality, maxDimension, onFrame]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Capture first frame after a short delay for video to initialize
    const startTimeout = setTimeout(() => {
      captureFrame();
      intervalRef.current = setInterval(captureFrame, intervalMs);
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, intervalMs, captureFrame]);

  return { captureFrame };
};
