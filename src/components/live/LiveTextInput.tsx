import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";

interface LiveTextInputProps {
  visible: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}

const LiveTextInput = ({ visible, onSend, onClose }: LiveTextInputProps) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      setValue("");
    }
  }, [visible]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-x-0 bottom-[140px] z-[12] px-5"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 backdrop-blur-md">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Type a message…"
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
            />
            {value.trim() ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <Send size={14} />
              </motion.button>
            ) : (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/50"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveTextInput;
