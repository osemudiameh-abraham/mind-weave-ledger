/**
 * Identity Model Cron — Architecture v5.5, Section 3.7
 *
 * Schedule: weekly (runs after pattern detection)
 * Protected by CRON_SECRET header.
 *
 * Builds/updates the identity_model table for each user with sufficient interaction.
 * Analyses: communication style, decision-making tendencies, core values,
 * emotional patterns, relationship priorities.
 *
 * Output stored as structured JSON in identity_model table.
 * Used in every context assembly to ground LLM responses in who the user actually is.
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

  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find users with 20+ messages (enough interaction to build identity)
    const { data: userMessages } = await supabase
      .from("messages")
      .select("user_id");

    if (!userMessages || userMessages.length === 0) {
      return new Response(JSON.stringify({ status: "ok", users_processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userCounts = new Map<string, number>();
    for (const row of userMessages) {
      userCounts.set(row.user_id, (userCounts.get(row.user_id) || 0) + 1);
    }
    const qualifiedUsers = [...userCounts.entries()]
      .filter(([, count]) => count >= 20)
      .map(([userId, count]) => ({ userId, messageCount: count }));

    console.log(`[IDENTITY_CRON] ${qualifiedUsers.length} users qualify (20+ messages)`);

    let usersProcessed = 0;

    for (const { userId, messageCount } of qualifiedUsers) {
      try {
        // Fetch user data for identity analysis
        const [messagesRes, factsRes, decisionsRes, patternsRes, profileRes] = await Promise.all([
          supabase.from("messages")
            .select("role, content, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase.from("memory_facts")
            .select("subject, attribute, value_text, category")
            .eq("user_id", userId)
            .eq("status", "active")
            .is("valid_until", null)
            .limit(50),
          supabase.from("decisions")
            .select("title, context_summary, status, outcome_count, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase.from("behaviour_patterns")
            .select("pattern_type, description, evidence_count, severity")
            .eq("user_id", userId)
            .eq("is_active", true),
          supabase.from("identity_profiles")
            .select("self_name, self_role, self_company, goals, focus_areas")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const messages = messagesRes.data || [];
        const facts = factsRes.data || [];
        const decisions = decisionsRes.data || [];
        const patterns = patternsRes.data || [];
        const profile = profileRes.data;

        // Build analysis input — user messages only (privacy: no user_id sent)
        const userMessages = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .slice(0, 50)
          .join("\n---\n");

        const factSummary = facts.map((f) => `${f.subject}: ${f.attribute} = ${f.value_text} (${f.category})`).join("\n");

        const decisionSummary = decisions.map((d) =>
          `"${d.title}" (${d.status}, outcomes: ${d.outcome_count})`
        ).join("\n");

        const patternSummary = patterns.map((p) =>
          `${p.pattern_type}: ${p.description} (severity: ${p.severity}, seen ${p.evidence_count} times)`
        ).join("\n");

        // Call GPT-4o for identity analysis
        const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are a personality and identity analysis engine. Analyse the user's communication patterns, decision history, stated values, and behaviour patterns to build a comprehensive identity model.

Return a JSON object with exactly these fields:
{
  "personality_dimensions": {
    "openness": "low|medium|high",
    "conscientiousness": "low|medium|high",
    "extraversion": "low|medium|high",
    "agreeableness": "low|medium|high",
    "neuroticism": "low|medium|high",
    "summary": "2-3 sentence personality summary"
  },
  "core_values": ["array of 3-5 core values detected from behaviour"],
  "decision_tendencies": {
    "speed": "impulsive|moderate|deliberate",
    "risk_tolerance": "risk_averse|moderate|risk_seeking",
    "social_influence": "independent|moderate|socially_influenced",
    "summary": "2-3 sentence summary of how they make decisions"
  },
  "communication_style": {
    "formality": "casual|moderate|formal",
    "verbosity": "concise|moderate|verbose",
    "emotional_expression": "reserved|moderate|expressive",
    "preferred_tone": "direct|balanced|diplomatic",
    "summary": "2-3 sentence summary of how they communicate"
  },
  "strengths": ["3-5 key strengths"],
  "blind_spots": ["2-3 potential blind spots or growth areas"]
}

Return ONLY valid JSON, no markdown.`,
              },
              {
                role: "user",
                content: `USER MESSAGES (sample of recent messages):\n${userMessages}\n\nKNOWN FACTS:\n${factSummary || "None"}\n\nDECISION HISTORY:\n${decisionSummary || "None"}\n\nBEHAVIOUR PATTERNS:\n${patternSummary || "None"}\n\nPROFILE:\n${profile ? `Name: ${profile.self_name}, Role: ${profile.self_role}, Company: ${profile.self_company}, Goals: ${profile.goals?.join(", ")}` : "Not set"}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (!analysisRes.ok) {
          console.error(`[IDENTITY_CRON] GPT-4o error for user ${userId.slice(0, 8)}: ${analysisRes.status}`);
          continue;
        }

        const analysisData = await analysisRes.json();
        const rawIdentity = analysisData.choices?.[0]?.message?.content || "{}";
        const cleanIdentity = rawIdentity.replace(/```json\n?|```/g, "").trim();

        let identityData: {
          personality_dimensions?: Record<string, string>;
          core_values?: string[];
          decision_tendencies?: Record<string, string>;
          communication_style?: Record<string, string>;
          strengths?: string[];
          blind_spots?: string[];
        };

        try {
          identityData = JSON.parse(cleanIdentity);
        } catch {
          console.error(`[IDENTITY_CRON] JSON parse failed for user ${userId.slice(0, 8)}`);
          continue;
        }

        // Upsert identity model
        const { error: upsertErr } = await supabase.from("identity_model").upsert({
          user_id: userId,
          personality_dimensions: identityData.personality_dimensions || {},
          core_values: identityData.core_values || [],
          decision_tendencies: identityData.decision_tendencies || {},
          communication_style: identityData.communication_style || {},
          strengths: identityData.strengths || [],
          blind_spots: identityData.blind_spots || [],
          built_from_message_count: messageCount,
          last_updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (upsertErr) {
          console.error(`[IDENTITY_CRON] Upsert failed for user ${userId.slice(0, 8)}:`, upsertErr.message);
        } else {
          usersProcessed++;
          console.log(`[IDENTITY_CRON] Updated identity model for user ${userId.slice(0, 8)} (${messageCount} messages)`);
        }

      } catch (userErr) {
        console.error(`[IDENTITY_CRON] Error processing user ${userId.slice(0, 8)}:`, userErr);
      }
    }

    console.log(`[IDENTITY_CRON] Complete. Users processed: ${usersProcessed}/${qualifiedUsers.length}`);

    return new Response(
      JSON.stringify({ status: "ok", users_processed: usersProcessed, total_qualified: qualifiedUsers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[IDENTITY_CRON] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
