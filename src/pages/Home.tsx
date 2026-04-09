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
          <div className="flex flex-col items-start justify-center min-h-[60vh] pt-20">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
              className="text-[28px] font-normal leading-tight tracking-[-0.02em]"
            >
              <span className="gradient-text">{greeting()},</span>
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
              className="text-[28px] font-normal leading-tight gradient-text mb-8 tracking-[-0.02em]"
            >
              User
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.35 }}
              className="text-[14px] text-muted-foreground mb-8"
            >
              How can I help you today?
            </motion.p>
            <SuggestionChips suggestions={suggestions} onSelect={handleSend} />
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 text-[14px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-md shadow-sm"
                      : "bg-card border border-border text-foreground rounded-[20px] rounded-bl-md"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-2 mb-2">
                      <svg width="18" height="14" viewBox="0 0 36 28" fill="none">
                        <path d="M18 0C18 6 13 9.5 8.5 11.5C4.5 13 1.5 13.5 0 14C1.5 14.5 4.5 15 8.5 16.5C13 18.5 18 22 18 28C18 22 23 18.5 27.5 16.5C31.5 15 34.5 14.5 36 14C34.5 13.5 31.5 13 27.5 11.5C23 9.5 18 6 18 0Z" fill="url(#msgsparkle)"/>
                        <defs>
                          <linearGradient id="msgsparkle" x1="0" y1="0" x2="36" y2="28">
                            <stop stopColor="hsl(217, 91%, 60%)" />
                            <stop offset="0.5" stopColor="hsl(262, 83%, 58%)" />
                            <stop offset="1" stopColor="hsl(330, 81%, 60%)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="text-[11px] font-medium text-muted-foreground">Seven</span>
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
