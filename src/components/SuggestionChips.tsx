import { motion } from "framer-motion";
import { TrendingUp, Brain, BarChart3, Eye } from "lucide-react";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

const icons = [TrendingUp, Brain, BarChart3, Eye];

const SuggestionChips = ({ suggestions, onSelect }: SuggestionChipsProps) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 w-full">
      {suggestions.map((s, i) => {
        const Icon = icons[i % icons.length];
        return (
          <motion.button
            key={s}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.35 }}
            onClick={() => onSelect(s)}
            className="flex flex-col items-start gap-2.5 p-3.5 rounded-2xl bg-card border border-border text-left hover:bg-surface-hover hover:shadow-sm transition-all duration-200 min-h-[88px]"
          >
            <Icon size={18} className="text-muted-foreground" />
            <span className="text-[12px] text-foreground leading-snug">{s}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default SuggestionChips;
