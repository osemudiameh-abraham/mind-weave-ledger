/**
 * Notification hook — Architecture v5.5, Section 10.7
 *
 * Registers service worker, requests notification permission,
 * subscribes to push (when VAPID key configured), and polls for
 * due notifications (decision reviews, pattern warnings).
 *
 * Notification types:
 * 1. Decision review due (high priority)
 * 2. Pattern warning (medium priority)
 * 3. Weekly digest (low priority)
 * 4. Reminder confirmation (immediate)
 * 5. GEL action result (immediate)
 * 6. Proactive engagement (low priority, opt-in)
 *
 * Rules: max 3 push/day, never during quiet hours (22:00-07:00),
 * never include sensitive details in preview text.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

interface NotificationState {
  permission: NotificationPermission | "unsupported";
  pushSubscribed: boolean;
  dueReviews: number;
}

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    pushSubscribed: false,
    dueReviews: 0,
  });

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[NOTIFICATIONS] SW registration failed:", err);
      });
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setState((prev) => ({ ...prev, permission: result }));

    if (result === "granted") {
      await subscribeToPush();
    }
  }, []);

  // Subscribe to web push (requires VAPID_PUBLIC_KEY env var)
  const subscribeToPush = useCallback(async () => {
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapidKey) {
        console.log("[NOTIFICATIONS] No VAPID key configured — push disabled, polling only");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        setState((prev) => ({ ...prev, pushSubscribed: true }));
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Store subscription in Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const subJson = subscription.toJSON();
      await supabase.from("notification_subscriptions").upsert({
        user_id: session.user.id,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh!,
        auth_key: subJson.keys!.auth!,
      }, { onConflict: "user_id,endpoint" });

      setState((prev) => ({ ...prev, pushSubscribed: true }));
      console.log("[NOTIFICATIONS] Push subscription stored");
    } catch (err) {
      console.error("[NOTIFICATIONS] Push subscription failed:", err);
    }
  }, []);

  // Poll for due notifications (works without push — when app is open)
  useEffect(() => {
    const checkNotifications = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const now = new Date();
      const hour = now.getHours();
      // Quiet hours: 22:00 - 07:00
      if (hour >= 22 || hour < 7) return;

      // Check decisions due for review
      const { data: dueDecisions, count } = await supabase
        .from("decisions")
        .select("id, title", { count: "exact" })
        .eq("user_id", session.user.id)
        .in("status", ["active", "pending_review"])
        .lte("review_due_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
        .gte("review_due_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      setState((prev) => ({ ...prev, dueReviews: count || 0 }));

      // Show browser notification for new due reviews (max 1 per session per decision)
      if (Notification.permission === "granted" && dueDecisions) {
        for (const d of dueDecisions) {
          if (lastNotifiedRef.current.has(d.id)) continue;
          lastNotifiedRef.current.add(d.id);

          // Check daily limit (max 3 notifications)
          const { count: todayCount } = await supabase
            .from("notification_log")
            .select("id", { count: "exact", head: true })
            .eq("user_id", session.user.id)
            .gte("sent_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());

          if ((todayCount || 0) >= 3) break;

          // Show notification
          const registration = await navigator.serviceWorker?.ready;
          if (registration) {
            registration.showNotification("Decision Review Due", {
              body: `Your decision "${d.title.slice(0, 50)}" is due for review. How did it work out?`,
              icon: "/favicon.svg",
              tag: `review-${d.id}`,
              data: { url: "/reviews" },
            });
          }

          // Log it
          await supabase.from("notification_log").insert({
            user_id: session.user.id,
            notification_type: "decision_review",
            title: "Decision Review Due",
            body: `Decision "${d.title.slice(0, 50)}" is due for review`,
            delivered: true,
          });
        }
      }
    };

    // Check immediately, then every 5 minutes
    checkNotifications();
    pollTimerRef.current = setInterval(checkNotifications, 5 * 60 * 1000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  return {
    ...state,
    requestPermission,
  };
}

// Utility: convert base64 VAPID key to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
