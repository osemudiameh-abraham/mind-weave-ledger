import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface LiveTranscriptProps {
  entries: TranscriptEntry[];
  visible: boolean;
}

const LiveTranscript = ({ entries, visible }: LiveTranscriptProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <AnimatePresence>
      {visible && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          ref={scrollRef}
          className="absolute inset-x-0 bottom-[180px] top-[100px] z-[8] overflow-y-auto px-6"
          style={{
            maskImage: "linear-gradient(transparent 0%, black 8%, black 85%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(transparent 0%, black 8%, black 85%, transparent 100%)",
          }}
        >
          <div className="flex flex-col gap-3 pb-4 pt-6">
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  entry.role === "user"
                    ? "ml-auto bg-white/10 text-white backdrop-blur-sm"
                    : "mr-auto bg-white/[0.07] text-white/90 backdrop-blur-sm"
                }`}
              >
                {entry.role === "ai" && (
                  <span className="mb-1 block text-[11px] font-medium text-white/50">Seven</span>
                )}
                {entry.text}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveTranscript;
