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

      <div className="pt-14 pb-36 px-4 max-w-lg mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-start justify-center min-h-[55vh] pt-16">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-[28px] font-normal leading-tight mb-1"
            >
              <span className="gradient-text">{greeting()},</span>
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-[28px] font-normal leading-tight gradient-text mb-6"
            >
              User
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-sm text-muted-foreground mb-8"
            >
              How can I help you today?
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
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-2 mb-2">
                      <svg width="20" height="16" viewBox="0 0 36 28" fill="none">
                        <path d="M18 0C18 7.732 9.936 14 0 14c9.936 0 18 6.268 18 14 0-7.732 8.064-14 18-14-9.936 0-18-6.268-18-14z" fill="url(#msgsparkle)"/>
                        <defs>
                          <linearGradient id="msgsparkle" x1="0" y1="0" x2="36" y2="28">
                            <stop stopColor="hsl(217, 91%, 60%)" />
                            <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                            <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="text-xs font-medium text-muted-foreground">Seven</span>
                    </div>
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
