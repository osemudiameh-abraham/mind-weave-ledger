/**
 * Voice STT Token Endpoint -- with per-language model routing.
 *
 * Architecture v5.7:
 *   sec.4.6: Generates a SHORT-LIVED scoped Deepgram API key (60s TTL)
 *            so the raw DEEPGRAM_API_KEY never reaches the browser.
 *   sec.4.14.4 + sec.17.3.A.1: Voice STT honours the user's chosen voice
 *            language. The 10 picker languages are routed to the highest-
 *            accuracy Deepgram model that supports each one:
 *              en, es, fr, de, hi, it, ja, nl, pt -> nova-3 (monolingual)
 *              zh                                  -> nova-2 (nova-3 not yet
 *                                                            supporting zh)
 *   The language code is validated against an allowlist before use. User-
 *   controlled values are NEVER passed directly into Deepgram URL params --
 *   the validation function clamps to the allowlist and falls back to "en".
 *
 * Flow:
 *   1. Validate user auth via Supabase JWT
 *   2. Parse + validate language from request body (default "en")
 *   3. Fetch Deepgram project_id
 *   4. Create temporary key with 60s TTL and usage:write scope
 *   5. Pick Deepgram model based on language
 *   6. Return temporary key + WebSocket URL (with model + language params)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://sevenmynd.com",
  "https://www.sevenmynd.com",
  "https://mind-weave-ledger.lovable.app",
];

// Picker languages from src/lib/onboarding-triggers.ts SUPPORTED_VOICE_LANGUAGES.
// MUST match the picker exactly. Adding a language to the picker REQUIRES
// adding it here and assigning it to a model.
const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh", "hi"] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Per-language model routing. Nova-3 monolingual delivers the best accuracy
// for each of the supported European + Indian + Japanese languages. Nova-2
// stays as the fallback for Chinese (nova-3 does not yet support zh).
function modelForLanguage(lang: SupportedLanguage): string {
  if (lang === "zh") return "nova-2";
  return "nova-3";
}

function validateLanguage(input: unknown): SupportedLanguage {
  if (typeof input !== "string") return "en";
  const normalized = input.toLowerCase().trim();
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized as SupportedLanguage;
  }
  return "en";
}

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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Validate user auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No auth" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Parse + validate language from request body ---
    // Body may be missing entirely (older clients before this PR shipped).
    // In that case parsing returns null and validateLanguage falls back to "en".
    let requestedLanguage: unknown = null;
    try {
      const body = await req.json();
      requestedLanguage = body?.language;
    } catch {
      // No body or invalid JSON -- safe to treat as English fallback.
    }
    const language = validateLanguage(requestedLanguage);
    const model = modelForLanguage(language);

    // --- Get Deepgram API key (NEVER sent to client) ---
    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramKey) {
      return new Response(
        JSON.stringify({ error: "DEEPGRAM_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Get Deepgram project ID ---
    const projectsRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${deepgramKey}` },
    });

    if (!projectsRes.ok) {
      console.error(`[voice-stt] Deepgram projects API failed: ${projectsRes.status}`);
      return new Response(
        JSON.stringify({ error: "Deepgram API key is invalid" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectsData = await projectsRes.json();
    const projectId = projectsData.projects?.[0]?.project_id;

    if (!projectId) {
      console.error("[voice-stt] No Deepgram project found");
      return new Response(
        JSON.stringify({ error: "No Deepgram project found" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Create short-lived scoped key (60s TTL) ---
    const tempKeyRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: `temp_${user.id.slice(0, 8)}_${Date.now()}`,
          scopes: ["usage:write"],
          time_to_live_in_seconds: 60,
        }),
      }
    );

    if (!tempKeyRes.ok) {
      const errText = await tempKeyRes.text();
      console.error(`[voice-stt] Failed to create temp key: ${tempKeyRes.status} ${errText}`);
      return new Response(
        JSON.stringify({ error: "Failed to create temporary Deepgram key" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tempKeyData = await tempKeyRes.json();
    const tempKey = tempKeyData.key;

    if (!tempKey) {
      console.error("[voice-stt] Temp key response missing 'key' field:", JSON.stringify(tempKeyData));
      return new Response(
        JSON.stringify({ error: "Invalid temp key response from Deepgram" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Build Deepgram WebSocket URL with model + language from above ---
    // Both `model` and `language` are validated values from our allowlist --
    // never raw user input -- so URLSearchParams encoding is sufficient.
    const dgParams = new URLSearchParams({
      model,
      language,
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "1000",
      vad_events: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    });

    const dgUrl = `wss://api.deepgram.com/v1/listen?${dgParams.toString()}`;

    console.log(`[voice-stt] Temp key issued for user ${user.id.slice(0, 8)} model=${model} language=${language} (60s TTL)`);

    // Return TEMPORARY key only -- raw DEEPGRAM_API_KEY never leaves the server
    return new Response(
      JSON.stringify({ url: dgUrl, key: tempKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[voice-stt] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
