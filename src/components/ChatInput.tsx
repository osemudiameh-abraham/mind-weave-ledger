import { Mic, Send, Plus, Camera } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

const ChatInput = ({ onSend, placeholder = "Message Seven" }: ChatInputProps) => {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <div className="fixed bottom-[68px] left-0 right-0 px-3 z-40 pb-2">
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-[28px] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] border border-border flex items-center px-3 py-2.5 gap-2">
          <button className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Plus size={18} className="text-foreground" />
          </button>
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
              className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center shrink-0"
            >
              <Send size={16} className="text-primary-foreground" />
            </motion.button>
          ) : (
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-full flex items-center justify-center">
                <Camera size={18} className="text-muted-foreground" />
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center">
                <Mic size={18} className="text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
