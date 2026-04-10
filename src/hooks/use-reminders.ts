import { useState, useEffect, useCallback } from "react";

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueAt: string; // ISO string
  source: "manual" | "seven";
  seen: boolean;
  createdAt: string;
}

const STORAGE_KEY = "seven_reminders";

const loadReminders = (): Reminder[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveReminders = (reminders: Reminder[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
};

// Auto-suggested reminders Seven might create
const sevenSuggestions: Omit<Reminder, "id" | "dueAt" | "seen" | "createdAt">[] = [
  { title: "Reflect on today's decisions", description: "Take 5 minutes to review what choices you made today and why.", source: "seven" },
  { title: "Check in with yourself", description: "How are you feeling right now? Log it so Seven can track your patterns.", source: "seven" },
  { title: "Review your weekly patterns", description: "Your Digest has new insights — take a look.", source: "seven" },
  { title: "Revisit a past decision", description: "It's been a while since you reviewed your Vault. Any lessons?", source: "seven" },
  { title: "Set a new goal", description: "What's one thing you want to focus on this week?", source: "seven" },
];

export const useReminders = () => {
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);

  useEffect(() => {
    saveReminders(reminders);
  }, [reminders]);

  // Seed one auto-suggested reminder if none exist
  useEffect(() => {
    if (reminders.length === 0) {
      const suggestion = sevenSuggestions[Math.floor(Math.random() * sevenSuggestions.length)];
      const now = new Date();
      const dueAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const newReminder: Reminder = {
        ...suggestion,
        id: crypto.randomUUID(),
        dueAt: dueAt.toISOString(),
        seen: false,
        createdAt: now.toISOString(),
      };
      setReminders([newReminder]);
    }
  }, []);

  const addReminder = useCallback((title: string, dueAt: Date, description?: string) => {
    const newReminder: Reminder = {
      id: crypto.randomUUID(),
      title,
      description,
      dueAt: dueAt.toISOString(),
      source: "manual",
      seen: false,
      createdAt: new Date().toISOString(),
    };
    setReminders((prev) => [...prev, newReminder]);
  }, []);

  const markSeen = useCallback((id: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, seen: true } : r)));
  }, []);

  const markAllSeen = useCallback(() => {
    setReminders((prev) => prev.map((r) => ({ ...r, seen: true })));
  }, []);

  const dismissReminder = useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const unseen = reminders.filter((r) => !r.seen);
  const dueNow = reminders.filter((r) => !r.seen && new Date(r.dueAt) <= new Date());

  return { reminders, unseen, dueNow, addReminder, markSeen, markAllSeen, dismissReminder };
};
