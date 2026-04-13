import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { unlockMobileAudio } from "@/services/live/RealLiveService";

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
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Auto-scroll to latest message
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load section from URL param (e.g. /home?section=uuid from Library)
  useEffect(() => {
    const sectionFromUrl = searchParams.get("section");
    if (sectionFromUrl) {
      setActiveSectionId(sectionFromUrl);
      // Clear the param so it doesn't re-trigger on subsequent renders
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setActiveSectionId, setSearchParams]);

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

  // ─── Intelligent greeting context ───
  const [greetingContext, setGreetingContext] = useState<{
    pendingReviews: number;
    latestFact: string | null;
    weekMemories: number;
    totalFacts: number;
  }>({ pendingReviews: 0, latestFact: null, weekMemories: 0, totalFacts: 0 });

  useEffect(() => {
    const loadContext = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const userId = session.user.id;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [reviewsRes, factRes, memsRes, totalFactsRes] = await Promise.all([
        supabase.from("decisions").select("id", { count: "exact", head: true })
          .eq("user_id", userId).in("status", ["active", "pending_review"])
          .lte("review_due_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("memory_facts").select("subject, attribute, value_text")
          .eq("user_id", userId).is("valid_until", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("memories_structured").select("id", { count: "exact", head: true })
          .eq("user_id", userId).gte("captured_at", weekAgo),
        supabase.from("memory_facts").select("id", { count: "exact", head: true })
          .eq("user_id", userId).is("valid_until", null),
      ]);

      setGreetingContext({
        pendingReviews: reviewsRes.count || 0,
        latestFact: factRes.data ? `${factRes.data.subject} ${factRes.data.attribute}: ${factRes.data.value_text}` : null,
        weekMemories: memsRes.count || 0,
        totalFacts: totalFactsRes.count || 0,
      });
    };
    loadContext();
  }, []);

  // Build tips: context-aware first, then generic
  const contextTips: string[] = [];
  if (greetingContext.pendingReviews > 0) {
    contextTips.push(`You have ${greetingContext.pendingReviews} decision${greetingContext.pendingReviews === 1 ? "" : "s"} due for review. Want to check in?`);
  }
  if (greetingContext.totalFacts > 0) {
    contextTips.push(`I know ${greetingContext.totalFacts} facts about you so far. The more you share, the sharper I get.`);
  }
  if (greetingContext.weekMemories > 0) {
    contextTips.push(`You shared ${greetingContext.weekMemories} thoughts with me this week. I'm tracking patterns.`);
  }

  const genericTips = [
    "Tell me about a decision you're facing — I'll track it and check back later.",
    "Try asking me about your patterns — I'll surface what matters over time.",
    "Check your Vault anytime to see everything I know about you.",
    "Head to your Digest for a weekly summary of what I've learned.",
    "Seven learns from every conversation — the more you share, the sharper the insights.",
  ];

  const tips = contextTips.length > 0 ? [...contextTips, ...genericTips] : genericTips;

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

      <div className="pt-14 pb-32 px-4 max-w-7xl mx-auto">
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
              <span className="bg-gradient-to-r from-primary via-[hsl(250,80%,65%)] to-[hsl(280,75%,60%)] bg-clip-text text-transparent">{greetingContext.pendingReviews > 0 ? "you have decisions to check in on" : greetingContext.totalFacts > 0 ? "what's on your mind?" : "where should we start?"}</span>
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
              className="flex flex-wrap justify-center gap-2 mt-8"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="px-4 py-2.5 rounded-full border border-border bg-card text-[13px] text-foreground font-medium hover:bg-muted transition-colors"
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} onLive={() => {
        unlockMobileAudio();
        navigate("/live");
      }} />
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
