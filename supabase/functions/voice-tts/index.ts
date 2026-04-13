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
 * Failure chain: tts-1-hd → tts-1 → client falls back to browser speechSynthesis
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Configuration from env vars or defaults per architecture spec
    const model =
      Deno.env.get("OPENAI_TTS_MODEL") || "tts-1-hd";
    const voice = Deno.env.get("OPENAI_TTS_VOICE") || "nova";

    // Try primary model first
    let audioData = await callOpenAITTS(
      openaiKey,
      text,
      model,
      voice
    );

    // If tts-1-hd fails, fall back to tts-1 (lower latency, slightly lower quality)
    if (!audioData && model === "tts-1-hd") {
      console.warn("[TTS] tts-1-hd failed, falling back to tts-1");
      audioData = await callOpenAITTS(openaiKey, text, "tts-1", voice);
    }

    if (!audioData) {
      // Both models failed — client will fall back to browser speechSynthesis
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        input: text.slice(0, 4096), // OpenAI TTS limit
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[TTS] OpenAI ${model} error: ${response.status}`,
        errorText
      );
      return null;
    }

    return await response.arrayBuffer();
  } catch (err) {
    console.error(`[TTS] OpenAI ${model} request failed:`, err);
    return null;
  }
}
