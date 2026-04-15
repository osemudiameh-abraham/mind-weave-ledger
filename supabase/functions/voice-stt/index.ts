/**
 * Voice STT Token Endpoint — SECURITY FIXED
 *
 * Architecture v5.5, Section 4.6:
 *   Generates a SHORT-LIVED scoped Deepgram API key (60s TTL)
 *   so the raw DEEPGRAM_API_KEY never reaches the browser.
 *
 * Flow:
 *   1. Validate user auth via Supabase JWT
 *   2. Fetch Deepgram project_id
 *   3. Create temporary key with 60s TTL and usage:write scope
 *   4. Return temporary key + WebSocket URL to client
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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

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

    // ─── Get Deepgram API key (NEVER sent to client) ───
    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramKey) {
      return new Response(
        JSON.stringify({ error: "DEEPGRAM_API_KEY not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Get Deepgram project ID ───
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

    // ─── Create short-lived scoped key (60s TTL) ───
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

    // ─── Build Deepgram WebSocket URL ───
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

    console.log(`[voice-stt] Temp key issued for user ${user.id.slice(0, 8)} (60s TTL)`);

    // Return TEMPORARY key only — raw DEEPGRAM_API_KEY never leaves the server
    return new Response(
      JSON.stringify({ url: dgUrl, key: tempKey }),
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
