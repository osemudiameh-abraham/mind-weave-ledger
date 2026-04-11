import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SwitchCamera } from "lucide-react";

interface LiveVideoFeedProps {
  active: boolean;
  onError?: (msg: string) => void;
  /** Expose video element ref for frame capture */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

const LiveVideoFeed = ({ active, onError, videoRef: externalVideoRef }: LiveVideoFeedProps) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // Use external ref if provided, otherwise internal
  const videoElement = externalVideoRef?.current ?? internalVideoRef.current;

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const vid = externalVideoRef?.current ?? internalVideoRef.current;
        if (vid) {
          vid.srcObject = stream;
        }
      } catch {
        onError?.("Camera access denied");
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, facingMode]);

  const toggleCamera = () => {
    setFacingMode((m) => (m === "user" ? "environment" : "user"));
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-[5] overflow-hidden"
        >
          <video
            ref={externalVideoRef ?? internalVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.5) 100%)",
            }}
          />

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleCamera}
            className="absolute right-4 top-20 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
            aria-label="Switch camera"
          >
            <SwitchCamera size={20} strokeWidth={1.8} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveVideoFeed;
