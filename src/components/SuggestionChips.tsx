import { motion } from "framer-motion";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

const SuggestionChips = ({ suggestions, onSelect }: SuggestionChipsProps) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center px-4">
      {suggestions.map((s, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(s)}
          className="px-4 py-2 rounded-full bg-card border border-border text-sm text-foreground hover:bg-surface-hover transition-colors shadow-sm"
        >
          {s}
        </motion.button>
      ))}
    </div>
  );
};

export default SuggestionChips;
