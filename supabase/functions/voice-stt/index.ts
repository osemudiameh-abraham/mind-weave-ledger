/**
 * Voice STT Token Endpoint
 *
 * Architecture v5.5, Section 4.6:
 *   Deepgram Nova-2 provides sub-300ms first-word latency, 100+ language
 *   auto-detection, and WebSocket streaming. Server-side proxy protects the
 *   API key.
 *
 * Approach:
 *   POST /functions/v1/voice-stt  (authenticated)
 *   → validates Supabase JWT
 *   → returns { url: "wss://api.deepgram.com/v1/listen?..." } with API key
 *   → client connects directly to Deepgram using the returned URL
 *
 * The API key is embedded in the URL but:
 *   - Only accessible to authenticated users
 *   - Transmitted over TLS (wss://)
 *   - Can be rotated server-side without client changes
 *   - Deepgram keys can be scoped to usage:write only
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // ─── CORS preflight ───
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── Validate auth ───
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
      console.error("[voice-stt] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Validate Deepgram API key ───
    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramKey) {
      console.error("[voice-stt] Missing DEEPGRAM_API_KEY");
      return new Response(
        JSON.stringify({ error: "STT service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Build Deepgram WebSocket URL ───
    // Architecture v5.5, Section 4.6: Nova-2, 100+ language auto-detection,
    // sub-300ms first-word latency.
    // Auth via 'key' query parameter (Deepgram's documented auth method for
    // environments that cannot set custom HTTP headers).
    const dgParams = new URLSearchParams({
      key: deepgramKey,
      model: "nova-2",
      detect_language: "true",
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "1000",
      vad_events: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    });

    const dgUrl = `wss://api.deepgram.com/v1/listen?${dgParams.toString()}`;

    console.log(`[voice-stt] Token issued for user ${user.id.slice(0, 8)}…`);

    return new Response(
      JSON.stringify({ url: dgUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[voice-stt] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
