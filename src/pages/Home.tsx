import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import ChatInput from "@/components/ChatInput";
import SevenLogo from "@/components/SevenLogo";

interface Message {
  role: "user" | "ai";
  text: string;
}

const suggestions = [
  { text: "What patterns did I show this week?", icon: "✦" },
  { text: "Review my last decision", icon: "📋" },
  { text: "How am I tracking?", icon: "📊" },
  { text: "Spot a habit", icon: "🔍" },
];

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const navigate = useNavigate();

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

      <div className="pt-14 pb-36 px-4 max-w-lg mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[65vh] pt-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <SevenLogo size={44} className="mb-8" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="text-[26px] font-normal text-foreground tracking-[-0.02em] text-center mb-2"
            >
              {greeting()}, User
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[15px] text-muted-foreground mb-10"
            >
              Where should we start?
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="grid grid-cols-2 gap-3 w-full max-w-sm"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.text)}
                  className="bg-card border border-border rounded-2xl p-4 text-left hover:bg-surface-hover transition-colors group"
                >
                  <span className="text-lg mb-2 block">{s.icon}</span>
                  <span className="text-[13px] text-foreground/80 leading-snug">{s.text}</span>
                </button>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 text-[14px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-md"
                      : "bg-card border border-border text-foreground rounded-[20px] rounded-bl-md"
                  }`}
                >
                  {msg.role === "ai" && (
                    <div className="flex items-center gap-2 mb-2">
                      <SevenLogo size={16} />
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

      <ChatInput onSend={handleSend} onLive={() => navigate("/live")} />
      <BottomNav />
    </div>
  );
};

export default Home;
