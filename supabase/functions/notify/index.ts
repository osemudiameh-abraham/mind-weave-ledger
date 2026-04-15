/**
 * Notify Edge Function — Send push notifications
 * Architecture v5.5, Section 10.7
 *
 * Accepts notification params, looks up user's push subscriptions,
 * sends via Web Push protocol. Logs to notification_log.
 *
 * SECURITY: Two access paths — both validated:
 *   1. Internal (cron): requires valid CRON_SECRET header → can target any user
 *   2. External (user): requires valid Supabase JWT → can only target self
 *
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.
 * If not configured, notifications are logged but not pushed.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://sevenmynd.com",
  "https://www.sevenmynd.com",
  "https://mind-weave-ledger.lovable.app",
];

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app")) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── Determine caller identity (SECURITY FIX) ───
    const cronSecret = req.headers.get("x-cron-secret");
    const isInternalCall = cronSecret !== null && cronSecret === Deno.env.get("CRON_SECRET");

    let callerUserId: string | null = null;

    if (!isInternalCall) {
      // External call — validate Supabase JWT to identify caller
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "No auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await authSupabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      callerUserId = user.id;
    }

    // ─── Service role client for cross-RLS operations ───
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("[NOTIFY] SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    const { user_id, notification_type, title, body, url, tag, silent } = await req.json();

    if (!user_id || !notification_type || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── SECURITY: External callers can only notify themselves ───
    if (!isInternalCall && callerUserId !== user_id) {
      console.warn(`[NOTIFY] BLOCKED: user ${callerUserId?.slice(0, 8)} tried to notify ${user_id.slice(0, 8)}`);
      return new Response(JSON.stringify({ error: "Cannot send notifications to other users" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily limit: max 3 per user per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("sent_at", today.toISOString());

    if ((todayCount || 0) >= 3) {
      console.log(`[NOTIFY] Daily limit reached for user ${user_id.slice(0, 8)}`);
      return new Response(JSON.stringify({ status: "rate_limited" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the notification
    await supabase.from("notification_log").insert({
      user_id,
      notification_type,
      title,
      body: body || "",
      delivered: false,
    });

    // Look up push subscriptions
    const { data: subscriptions } = await supabase
      .from("notification_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[NOTIFY] No push subscriptions for user ${user_id.slice(0, 8)} — notification logged only`);
      return new Response(JSON.stringify({ status: "logged", push: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check VAPID keys
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[NOTIFY] VAPID keys not configured — notification logged, push skipped");
      return new Response(JSON.stringify({ status: "logged", push: false, reason: "no_vapid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send push to each subscription
    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/home",
      tag: tag || `seven-${notification_type}-${Date.now()}`,
      silent: silent || false,
    });

    let pushSuccess = 0;
    for (const sub of subscriptions) {
      try {
        const vapidJwt = await createVapidJwt(sub.endpoint, vapidPublicKey, vapidPrivateKey);

        const pushRes = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "TTL": "86400",
            "Authorization": `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
          },
          body: new TextEncoder().encode(payload),
        });

        if (pushRes.ok || pushRes.status === 201) {
          pushSuccess++;
        } else if (pushRes.status === 410) {
          // Subscription expired — remove it
          await supabase.from("notification_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint)
            .eq("user_id", user_id);
          console.log("[NOTIFY] Removed expired subscription");
        } else {
          console.error(`[NOTIFY] Push failed: ${pushRes.status}`);
        }
      } catch (pushErr) {
        console.error("[NOTIFY] Push error:", pushErr);
      }
    }

    // Update delivery status
    if (pushSuccess > 0) {
      await supabase.from("notification_log")
        .update({ delivered: true })
        .eq("user_id", user_id)
        .eq("notification_type", notification_type)
        .order("sent_at", { ascending: false })
        .limit(1);
    }

    console.log(`[NOTIFY] Sent ${notification_type} to user ${user_id.slice(0, 8)}: ${pushSuccess}/${subscriptions.length} pushed`);

    return new Response(
      JSON.stringify({ status: "sent", pushed: pushSuccess, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[NOTIFY] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Create a VAPID JWT for push authorization.
 * Uses ES256 (ECDSA P-256 with SHA-256) signing.
 */
async function createVapidJwt(endpoint: string, publicKey: string, privateKey: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: "mailto:notifications@sevenmynd.com",
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyData = urlBase64ToUint8Array(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
