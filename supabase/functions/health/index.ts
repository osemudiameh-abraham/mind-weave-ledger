/**
 * Health Check Edge Function — Architecture v5.5, Section 19.13
 *
 * Returns 200 with system status.
 * Used by uptime monitoring (external ping every 60s).
 * Checks: database connectivity, OpenAI key configured, Deepgram key configured.
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

  const checks: Record<string, string> = {};

  // Database check
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { error } = await supabase.from("sections").select("id").limit(1);
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  // API keys configured
  checks.openai = Deno.env.get("OPENAI_API_KEY") ? "configured" : "missing";
  checks.deepgram = Deno.env.get("DEEPGRAM_API_KEY") ? "configured" : "missing";
  checks.vapid = Deno.env.get("VAPID_PUBLIC_KEY") ? "configured" : "missing";

  const allOk = checks.database === "ok" && checks.openai === "configured" && checks.deepgram === "configured";

  return new Response(
    JSON.stringify({
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: "5.5",
      checks,
    }),
    {
      status: allOk ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
