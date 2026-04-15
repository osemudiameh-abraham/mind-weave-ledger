/**
 * Voice TTS Edge Function — OpenAI TTS
 *
 * Architecture v5.5, Section 4.7:
 *   OpenAI TTS provides premium, human-like voice output.
 *   Model: tts-1-hd (high quality) or tts-1 (low latency fallback)
 *   Voice: nova (default — warm, natural)
 *   Uses existing OPENAI_API_KEY — no separate TTS key needed.
 *   Cost: ~$15 per 1M characters.
 *
 * SECURITY: Requires valid Supabase JWT. No unauthenticated access.
 * Failure chain: tts-1-hd → tts-1 → client falls back to browser speechSynthesis
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
    // ─── Validate user auth (SECURITY FIX) ───
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

    // ─── Validate OpenAI key ───
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { text } = await req.json();
    if (!text) {
      return new Response(
        JSON.stringify({ error: "No text provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ─── Enforce text length limit (cost protection) ───
    if (text.length > 4096) {
      return new Response(
        JSON.stringify({ error: "Text too long. Maximum 4096 characters." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Configuration from env vars or defaults per architecture spec
    const model = Deno.env.get("OPENAI_TTS_MODEL") || "tts-1-hd";
    const voice = Deno.env.get("OPENAI_TTS_VOICE") || "nova";

    // Try primary model first
    let audioData = await callOpenAITTS(openaiKey, text, model, voice);

    // If tts-1-hd fails, fall back to tts-1 (lower latency, slightly lower quality)
    if (!audioData && model === "tts-1-hd") {
      console.warn("[TTS] tts-1-hd failed, falling back to tts-1");
      audioData = await callOpenAITTS(openaiKey, text, "tts-1", voice);
    }

    if (!audioData) {
      return new Response(
        JSON.stringify({ error: "TTS generation failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[TTS] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function callOpenAITTS(
  apiKey: string,
  text: string,
  model: string,
  voice: string
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice,
        input: text.slice(0, 4096),
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TTS] OpenAI ${model} error: ${response.status}`, errorText);
      return null;
    }

    return await response.arrayBuffer();
  } catch (err) {
    console.error(`[TTS] OpenAI ${model} request failed:`, err);
    return null;
  }
}
