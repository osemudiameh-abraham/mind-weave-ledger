import { useState, useRef, useEffect } from "react";
import { Mic, Send, Plus, Image } from "lucide-react";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (text: string) => void;
  onLive?: () => void;
}

const ChatInput = ({ onSend, onLive }: ChatInputProps) => {
  const [value, setValue] = useState("");
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

  return (
    <div className="fixed bottom-[60px] left-0 right-0 z-40 px-4 pb-2">
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-[28px] border border-border shadow-sm flex items-end gap-1 px-3 py-2">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5">
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
            placeholder="Talk to Seven"
            rows={1}
            className="flex-1 bg-transparent text-foreground text-[14px] placeholder:text-muted-foreground outline-none resize-none py-1.5 leading-relaxed"
          />

          {hasText ? (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleSend}
              className="p-2 bg-primary text-primary-foreground rounded-full shrink-0 mb-0.5 transition-transform active:scale-90"
            >
              <Send size={16} />
            </motion.button>
          ) : (
            <>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5">
                <Image size={20} />
              </button>
              <button
                onClick={onLive}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5"
              >
                <Mic size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
