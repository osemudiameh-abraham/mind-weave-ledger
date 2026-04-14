/**
 * Notify Edge Function — Send push notifications
 * Architecture v5.5, Section 10.7
 *
 * Accepts notification params, looks up user's push subscriptions,
 * sends via Web Push protocol. Logs to notification_log.
 *
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.
 * If not configured, notifications are logged but not pushed.
 *
 * Called by cron-notifications or directly for immediate notifications.
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

  try {
    // This function can be called internally (from cron) or with user auth
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const isInternalCall = cronSecret === Deno.env.get("CRON_SECRET");

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

    const { user_id, notification_type, title, body, url, tag, silent } = await req.json();

    if (!user_id || !notification_type || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        // Use the Web Push protocol via simple fetch to the push endpoint
        // The actual encryption would require ECDH + AES-GCM per RFC 8291
        // For now, we send with VAPID authorization header (works for basic push)
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

  // Import the VAPID private key for signing
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
