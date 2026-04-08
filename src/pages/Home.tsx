import { useState } from "react";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import ChatInput from "@/components/ChatInput";
import SuggestionChips from "@/components/SuggestionChips";
import CheckInSheet from "@/components/CheckInSheet";

interface Message {
  role: "user" | "ai";
  text: string;
}

const suggestions = [
  "What patterns did I show this week?",
  "Review my last decision",
  "How am I doing?",
  "Spot a habit",
];

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCheckIn, setShowCheckIn] = useState(false);

  const handleSend = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "ai", text: `I'll remember that. Based on your patterns, here's what I notice about "${text.slice(0, 40)}..." — this connects to a recurring theme in your decisions.` },
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

      <div className="pt-16 pb-36 px-4 max-w-lg mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="w-12 h-12 rounded-full gradient-bg animate-breathe mx-auto mb-6" />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-2xl font-semibold text-foreground mb-2 text-center">
              {greeting()}, User
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground mb-8 text-center">
              What's on your mind?
            </motion.p>
            <SuggestionChips suggestions={suggestions} onSelect={handleSend} />
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "gradient-bg text-primary-foreground rounded-br-md"
                    : "bg-card border border-border text-foreground rounded-bl-md"
                }`}>
                  {msg.role === "ai" && (
                    <div className="w-5 h-5 rounded-full gradient-bg mb-2 opacity-60" />
                  )}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} />
      <BottomNav />

      <CheckInSheet
        open={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        userName="User"
        decision="wake up at 6am"
      />
    </div>
  );
};

export default Home;
