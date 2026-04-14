import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Send, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LiveButton from "./LiveButton";
import { useDeepgramDictation } from "@/hooks/use-deepgram-dictation";

interface ChatInputProps {
  onSend: (text: string) => void;
  onLive?: () => void;
}

const ChatInput = ({ onSend, onLive }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSend = () => {
    if (!hasText) return;
    onSend(value.trim());
    setValue("");
  };

  // Deepgram dictation — same pipeline as Live page (Section 10.5)
  const onInterim = useCallback((text: string) => {
    setValue(text);
  }, []);

  const onFinal = useCallback((text: string) => {
    // Don't auto-send — leave text in textarea for user to review and tap Send.
    // This matches Google voice typing UX.
    setValue(text);
    setRecording(false);
  }, []);

  useDeepgramDictation({
    active: recording,
    onInterim,
    onFinal,
  });

  return (
    <div className="fixed left-0 right-0 z-40 px-3 pb-2 bg-background" style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-[28px] border border-border/50 shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] flex items-end gap-1 px-2 py-1.5">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 mb-0.5">
            <Plus size={20} />
          </button>

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={recording ? "Listening…" : "Talk to Seven"}
            rows={1}
            className="flex-1 bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground outline-none resize-none py-2 leading-relaxed min-h-[24px]"
          />

          {hasText && !recording ? (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleSend}
              className="w-9 h-9 bg-primary text-primary-foreground rounded-full flex items-center justify-center shrink-0 mb-0.5"
            >
              <Send size={16} />
            </motion.button>
          ) : (
            <>
              <button
                onClick={() => setRecording((r) => !r)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 mb-0.5 ${
                  recording ? "bg-destructive/15 text-destructive animate-pulse" : "text-muted-foreground hover:bg-muted"
                }`}
                aria-label={recording ? "Stop recording" : "Start voice input"}
              >
                {recording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              {onLive && <LiveButton onClick={onLive} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
