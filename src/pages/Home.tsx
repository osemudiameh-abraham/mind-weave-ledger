import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import ChatInput from "@/components/ChatInput";
import SevenLogo from "@/components/SevenLogo";

interface Message {
  role: "user" | "ai";
  text: string;
}

const suggestions = [
  { emoji: "🔍", text: "What patterns did I show this week?" },
  { emoji: "🧠", text: "Review my last decision" },
  { emoji: "📊", text: "How am I tracking?" },
  { emoji: "🔄", text: "Spot a habit" },
  { emoji: "🗂️", text: "Show me my vault" },
  { emoji: "📝", text: "Summarize my week" },
];

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "ai",
        text: `Based on your patterns, here's what I notice about "${text.slice(0, 40)}…" — this connects to a recurring theme in your decisions. I'll keep tracking this.`,
      },
    ]);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <div className="pt-14 pb-32 px-4 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[75vh]"
            >
              {/* Animated gradient orb behind logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative mb-8"
              >
                <div className="absolute inset-[-20px] rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 blur-2xl animate-pulse" />
                <div className="relative">
                  <SevenLogo size={48} />
                </div>
              </motion.div>

              {/* Greeting with gradient text */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-[32px] font-medium tracking-[-0.03em] text-center leading-[1.15]"
              >
                <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
                  {greeting()}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-[20px] text-muted-foreground font-normal mt-1 tracking-[-0.01em]"
              >
                Where should we start?
              </motion.p>

              {/* Suggestion cards — 2-column grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-2 gap-2.5 mt-10 w-full"
              >
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.45 + i * 0.06,
                      duration: 0.4,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSend(s.text)}
                    className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/60 transition-colors text-left group"
                  >
                    <span className="text-[18px] mt-0.5 shrink-0">{s.emoji}</span>
                    <span className="text-[13px] leading-snug text-foreground/80 font-medium group-hover:text-foreground transition-colors">
                      {s.text}
                    </span>
                  </motion.button>
                ))}
              </motion.div>

              {/* Live button hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-8 flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[12px] text-muted-foreground">
                  Tap the mic to start a live session
                </span>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-3 mt-6"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 text-[14px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-md"
                        : "text-foreground"
                    }`}
                  >
                    {msg.role === "ai" && (
                      <div className="flex items-center gap-2 mb-2">
                        <SevenLogo size={16} />
                        <span className="text-[12px] font-medium text-muted-foreground">Seven</span>
                      </div>
                    )}
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatInput onSend={handleSend} onLive={() => navigate("/live")} />
      <BottomNav />
    </div>
  );
};

export default Home;
