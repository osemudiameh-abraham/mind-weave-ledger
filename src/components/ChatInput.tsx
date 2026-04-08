import { Mic, Send } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

const ChatInput = ({ onSend, placeholder = "Ask Seven Mynd anything…" }: ChatInputProps) => {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-full shadow-lg border border-border flex items-center px-4 py-2 gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {value.trim() ? (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleSend}
              className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center"
            >
              <Send size={16} className="text-primary-foreground" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.85 }}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
            >
              <Mic size={16} className="text-muted-foreground" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
