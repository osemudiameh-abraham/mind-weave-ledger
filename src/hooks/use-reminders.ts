/**
 * useReminders — Stage B2
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Supabase-backed reminders hook. Replaces the Phase 0 localStorage stub.
 *
 * Data model
 * ──────────
 *   Two source tables merged into one UI-friendly Reminder[] array:
 *
 *   1. public.reminders (status='scheduled')
 *        → Upcoming reminders the user has set. Shows in the sheet as
 *          "due at <local time>". Once fired, the row transitions to
 *          status='delivered' and moves to group 2.
 *
 *   2. public.notifications (kind='reminder' OR 'pre_reminder')
 *        → Delivered reminders. Shows in the sheet with a "delivered" badge
 *          (via reminder.fired=true). Realtime-subscribed so new arrivals
 *          appear instantly and trigger a toast.
 *
 * Public API (preserved from localStorage version for drop-in compat)
 * ──────────────────────────────────────────────────────────────────
 *   {
 *     reminders: Reminder[];      // scheduled + delivered, sorted by dueAt asc
 *     unseen: Reminder[];         // delivered & status='unread' (badge count)
 *     dueNow: Reminder[];         // scheduled AND past due + unseen
 *     addReminder(title, dueAt, description?);
 *     markSeen(id);
 *     markAllSeen();
 *     dismissReminder(id);
 *   }
 *
 * Additional optional fields on Reminder (backward compatible)
 * ──────────────────────────────────────────────────────────
 *   fired?: boolean           — true when this came from notifications table
 *   importance?: 'normal' | 'important'
 *   preLeadMinutes?: number   — for pre-reminders, how far ahead they fired
 *
 * Realtime
 * ────────
 *   Subscribes to INSERT events on public.notifications filtered to this
 *   user. When a notification arrives: prepends to the list + toast.
 *
 * Failure handling
 * ────────────────
 *   If Supabase is unreachable, we fall back to empty state (no fake data).
 *   The UI shows "No reminders yet" — better than showing stale localStorage
 *   data that doesn't match what's actually in the DB.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueAt: string;                    // ISO string
  source: "manual" | "seven";
  seen: boolean;
  createdAt: string;
  // ── New optional fields ──
  fired?: boolean;                  // true when this row represents a delivered notification
  importance?: "normal" | "important";
  preLeadMinutes?: number;          // set for pre-reminder notifications
  sourceId?: string;                // id of the underlying public.reminders row (for dedup)
}

// Shape of a row from public.reminders (scheduled reminders)
interface ReminderRow {
  id: string;
  text_snapshot: string;
  trigger_at_utc: string;
  user_local_display: string | null;
  importance: "normal" | "important";
  status: "scheduled" | "delivered" | "cancelled" | "failed" | "snoozed";
  source: string;
  created_at: string;
}

// Shape of a row from public.notifications (delivered)
interface NotificationRow {
  id: string;
  kind: "reminder" | "pre_reminder" | "review_due" | "pattern_alert" | "digest" | "system";
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  status: "unread" | "read" | "dismissed";
  created_at: string;
  read_at: string | null;
  source_table: string | null;
  source_id: string | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────────

function reminderRowToUiReminder(row: ReminderRow): Reminder {
  return {
    id: `r:${row.id}`,               // prefix to avoid collision with notification ids
    title: row.text_snapshot,
    description: undefined,
    dueAt: row.trigger_at_utc,
    source: row.source === "chat" ? "seven" : "manual",
    seen: true,                       // scheduled items are always "seen" (not delivered yet)
    createdAt: row.created_at,
    fired: false,
    importance: row.importance,
    sourceId: row.id,
  };
}

function notificationRowToUiReminder(row: NotificationRow): Reminder | null {
  if (row.kind !== "reminder" && row.kind !== "pre_reminder") return null;

  const payload = row.payload || {};
  const leadMinutes = typeof payload.lead_minutes === "number" ? payload.lead_minutes : undefined;
  const importance = (payload.importance as "normal" | "important" | undefined) ?? "normal";
  const triggerAt = typeof payload.trigger_at_utc === "string" ? payload.trigger_at_utc : row.created_at;

  return {
    id: `n:${row.id}`,
    title: row.title,
    description: row.body ?? undefined,
    dueAt: triggerAt,
    source: "seven",
    seen: row.status !== "unread",
    createdAt: row.created_at,
    fired: true,
    importance,
    preLeadMinutes: leadMinutes,
    sourceId: row.source_id ?? undefined,
  };
}

/** Remove duplicates when the same underlying reminder appears as both a
 *  scheduled row AND a delivered notification. Delivered wins. */
function dedupeByUnderlyingReminder(items: Reminder[]): Reminder[] {
  const deliveredSourceIds = new Set(
    items.filter((r) => r.fired && r.sourceId).map((r) => r.sourceId as string),
  );
  return items.filter((r) => {
    if (r.fired) return true;                          // always keep delivered
    if (!r.sourceId) return true;                      // no linkage, can't dedup
    return !deliveredSourceIds.has(r.sourceId);        // drop scheduled if delivered exists
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────

export const useReminders = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Stable ref for realtime handler so we don't re-subscribe on state changes
  const remindersRef = useRef<Reminder[]>([]);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  // ─── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setReminders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [schedRes, notifRes] = await Promise.all([
          supabase
            .from("reminders")
            .select("id, text_snapshot, trigger_at_utc, user_local_display, importance, status, source, created_at")
            .eq("user_id", userId)
            .eq("status", "scheduled")
            .order("trigger_at_utc", { ascending: true })
            .limit(100),
          supabase
            .from("notifications")
            .select("id, kind, title, body, payload, status, created_at, read_at, source_table, source_id")
            .eq("user_id", userId)
            .in("kind", ["reminder", "pre_reminder"])
            .neq("status", "dismissed")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (cancelled) return;

        const scheduled = (schedRes.data ?? []).map((r) => reminderRowToUiReminder(r as ReminderRow));
        const delivered = (notifRes.data ?? [])
          .map((r) => notificationRowToUiReminder(r as NotificationRow))
          .filter((r): r is Reminder => r !== null);

        const merged = dedupeByUnderlyingReminder([...scheduled, ...delivered]).sort(
          (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
        );

        setReminders(merged);
      } catch (err) {
        console.warn("[useReminders] load failed:", err);
        setReminders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ─── Realtime subscription ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          const uiReminder = notificationRowToUiReminder(row);
          if (!uiReminder) return;

          // De-dupe: if this notification's source_id matches an existing
          // scheduled reminder, remove the scheduled one (it's just fired).
          setReminders((prev) => {
            const withoutScheduled = uiReminder.sourceId
              ? prev.filter((r) => !(r.sourceId === uiReminder.sourceId && !r.fired))
              : prev;
            const withoutDupe = withoutScheduled.filter((r) => r.id !== uiReminder.id);
            return [uiReminder, ...withoutDupe];
          });

          // Toast — visible even when RemindersSheet is closed.
          const dwellMs = uiReminder.importance === "important" ? 10000 : 6000;
          toast(uiReminder.title, {
            description: uiReminder.description,
            duration: dwellMs,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const addReminder = useCallback(
    async (title: string, dueAt: Date, description?: string) => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from("reminders")
          .insert({
            user_id: userId,
            text_snapshot: title,
            original_message: description ?? title,
            trigger_at_utc: dueAt.toISOString(),
            importance: "normal",
            channels: ["in_app", "push"],
            pre_reminders: [],
            status: "scheduled",
            source: "manual",
          })
          .select("id, text_snapshot, trigger_at_utc, user_local_display, importance, status, source, created_at")
          .single();

        if (error || !data) {
          console.error("[useReminders] addReminder failed:", error?.message);
          toast.error("Couldn't save reminder. Please try again.");
          return;
        }

        const newReminder = reminderRowToUiReminder(data as ReminderRow);
        newReminder.description = description;
        newReminder.source = "manual";
        setReminders((prev) =>
          [...prev, newReminder].sort(
            (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
          ),
        );
      } catch (err) {
        console.error("[useReminders] addReminder exception:", err);
        toast.error("Couldn't save reminder. Please try again.");
      }
    },
    [userId],
  );

  const markSeen = useCallback(async (id: string) => {
    if (!id.startsWith("n:")) return;
    const notificationId = id.slice(2);
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, seen: true } : r)));
    try {
      await supabase
        .from("notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("status", "unread");
    } catch (err) {
      console.warn("[useReminders] markSeen failed:", err);
    }
  }, []);

  const markAllSeen = useCallback(async () => {
    if (!userId) return;
    const unreadNotifIds = remindersRef.current
      .filter((r) => r.fired && !r.seen && r.id.startsWith("n:"))
      .map((r) => r.id.slice(2));

    if (unreadNotifIds.length === 0) return;

    setReminders((prev) => prev.map((r) => (r.fired && !r.seen ? { ...r, seen: true } : r)));

    try {
      await supabase
        .from("notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .in("id", unreadNotifIds)
        .eq("status", "unread");
    } catch (err) {
      console.warn("[useReminders] markAllSeen failed:", err);
    }
  }, [userId]);

  const dismissReminder = useCallback(async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      if (id.startsWith("n:")) {
        await supabase
          .from("notifications")
          .update({
            status: "dismissed",
            dismissed_at: new Date().toISOString(),
          })
          .eq("id", id.slice(2));
      } else if (id.startsWith("r:")) {
        await supabase
          .from("reminders")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", id.slice(2));
      }
    } catch (err) {
      console.warn("[useReminders] dismissReminder failed:", err);
    }
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────

  const unseen = reminders.filter((r) => !r.seen);
  const dueNow = reminders.filter((r) => !r.seen && new Date(r.dueAt) <= new Date());

  return {
    reminders,
    unseen,
    dueNow,
    loading,
    addReminder,
    markSeen,
    markAllSeen,
    dismissReminder,
  };
};
