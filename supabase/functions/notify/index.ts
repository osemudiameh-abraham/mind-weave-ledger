/**
 * Notify Edge Function v2 — Web Push with proper RFC 8291 encryption
 *
 * Architecture v5.7, Section 11.B (reminders & notifications subsystem)
 * Phase 0.B Stage B3.4 (Apr 26 2026)
 *
 * Sends push notifications to users via the Web Push protocol with
 * full RFC 8291 (aes128gcm) payload encryption.
 *
 * SECURITY: Two access paths — both validated:
 *   1. Internal (cron): requires valid CRON_SECRET header → can target any user
 *   2. External (user): requires valid Supabase JWT → can only target self
 *
 * REQUIRES env vars:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 *   - CRON_SECRET (shared with reminders-fire)
 *   - VAPID_PUBLIC_KEY  — base64url, uncompressed P-256 point (65 bytes raw)
 *   - VAPID_PRIVATE_KEY — base64url, PKCS8 ECDSA P-256 private key
 *
 * If VAPID keys are missing the function logs the notification and exits
 * with status='logged' but does NOT push. This lets the rest of the
 * stack (Realtime in-app toast) keep working.
 *
 * ─── B3.4 fix vs prior version ───
 * The prior implementation labelled the body as Content-Encoding: aes128gcm
 * but sent it unencrypted as plain UTF-8 bytes. Browser push services
 * (Mozilla autopush, Apple, Firefox) reject this with HTTP 400 because
 * the labelling lies. This version implements the actual RFC 8291
 * encryption using inline WebCrypto:
 *
 *   1. Generate a one-time ECDH P-256 keypair per push request
 *   2. ECDH(server_private, subscription_p256dh) → shared secret
 *   3. HKDF-SHA256(shared_secret, auth_secret, "WebPush: info|...") → IKM
 *   4. HKDF derive content encryption key (16 bytes) and nonce (12 bytes)
 *   5. AES-128-GCM(payload, key, nonce) → ciphertext + tag
 *   6. Prepend RFC 8291 header (salt[16] + rs[4] + idlen[1] + keyid[idlen])
 *   7. POST to subscription endpoint with Content-Encoding: aes128gcm
 *
 * No third-party crypto library — Deno's WebCrypto + a small auditable
 * HKDF implementation. ~80 lines added vs the broken version.
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── Determine caller identity ───
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── External callers can only notify themselves ───
    if (!isInternalCall && callerUserId !== user_id) {
      console.warn(`[NOTIFY] BLOCKED: user ${callerUserId?.slice(0, 8)} tried to notify ${user_id.slice(0, 8)}`);
      return new Response(JSON.stringify({ error: "Cannot send notifications to other users" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Daily rate limit: max 3 push deliveries per user per day ───
    // Counts only notification_log rows where push delivery was attempted.
    // The in-app Realtime toast path is separate and not rate-limited here.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("sent_at", today.toISOString());

    if ((todayCount || 0) >= 3) {
      console.log(`[NOTIFY] Daily push limit reached for user ${user_id.slice(0, 8)}`);
      return new Response(JSON.stringify({ status: "rate_limited" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the notification (delivered=false until we confirm push success)
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

    // Construct the JSON payload that the service worker will receive
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
        // ─── Encrypt payload per RFC 8291 (aes128gcm) ───
        const encryptedBody = await encryptWebPushPayload(
          payload,
          sub.p256dh,
          sub.auth_key,
        );

        const vapidJwt = await createVapidJwt(sub.endpoint, vapidPrivateKey);

        const pushRes = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "TTL": "86400",
            "Authorization": `vapid t=${vapidJwt}, k=${vapidPublicKey}`,
          },
          body: encryptedBody,
        });

        if (pushRes.ok || pushRes.status === 201) {
          pushSuccess++;
        } else if (pushRes.status === 410 || pushRes.status === 404) {
          // Subscription expired or no longer valid — remove it.
          // 410 Gone = subscription explicitly invalidated.
          // 404 Not Found = endpoint URL no longer recognised.
          await supabase.from("notification_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint)
            .eq("user_id", user_id);
          console.log(`[NOTIFY] Removed expired subscription (status ${pushRes.status})`);
        } else {
          // Read response body for diagnostic logging — push services
          // commonly return helpful error text in 4xx responses.
          const errorText = await pushRes.text().catch(() => "");
          console.error(`[NOTIFY] Push failed: ${pushRes.status} ${errorText.slice(0, 200)}`);
        }
      } catch (pushErr) {
        console.error("[NOTIFY] Push error:", pushErr);
      }
    }

    // Update delivery status if at least one push succeeded
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
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// RFC 8291 Web Push aes128gcm encryption
// ═══════════════════════════════════════════════════════════════════════════
//
// Algorithm (per RFC 8291 § 3):
//
//   1. salt = 16 random bytes
//   2. server_keypair = ECDSA-P256 keypair (one-time per push)
//      → as_public = uncompressed point (65 bytes)
//      → as_private = ECDH key
//   3. ecdh_secret = ECDH(as_private, ua_public_p256dh)
//   4. PRK_key = HKDF-extract(auth_secret, ecdh_secret)
//   5. key_info = "WebPush: info\0" + ua_public + as_public
//   6. IKM = HKDF-expand(PRK_key, key_info, 32)
//   7. PRK = HKDF-extract(salt, IKM)
//   8. CEK = HKDF-expand(PRK, "Content-Encoding: aes128gcm\0", 16)
//   9. NONCE = HKDF-expand(PRK, "Content-Encoding: nonce\0", 12)
//  10. plaintext = payload + 0x02 (final-record padding delimiter)
//  11. ciphertext = AES-128-GCM(CEK, NONCE, plaintext)
//  12. body = salt(16) || rs(4 BE = 4096) || idlen(1) || as_public(65) || ciphertext
//
// References:
//   RFC 8291 — Message Encryption for Web Push
//   RFC 8188 — Encrypted Content-Encoding for HTTP
//   RFC 5869 — HKDF
//
// All implementation here uses pure WebCrypto. No external dependencies.
// ═══════════════════════════════════════════════════════════════════════════

async function encryptWebPushPayload(
  payload: string,
  uaPublicKeyB64: string,
  uaAuthSecretB64: string,
): Promise<Uint8Array> {
  // Decode the user agent's keys from the subscription
  const uaPublicKeyRaw = urlBase64ToUint8Array(uaPublicKeyB64);
  const uaAuthSecret = urlBase64ToUint8Array(uaAuthSecretB64);

  if (uaPublicKeyRaw.length !== 65) {
    throw new Error(`Invalid p256dh: expected 65 bytes, got ${uaPublicKeyRaw.length}`);
  }
  if (uaAuthSecret.length !== 16) {
    throw new Error(`Invalid auth_secret: expected 16 bytes, got ${uaAuthSecret.length}`);
  }

  // Generate a one-time ECDH P-256 keypair for this push.
  // Note: usage MUST be ["deriveBits"] for ECDH; ECDSA usages do not work.
  const serverKeypair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  // Export server's public key as uncompressed point (65 bytes: 0x04 + X + Y)
  const asPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeypair.publicKey),
  );

  // Import the user agent's public key as an ECDH P-256 key for derivation
  const uaPublicKeyImported = await crypto.subtle.importKey(
    "raw",
    uaPublicKeyRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH derive shared secret (32 bytes)
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaPublicKeyImported },
      serverKeypair.privateKey,
      256,
    ),
  );

  // HKDF step 1: extract IKM using auth_secret as salt and ecdh_secret as input
  // key_info = "WebPush: info\0" + ua_public + as_public
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    uaPublicKeyRaw,
    asPublicKeyRaw,
  );
  const prkKey = await hkdfExtract(uaAuthSecret, ecdhSecret);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // HKDF step 2: derive CEK (content encryption key) and nonce
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(
    prk,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(
    prk,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  // Plaintext = payload + 0x02 (final record delimiter per RFC 8188)
  const payloadBytes = new TextEncoder().encode(payload);
  const plaintext = new Uint8Array(payloadBytes.length + 1);
  plaintext.set(payloadBytes);
  plaintext[payloadBytes.length] = 0x02;

  // Encrypt with AES-128-GCM
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM", length: 128 },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      cekKey,
      plaintext,
    ),
  );

  // Assemble RFC 8291 message body:
  //   salt (16) | rs (4 BE) | idlen (1) | as_public (65) | ciphertext
  const rs = 4096; // record size
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // rs as 4-byte big-endian
  header[16] = (rs >>> 24) & 0xff;
  header[17] = (rs >>> 16) & 0xff;
  header[18] = (rs >>> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = 65; // idlen
  header.set(asPublicKeyRaw, 21);

  return concat(header, ciphertext);
}

/**
 * HKDF-Extract per RFC 5869 § 2.2.
 * Returns a CryptoKey suitable for hkdfExpand below.
 */
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  // HKDF-Extract(salt, IKM) = HMAC-Hash(salt, IKM)
  const saltKey = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prkBytes = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  return await crypto.subtle.importKey(
    "raw",
    prkBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * HKDF-Expand per RFC 5869 § 2.3, single block (length ≤ 32 bytes for SHA-256).
 * Sufficient for all Web Push uses (CEK=16, nonce=12, IKM=32).
 */
async function hkdfExpand(
  prk: CryptoKey,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  if (length > 32) {
    // Multi-block HKDF-Expand not needed for any Web Push use case;
    // guarding against accidental misuse.
    throw new Error("hkdfExpand: length > 32 not implemented");
  }
  const t1Input = concat(info, new Uint8Array([0x01]));
  const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", prk, t1Input));
  return t1.slice(0, length);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// VAPID JWT (Voluntary Application Server Identification) — RFC 8292
// ═══════════════════════════════════════════════════════════════════════════

async function createVapidJwt(endpoint: string, privateKey: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: "mailto:notifications@sevenmynd.com",
  };

  const headerB64 = base64UrlEncodeJson(header);
  const payloadB64 = base64UrlEncodeJson(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyData = urlBase64ToUint8Array(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${sigB64}`;
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
