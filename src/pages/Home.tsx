import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import TypewriterBubble from "@/components/TypewriterBubble";
import useTypewriter from "@/hooks/use-typewriter";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import ChatInput from "@/components/ChatInput";
import SevenLogo from "@/components/SevenLogo";
import { useReminders } from "@/hooks/use-reminders";
import SideMenu from "@/components/SideMenu";
import { useSections } from "@/hooks/use-sections";
import { useTrialStatus } from "@/hooks/use-trial-status";
import TrialOfferDialog from "@/components/TrialOfferDialog";
import { useChat } from "@/hooks/use-chat";
import { Loader2 } from "lucide-react";

const suggestions = [
  "What patterns did I show this week?",
  "Review my last decision",
  "How am I tracking?",
  "Spot a habit",
  "Show me my vault",
  "Summarize my week",
];

const Home = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { reminders, unseen, dueNow, addReminder, markSeen, markAllSeen, dismissReminder } = useReminders();
  const {
    sections,
    visibleSections,
    activeSection,
    activeSectionId,
    setActiveSectionId,
    createSection,
    renameSection,
    deleteSection,
    toggleHideSection,
    addMessage,
  } = useSections();

  const { shouldShowPopup, markPopupShown, startTrial } = useTrialStatus();
  const { messages, loading: chatLoading, sendMessage, loadSection, newSection } = useChat();

  // Toast for due reminders
  useEffect(() => {
    dueNow.forEach((r) => {
      toast(r.title, { description: r.description || "Reminder from Seven", duration: 6000 });
      markSeen(r.id);
    });
  }, [dueNow, markSeen]);

  // Load conversation when sidebar selection changes
  useEffect(() => {
    if (activeSectionId) {
      loadSection(activeSectionId);
    } else {
      newSection();
    }
  }, [activeSectionId, loadSection, newSection]);

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  const userName = localStorage.getItem("seven_user_name") || "there";

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
    "Head to your Digest for a daily summary of your tracked patterns.",
    "Seven learns from every conversation — the more you share, the sharper the insights.",
    "Use the Library to browse all your past conversations and decisions.",
    "Your Memory page shows everything Seven has learned about you so far.",
    "Try reviewing a past decision — Seven can help you spot what went right or wrong.",
  ];

  const [tipIndex, setTipIndex] = useState(0);
  const { displayed: tipText, done: tipDone } = useTypewriter(tips[tipIndex], 25);

  useEffect(() => {
    if (!tipDone) return;
    const timeout = setTimeout(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [tipDone, tips.length]);

  return (
    <div className="min-h-screen bg-background">
      <SideMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        sections={sections}
        activeSectionId={activeSectionId}
        onNewSection={() => { createSection(); }}
        onSelectSection={setActiveSectionId}
        onRenameSection={renameSection}
        onDeleteSection={deleteSection}
        onToggleHideSection={toggleHideSection}
      />
      <TopNav
        onMenuClick={() => setMenuOpen(true)}
        reminders={reminders}
        unseenCount={unseen.length}
        onAddReminder={addReminder}
        onDismissReminder={dismissReminder}
        onMarkAllSeen={markAllSeen}
      />

      <div className="pt-14 pb-32 px-4 max-w-3xl mx-auto">
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
              {greeting()}, {userName}
              <br />
              <span className="bg-gradient-to-r from-primary via-[hsl(250,80%,65%)] to-[hsl(280,75%,60%)] bg-clip-text text-transparent">where should we start?</span>
            </motion.h1>

            <motion.p
              key={tipIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-[13px] text-muted-foreground text-center mt-4 max-w-[280px] leading-relaxed"
            >
              {tipText}
              {!tipDone && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block ml-0.5 w-[2px] h-[14px] bg-muted-foreground align-middle"
                />
              )}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex gap-2 overflow-x-auto no-scrollbar mt-8 -mx-4 px-4 w-screen max-w-3xl"
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
            {chatLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-2 px-4 py-3 rounded-[20px] bg-muted">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-[13px] text-muted-foreground">Seven is thinking…</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} onLive={() => navigate("/live")} />
      <BottomNav />

      <TrialOfferDialog
        open={shouldShowPopup}
        onStartTrial={() => { startTrial(); toast.success("Your 14-day free trial has started!"); }}
        onDismiss={markPopupShown}
      />
    </div>
  );
};

export default Home;
