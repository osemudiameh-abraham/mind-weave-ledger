/**
 * Research Test Edge Function — Phase 0.2 pre-flight check
 *
 * Purpose: Validate that GOOGLE_AI_KEY authenticates correctly against
 * Gemini 2.5 Flash with Google Search grounding enabled, before wiring
 * web grounding into the main chat path.
 *
 * Architecture v5.5 reference: Section 3.4 (Live Research & Web Grounding).
 *
 * Deviation approved: Architecture says "Gemini Flash" without version lock.
 * Using gemini-2.5-flash because Gemini 2.0 Flash shuts down 2026-06-01.
 * Secret name GOOGLE_AI_KEY matches existing vision/index.ts convention
 * (architecture doc Section 13.4 lists GOOGLE_AI_API_KEY — doc update to follow).
 *
 * Auth: Standard Supabase user auth required. This is not a public endpoint.
 * Usage: POST with no body. Returns validation result.
 *
 * On success: { ok: true, answer, grounding_sources_count, grounding_sources, latency_ms, model }
 * On failure: { ok: false, error, status, latency_ms, model }
 *
 * This function is intended to be removed or kept as a diagnostic after
 * Phase 0.2 ships. It never touches user data, never writes to the database,
 * and only sends a fixed probe query to Gemini.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://sevenmynd.com",
  "https://www.sevenmynd.com",
  "https://mind-weave-ledger.lovable.app",
];

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const PROBE_QUERY = "What is today's date and one notable news headline from today? Respond in one sentence.";
const TIMEOUT_MS = 10000;

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app")) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: GroundingChunk[];
    };
  }>;
  error?: { code?: number; message?: string; status?: string };
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const started = Date.now();

  // Auth — require a valid Supabase user session. No anonymous probing.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: "No auth header", status: 401, latency_ms: Date.now() - started, model: GEMINI_MODEL }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized", status: 401, latency_ms: Date.now() - started, model: GEMINI_MODEL }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[RESEARCH_TEST] user=${user.id.slice(0, 8)}`);
  } catch (authErr) {
    console.error("[RESEARCH_TEST] Auth check failed:", authErr);
    return new Response(
      JSON.stringify({ ok: false, error: "Auth check failed", status: 401, latency_ms: Date.now() - started, model: GEMINI_MODEL }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("GOOGLE_AI_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "GOOGLE_AI_KEY is not set in Supabase Edge Function secrets",
        status: 503,
        latency_ms: Date.now() - started,
        model: GEMINI_MODEL,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Key shape sanity check. Do not reject on prefix — Google issues keys in
  // multiple formats (historically AIza..., currently AQ.A...). Only reject
  // on empty or on obvious whitespace corruption.
  if (apiKey.length < 20 || apiKey.length > 200 || /\s/.test(apiKey)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `GOOGLE_AI_KEY is set but looks malformed (length=${apiKey.length}, has_whitespace=${/\s/.test(apiKey)})`,
        status: 400,
        latency_ms: Date.now() - started,
        model: GEMINI_MODEL,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Call Gemini 2.5 Flash with Google Search grounding enabled.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROBE_QUERY }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 256,
        },
      }),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    const isAbort = (fetchErr as Error)?.name === "AbortError";
    console.error("[RESEARCH_TEST] Fetch failed:", fetchErr);
    return new Response(
      JSON.stringify({
        ok: false,
        error: isAbort ? `Gemini request timed out after ${TIMEOUT_MS}ms` : `Network error: ${(fetchErr as Error).message}`,
        status: isAbort ? 504 : 502,
        latency_ms: Date.now() - started,
        model: GEMINI_MODEL,
      }),
      { status: isAbort ? 504 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  clearTimeout(timeoutId);

  const latency_ms = Date.now() - started;

  let body: GeminiResponse;
  try {
    body = await response.json();
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Gemini returned non-JSON response (HTTP ${response.status})`,
        status: response.status,
        latency_ms,
        model: GEMINI_MODEL,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!response.ok || body.error) {
    const errMsg = body.error?.message || `HTTP ${response.status}`;
    const errStatus = body.error?.code || response.status;
    console.error("[RESEARCH_TEST] Gemini error:", errStatus, errMsg);
    return new Response(
      JSON.stringify({
        ok: false,
        error: errMsg,
        status: errStatus,
        latency_ms,
        model: GEMINI_MODEL,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const candidate = body.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources = chunks
    .map((c) => ({
      title: c.web?.title || "",
      uri: c.web?.uri || "",
    }))
    .filter((s) => s.uri);
  const searchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

  console.log(`[RESEARCH_TEST] success latency=${latency_ms}ms sources=${sources.length} answer_len=${answer.length}`);

  return new Response(
    JSON.stringify({
      ok: true,
      model: GEMINI_MODEL,
      latency_ms,
      answer,
      grounding_sources_count: sources.length,
      grounding_sources: sources,
      search_queries_used: searchQueries,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
