/**
 * Notification hook — Architecture v5.7, Section 11.B
 *
 * Phase 0.B Stage B3.4b (Apr 28 2026)
 *
 * Registers service worker, requests notification permission,
 * subscribes to push (when VAPID key configured), and polls for
 * due notifications (decision reviews, pattern warnings).
 *
 * v3 (B3.4b) adds:
 *  - unsubscribe() function: symmetric off path that unsubscribes
 *    browser-side AND deletes the row from notification_subscriptions
 *  - pushSubscribed exported as a real boolean reflecting browser state
 *  - subscribeToPush returns success/failure so callers can react
 *
 * Notification types (preserved from v5.5):
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

export type RequestPermissionResult =
  | "granted_subscribed"      // Permission granted AND push subscription stored
  | "granted_no_push"         // Permission granted but VAPID not configured (in-app polling only)
  | "denied"                  // User denied the permission prompt
  | "default"                 // User dismissed the prompt without choosing
  | "unsupported"             // Browser doesn't support Notification API
  | "subscribe_failed";       // Permission granted but pushManager.subscribe threw

export interface UseNotificationsApi {
  permission: NotificationPermission | "unsupported";
  pushSubscribed: boolean;
  dueReviews: number;
  /**
   * Triggers the browser permission prompt (must be from a direct user
   * gesture). On grant, also subscribes to push and stores the subscription
   * in notification_subscriptions. Returns a discriminated result so
   * callers can render the right UX feedback.
   */
  requestPermission: () => Promise<RequestPermissionResult>;
  /**
   * Unsubscribes from push (browser-side) and deletes the matching row
   * from notification_subscriptions. Idempotent: returns true even if
   * there was nothing to unsubscribe.
   *
   * Does NOT revoke the browser permission itself — only the user can
   * do that via browser settings. Re-subscribing later still works
   * without re-prompting if the permission is still granted.
   */
  unsubscribe: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsApi {
  const [state, setState] = useState<NotificationState>({
    permission: typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    pushSubscribed: false,
    dueReviews: 0,
  });

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  // Register service worker on mount
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[NOTIFICATIONS] SW registration failed:", err);
      });
    }
  }, []);

  // Initial subscription state probe — on mount, check whether the user
  // already has a live push subscription. This lets the Settings toggle
  // accurately reflect actual browser state on page load (otherwise it
  // would always start as "not subscribed" until the user clicks).
  useEffect(() => {
    const probe = async () => {
      if (!("serviceWorker" in navigator) || typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setState((prev) => ({ ...prev, pushSubscribed: !!existing }));
      } catch (err) {
        // Probe failures are non-fatal — they just mean the toggle starts
        // as "not subscribed" until the user interacts. Don't surface to
        // user; log only.
        console.warn("[NOTIFICATIONS] Subscription probe failed:", err);
      }
    };
    probe();
  }, []);

  /**
   * Internal: subscribe to push and store the subscription. Returns
   * the result so requestPermission can surface it to callers.
   *
   * Critical: returns 'subscribe_failed' if persistSubscription returns
   * false. The previous version returned 'granted_subscribed'
   * unconditionally, which caused the toggle to claim success even when
   * the DB upsert silently failed (RLS, no session, etc).
   */
  const subscribeToPush = useCallback(async (): Promise<RequestPermissionResult> => {
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapidKey) {
        console.log("[NOTIFICATIONS] No VAPID key configured — push disabled, polling only");
        return "granted_no_push";
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        // Already subscribed — make sure DB has the row (idempotent)
        const ok = await persistSubscription(existing);
        if (!ok) {
          console.error("[NOTIFICATIONS] Existing subscription found but DB persist failed");
          return "subscribe_failed";
        }
        setState((prev) => ({ ...prev, pushSubscribed: true }));
        return "granted_subscribed";
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const persisted = await persistSubscription(subscription);
      if (!persisted) {
        // pushManager.subscribe succeeded but DB persistence failed.
        // The browser now holds a subscription that the server doesn't
        // know about — push from notify won't reach the user. Surface
        // this as subscribe_failed so the UI can warn instead of
        // falsely reporting success.
        console.error("[NOTIFICATIONS] Browser subscribed but DB persistence failed — bailing out");
        return "subscribe_failed";
      }
      setState((prev) => ({ ...prev, pushSubscribed: true }));
      console.log("[NOTIFICATIONS] Push subscription stored");
      return "granted_subscribed";
    } catch (err) {
      console.error("[NOTIFICATIONS] Push subscription failed:", err);
      return "subscribe_failed";
    }
  }, []);

  /**
   * Public: request permission AND subscribe to push. Must be called
   * from a direct user gesture (tap/click) — otherwise the browser
   * silently rejects the requestPermission call.
   */
  const requestPermission = useCallback(async (): Promise<RequestPermissionResult> => {
    if (typeof Notification === "undefined") {
      return "unsupported";
    }

    let result: NotificationPermission;
    try {
      result = await Notification.requestPermission();
    } catch (err) {
      console.error("[NOTIFICATIONS] requestPermission threw:", err);
      return "denied";
    }

    setState((prev) => ({ ...prev, permission: result }));

    if (result === "granted") {
      return await subscribeToPush();
    }
    if (result === "denied") return "denied";
    return "default";
  }, [subscribeToPush]);

  /**
   * Public: unsubscribe from push and clear the DB row. Symmetric off
   * path. Browser permission itself stays granted — only the
   * subscription is removed.
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      // Browser-side unsubscribe
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const endpoint = existing.endpoint;
          await existing.unsubscribe();

          // DB-side cleanup — match by endpoint within the user's rows
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase
              .from("notification_subscriptions")
              .delete()
              .eq("user_id", session.user.id)
              .eq("endpoint", endpoint);
          }
        }
      }
      setState((prev) => ({ ...prev, pushSubscribed: false }));
      console.log("[NOTIFICATIONS] Unsubscribed from push");
      return true;
    } catch (err) {
      console.error("[NOTIFICATIONS] Unsubscribe failed:", err);
      // Even on failure, mark local state as unsubscribed — user
      // toggled OFF, so the UI should reflect that intent. The DB
      // row may linger and get cleaned up later via the 410-Gone
      // response when notify tries to send (notify v2 handles that
      // path: it deletes the row on 410).
      setState((prev) => ({ ...prev, pushSubscribed: false }));
      return false;
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
        .select("id, title:text_snapshot", { count: "exact" })
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

          // Log it. Audit-fix A6 (Apr 30 2026): previously this insert
          // had no error capture. If it failed, the daily-cap counter
          // (which queries notification_log) wouldn't see this notification,
          // so the user could end up receiving more than the 3/day cap
          // promised in the architecture. Now we log failures.
          const { error: logErr } = await supabase
            .from("notification_log")
            .insert({
              user_id: session.user.id,
              type: "decision_review",
              channel: "push",
              sent_at: new Date().toISOString(),
              delivered_at: new Date().toISOString(),
            });
          if (logErr) {
            console.error("[NOTIFICATIONS] notification_log insert failed:", logErr);
          }
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
    permission: state.permission,
    pushSubscribed: state.pushSubscribed,
    dueReviews: state.dueReviews,
    requestPermission,
    unsubscribe,
  };
}

/**
 * Persist a PushSubscription to the notification_subscriptions table.
 * Idempotent via upsert on (user_id, endpoint). Helper extracted so
 * subscribe and re-affirm flows share the same code path.
 *
 * Returns true on confirmed write, false on any failure (no session,
 * upsert error, RLS rejection). Callers MUST check the return value
 * — a silent void return previously caused B3.4b's first deploy to
 * report "subscribed" while leaving the DB empty.
 */
async function persistSubscription(subscription: PushSubscription): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("[NOTIFICATIONS] persistSubscription: no session (upsert skipped)");
    return false;
  }

  const subJson = subscription.toJSON();
  const { error, data } = await supabase
    .from("notification_subscriptions")
    .upsert({
      user_id: session.user.id,
      endpoint: subJson.endpoint!,
      p256dh: subJson.keys!.p256dh!,
      auth_key: subJson.keys!.auth!,
    }, { onConflict: "user_id,endpoint" })
    .select();

  if (error) {
    console.error("[NOTIFICATIONS] notification_subscriptions upsert failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }

  // .select() guarantees data is the inserted/updated rows. If RLS
  // silently dropped the row (PostgREST behaviour: 2xx returned but
  // no rows in response), data will be empty and we surface that
  // failure rather than report success.
  if (!data || data.length === 0) {
    console.error("[NOTIFICATIONS] notification_subscriptions upsert returned no rows — likely RLS blocked");
    return false;
  }

  console.log("[NOTIFICATIONS] notification_subscriptions row persisted, id=", data[0]?.id);
  return true;
}

/**
 * Convert a base64url-encoded VAPID public key to the Uint8Array
 * format expected by pushManager.subscribe's applicationServerKey.
 */
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
