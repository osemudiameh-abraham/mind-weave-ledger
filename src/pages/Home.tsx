import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import TypewriterBubble from "@/components/TypewriterBubble";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import ChatInput from "@/components/ChatInput";
import SevenLogo from "@/components/SevenLogo";

interface Message {
  role: "user" | "ai";
  text: string;
}

const suggestions = [
  "What patterns did I show this week?",
  "Review my last decision",
  "How am I tracking?",
  "Spot a habit",
  "Show me my vault",
  "Summarize my week",
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

  const userName = "User"; // TODO: replace with actual user name from auth

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Good night";
  };

  const tips = [
    "Tap the live button to start speaking with Seven — it's the fastest way to get to know each other.",
    "Try asking me about your patterns — I'll track what matters to you over time.",
    "Use the suggestion chips below to explore what Seven can do for you.",
    "Check your Vault anytime to revisit saved insights and decisions.",
  ];

  const tipOfTheDay = tips[new Date().getDate() % tips.length];

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <div className="pt-14 pb-32 px-4 max-w-lg mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-6"
            >
              <SevenLogo size={40} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-[28px] font-normal text-foreground tracking-[-0.02em] text-center leading-tight"
            >
              {greeting()},
              <br />
              <span className="text-muted-foreground">where should we start?</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex gap-2 overflow-x-auto no-scrollbar mt-8 -mx-4 px-4 w-screen max-w-lg"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="flex-shrink-0 px-4 py-2.5 rounded-full border border-border bg-card text-[13px] text-foreground font-medium hover:bg-muted transition-colors whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed bg-primary/10 text-foreground rounded-[20px] rounded-br-md">
                    {msg.text}
                  </div>
                ) : (
                  <TypewriterBubble text={msg.text} />
                )}
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
