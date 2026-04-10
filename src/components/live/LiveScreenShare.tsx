import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveScreenShareProps {
  active: boolean;
  onStopped?: () => void;
  onError?: (msg: string) => void;
}

const LiveScreenShare = ({ active, onStopped, onError }: LiveScreenShareProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;

    const startShare = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Handle user stopping share via browser UI
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          onStopped?.();
        });
      } catch {
        onError?.("Screen share denied");
        onStopped?.();
      }
    };

    startShare();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-[5] overflow-hidden bg-black"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 70%, rgba(0,0,0,0.45) 100%)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveScreenShare;
