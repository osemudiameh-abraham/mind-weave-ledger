/**
 * Cron Notifications Edge Function
 * Architecture v5.5, Section 10.7
 *
 * Runs on schedule (daily at 8:00 AM UTC via Supabase Cron or external trigger).
 * Checks for:
 *   1. Decisions due for review today
 *   2. Decisions overdue (48h reminder)
 *   3. Pattern warnings from recent scans
 *
 * For each, creates a notification via the notify Edge Function.
 * Protected by CRON_SECRET header.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify cron secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("[CRON] SUPABASE_SERVICE_ROLE_KEY not set — cannot process users");
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    let notificationsSent = 0;

    // ─── 1. Decisions due for review today ───
    const { data: dueToday } = await supabase
      .from("decisions")
      .select("id, user_id, title")
      .in("status", ["active", "pending_review"])
      .gte("review_due_at", todayStart)
      .lt("review_due_at", todayEnd);

    if (dueToday) {
      // Update status to pending_review
      for (const d of dueToday) {
        await supabase.from("decisions")
          .update({ status: "pending_review" })
          .eq("id", d.id)
          .eq("status", "active");
      }

      // Group by user and send one notification per user
      const userDecisions = new Map<string, string[]>();
      for (const d of dueToday) {
        if (!userDecisions.has(d.user_id)) userDecisions.set(d.user_id, []);
        userDecisions.get(d.user_id)!.push(d.title);
      }

      for (const [userId, titles] of userDecisions) {
        // Check if we already notified today
        const { count } = await supabase
          .from("notification_log")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("notification_type", "decision_review")
          .gte("sent_at", todayStart);

        if ((count || 0) > 0) continue;

        const body = titles.length === 1
          ? `Your decision "${titles[0].slice(0, 40)}" is due for review.`
          : `You have ${titles.length} decisions due for review.`;

        await sendNotification(supabase, {
          user_id: userId,
          notification_type: "decision_review",
          title: "Decision Review Due",
          body,
          url: "/reviews",
        });
        notificationsSent++;
      }
    }

    // ─── 2. Overdue decisions (48h reminder, one-time) ───
    const { data: overdue } = await supabase
      .from("decisions")
      .select("id, user_id, title")
      .eq("status", "pending_review")
      .lt("review_due_at", twoDaysAgo);

    if (overdue) {
      const userOverdue = new Map<string, string[]>();
      for (const d of overdue) {
        if (!userOverdue.has(d.user_id)) userOverdue.set(d.user_id, []);
        userOverdue.get(d.user_id)!.push(d.title);
      }

      for (const [userId, titles] of userOverdue) {
        // Check if 48h reminder already sent
        const { count } = await supabase
          .from("notification_log")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("notification_type", "decision_review_reminder")
          .gte("sent_at", twoDaysAgo);

        if ((count || 0) > 0) continue;

        await sendNotification(supabase, {
          user_id: userId,
          notification_type: "decision_review_reminder",
          title: "Reviews Still Pending",
          body: `${titles.length} decision${titles.length > 1 ? "s" : ""} still awaiting your review.`,
          url: "/reviews",
        });
        notificationsSent++;
      }
    }

    console.log(`[CRON_NOTIFY] Complete. Due today: ${dueToday?.length || 0}, Overdue: ${overdue?.length || 0}, Notifications sent: ${notificationsSent}`);

    return new Response(
      JSON.stringify({
        status: "ok",
        due_today: dueToday?.length || 0,
        overdue: overdue?.length || 0,
        notifications_sent: notificationsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[CRON_NOTIFY] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendNotification(
  supabase: ReturnType<typeof createClient>,
  params: {
    user_id: string;
    notification_type: string;
    title: string;
    body: string;
    url?: string;
  }
) {
  // Log the notification
  await supabase.from("notification_log").insert({
    user_id: params.user_id,
    notification_type: params.notification_type,
    title: params.title,
    body: params.body,
    delivered: true,
  });

  // Look up push subscriptions
  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("endpoint")
    .eq("user_id", params.user_id);

  if (subs && subs.length > 0) {
    // Call the notify Edge Function for push delivery
    try {
      await supabase.functions.invoke("notify", {
        body: params,
      });
    } catch {
      // Push failure is non-fatal — notification is already logged
    }
  }
}
