/**
 * Voice STT Token Endpoint
 *
 * Architecture v5.5, Section 4.6:
 *   Returns a validated Deepgram API key and WebSocket URL for the client
 *   to connect directly to Deepgram using subprotocol auth.
 *
 * The Deepgram JS SDK uses `new WebSocket(url, ['token', apiKey])` for
 * browser connections. This Edge Function validates auth and returns the
 * key + URL for the client to use the same approach.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── Validate user auth ───
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

    // ─── Get Deepgram API key ───
    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramKey) {
      return new Response(
        JSON.stringify({ error: "DEEPGRAM_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Validate the key against Deepgram REST API ───
    let keyValid = false;
    let keyError = "";
    try {
      const testResp = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${deepgramKey}` },
      });
      keyValid = testResp.ok;
      if (!keyValid) {
        const body = await testResp.text();
        keyError = `Deepgram returned ${testResp.status}: ${body.slice(0, 200)}`;
        console.error(`[voice-stt] Deepgram key validation failed: ${keyError}`);
      }
    } catch (e) {
      keyError = `Deepgram validation request failed: ${e.message}`;
      console.error(`[voice-stt] ${keyError}`);
    }

    if (!keyValid) {
      return new Response(
        JSON.stringify({
          error: "Deepgram API key is invalid",
          detail: keyError,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Build Deepgram WebSocket URL (without key — auth via subprotocol) ───
    const dgParams = new URLSearchParams({
      model: "nova-2",
      language: "en",
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "1000",
      vad_events: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    });

    const dgUrl = `wss://api.deepgram.com/v1/listen?${dgParams.toString()}`;

    console.log(`[voice-stt] Token issued for user ${user.id.slice(0, 8)}… (key validated)`);

    // Return URL and key separately.
    // Client uses: new WebSocket(url, ['token', key])
    // This is the same approach as the Deepgram JS SDK for browsers.
    return new Response(
      JSON.stringify({ url: dgUrl, key: deepgramKey }),
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
