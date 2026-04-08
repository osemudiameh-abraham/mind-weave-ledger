import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface CheckInSheetProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  decision: string;
}

const CheckInSheet = ({ open, onClose, userName, decision }: CheckInSheetProps) => {
  const [response, setResponse] = useState<string | null>(null);
  const [context, setContext] = useState("");

  const handleSubmit = () => {
    onClose();
    setResponse(null);
    setContext("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-6 max-w-lg mx-auto border-t border-border"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-6" />

            <h2 className="text-lg font-medium text-foreground mb-1">
              Hey {userName}, quick check-in
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              You said you&apos;d <span className="text-foreground font-medium">{decision}</span> — did you follow through?
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {["Yes", "No", "Partially"].map((opt) => (
                <motion.button
                  key={opt}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setResponse(opt)}
                  className={`w-full py-3 rounded-full text-sm font-medium transition-colors border ${
                    response === opt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  {opt}
                </motion.button>
              ))}
            </div>

            {response && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Add context (optional)"
                  rows={2}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none mb-4 border border-border focus:border-primary transition-colors"
                />
              </motion.div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm"
            >
              Submit
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CheckInSheet;
