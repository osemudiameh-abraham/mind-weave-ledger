import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";

interface CheckInSheetProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  decision: string;
}

const CheckInSheet = ({ open, onClose, userName, decision }: CheckInSheetProps) => {
  const [context, setContext] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (result: "yes" | "no" | "partial") => {
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-6 max-w-lg mx-auto shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="w-10 h-1 bg-border rounded-full mx-auto" />
              <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground">
                <X size={20} />
              </button>
            </div>

            {submitted ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="text-4xl mb-3">✓</div>
                <p className="text-foreground font-medium">Logged. Keep going, {userName}.</p>
              </motion.div>
            ) : (
              <>
                <p className="text-muted-foreground text-sm mb-1">Hey {userName}, quick check-in</p>
                <p className="text-foreground font-medium text-lg mb-6">
                  You said you'd <span className="gradient-text">{decision}</span> — did you follow through?
                </p>

                <div className="flex flex-col gap-3 mb-4">
                  {[
                    { label: "Yes, I did", value: "yes" as const },
                    { label: "No, I didn't", value: "no" as const },
                    { label: "Partially", value: "partial" as const },
                  ].map((opt) => (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSubmit(opt.value)}
                      className="w-full py-3 rounded-2xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-surface-hover transition-colors"
                    >
                      {opt.label}
                    </motion.button>
                  ))}
                </div>

                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Add context (optional)"
                  className="w-full bg-secondary rounded-2xl p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-20"
                />
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CheckInSheet;
