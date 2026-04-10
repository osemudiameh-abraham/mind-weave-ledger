import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

interface LiveControlsProps {
  muted: boolean;
  cameraOn: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
}

const LiveControls = ({ muted, cameraOn, onToggleMute, onToggleCamera, onEnd }: LiveControlsProps) => {
  return (
    <div className="flex items-center justify-center gap-6">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onToggleMute}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
          muted
            ? "bg-white/20 backdrop-blur-sm"
            : "bg-white/10 backdrop-blur-sm"
        }`}
      >
        {muted ? (
          <MicOff size={22} className="text-white/80" />
        ) : (
          <Mic size={22} className="text-white/80" />
        )}
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onEnd}
        className="w-[68px] h-[68px] rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/40"
      >
        <PhoneOff size={26} className="text-white" />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onToggleCamera}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
          cameraOn
            ? "bg-primary/30 backdrop-blur-sm"
            : "bg-white/10 backdrop-blur-sm"
        }`}
      >
        {cameraOn ? (
          <Video size={22} className="text-white/80" />
        ) : (
          <VideoOff size={22} className="text-white/80" />
        )}
      </motion.button>
    </div>
  );
};

export default LiveControls;
