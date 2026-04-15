/**
 * Vision Edge Function — Frame Analysis
 *
 * Architecture v5.5, Section 4.5:
 *   Receives base64 JPEG frames from camera or screen share.
 *   Analyses via GPT-4o vision (fallback for Gemini 2.0 Flash until GOOGLE_AI_KEY configured).
 *   Returns concise text analysis (1-2 sentences) for LLM context injection.
 *   Never stores frames permanently — processed and discarded.
 *
 * Cost: ~$0.002 per frame at GPT-4o vision pricing.
 * Response target: under 2 seconds per frame.
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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { frame, context } = await req.json();
    if (!frame) {
      return new Response(JSON.stringify({ error: "No frame" }), { status: 400, headers: corsHeaders });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "Vision not configured" }), { status: 503, headers: corsHeaders });
    }

    // ─── Analyse frame via GPT-4o vision ───
    const visionPrompt = `You are a visual assistant integrated into a live voice conversation. Analyse this image and provide relevant observations. Be concise — 1-2 sentences maximum. Focus on what is most relevant and actionable. If you see text, read the key parts. If you see a document, summarise the main point. If you see a screen, describe what the user is looking at. Do not describe obvious things. Only mention what adds value to the conversation.${context ? `\n\nConversation context: ${context}` : ""}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${frame}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[VISION] OpenAI error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Vision analysis failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "";

    console.log(`[VISION] User ${user.id.slice(0, 8)}: ${analysis.slice(0, 100)}`);

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[VISION] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
