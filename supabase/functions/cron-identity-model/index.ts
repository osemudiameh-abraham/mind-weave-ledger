/**
 * Identity Model Cron -- Architecture v5.7, Section 3.7 + Section 10.10.8
 *
 * Schedule: weekly (Sunday 06:30 UTC, runs after pattern detection)
 * Protected by CRON_SECRET header.
 *
 * Builds/updates the identity_model table for each user with sufficient
 * interaction. Analyses: communication style, decision-making tendencies,
 * core values, emotional patterns, relationship priorities.
 *
 * v5.7 ADDITION (2026-05-03 RDD E1): aggregates feedback_signals from the
 * past 7 days into per-dimension positive-rate lift values. These observed
 * signals are passed to the GPT-4o identity prompt as an "OBSERVED SIGNAL"
 * section so communication_style fields have measurement backing rather
 * than pure inference. Drift-protection (Section 3.9): any field that
 * shifts more than 0.15 since last week is clamped to last_value +/- 0.15.
 *
 * RDD instrumentation: this is the aggregation step for hypothesis H1
 * (communication-style convergence within 6 weeks).
 *
 * Output stored as structured JSON in identity_model table.
 * Used in every context assembly to ground LLM responses in who the user
 * actually is.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Drift-protection clamp per Architecture v5.7 Section 3.9.
// Any communication_style field that shifts more than this magnitude since
// the prior week is clamped. Applied AFTER GPT-4o emits the new model so the
// raw inference remains visible in logs while the upserted value is bounded.
const MAX_FIELD_DRIFT_PER_WEEK = 0.15;

// Numeric encoding of categorical communication_style fields. Used for drift
// computation only -- the upserted shape stays categorical (string) for the
// chat function's prompt-rendering path.
const STYLE_FIELD_NUMERIC_MAP: Record<string, Record<string, number>> = {
  formality: { casual: 0, moderate: 0.5, formal: 1 },
  verbosity: { concise: 0, moderate: 0.5, verbose: 1 },
  emotional_expression: { reserved: 0, moderate: 0.5, expressive: 1 },
  preferred_tone: { direct: 0, balanced: 0.5, diplomatic: 1 },
};

// Inverse map: number -> nearest categorical for the four style fields.
function numericToCategorical(field: string, value: number): string {
  const map = STYLE_FIELD_NUMERIC_MAP[field];
  if (!map) return "moderate";
  let bestKey = "moderate";
  let bestDelta = Infinity;
  for (const [key, num] of Object.entries(map)) {
    const delta = Math.abs(num - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestKey = key;
    }
  }
  return bestKey;
}

interface FeedbackSignalRow {
  signal: "positive" | "negative";
  surface: string;
  response_metadata: Record<string, unknown> | null;
}

interface AggregatedSignal {
  total: number;
  positive: number;
  negative: number;
  positive_rate: number;
  // Per-dimension lifts: ratio of positive_rate(dim=true) to positive_rate(dim=false).
  // null when one side has no samples (insufficient data).
  long_response_lift: number | null;
  pushback_lift: number | null;
  research_grounded_lift: number | null;
  pattern_warning_lift: number | null;
  emoji_lift: number | null;
}

/**
 * Aggregate feedback_signals from the past 7 days for one user. RDD E1.
 *
 * Lift = positive_rate(dim=true) / positive_rate(dim=false). > 1 means the
 * dimension correlates with positive feedback; < 1 means negative. null if
 * one side has fewer than 3 samples (not enough data to draw a signal).
 */
function aggregateFeedbackSignals(rows: FeedbackSignalRow[]): AggregatedSignal {
  const total = rows.length;
  let positive = 0;
  let negative = 0;
  for (const r of rows) {
    if (r.signal === "positive") positive++;
    else if (r.signal === "negative") negative++;
  }
  const positive_rate = total > 0 ? positive / total : 0;

  function liftForDimension(predicate: (r: FeedbackSignalRow) => boolean): number | null {
    const positiveSet = rows.filter(predicate);
    const negativeSet = rows.filter((r) => !predicate(r));
    if (positiveSet.length < 3 || negativeSet.length < 3) return null;
    const posRatePos = positiveSet.filter((r) => r.signal === "positive").length / positiveSet.length;
    const posRateNeg = negativeSet.filter((r) => r.signal === "positive").length / negativeSet.length;
    if (posRateNeg === 0) return posRatePos > 0 ? 999 : 1; // sentinel for divide-by-zero
    return posRatePos / posRateNeg;
  }

  return {
    total,
    positive,
    negative,
    positive_rate,
    long_response_lift: liftForDimension((r) => {
      const len = (r.response_metadata?.length_chars as number | undefined) ?? 0;
      return len > 800;
    }),
    pushback_lift: liftForDimension((r) => Boolean(r.response_metadata?.used_pushback)),
    research_grounded_lift: liftForDimension((r) => Boolean(r.response_metadata?.was_research_grounded)),
    pattern_warning_lift: liftForDimension((r) => Boolean(r.response_metadata?.was_pattern_warning)),
    emoji_lift: liftForDimension((r) => Boolean(r.response_metadata?.used_emoji)),
  };
}

/**
 * Format aggregated signals as a prompt section for GPT-4o. Empty string when
 * there's no signal volume worth surfacing (< 5 total signals).
 */
function formatSignalsForPrompt(agg: AggregatedSignal): string {
  if (agg.total < 5) return "";

  const lines: string[] = [];
  lines.push("");
  lines.push("OBSERVED SIGNAL FROM THIS WEEK (use this to ground communication_style fields):");
  lines.push(`- Total feedback events: ${agg.total} (${agg.positive} positive, ${agg.negative} negative; ${(agg.positive_rate * 100).toFixed(0)}% positive rate overall)`);

  function describeLift(name: string, value: number | null): string | null {
    if (value === null) return null;
    if (value > 1.3) return `- ${name}: STRONG POSITIVE LIFT (x${value.toFixed(2)}). User clearly prefers this.`;
    if (value > 1.1) return `- ${name}: positive lift (x${value.toFixed(2)}).`;
    if (value < 0.7) return `- ${name}: STRONG NEGATIVE LIFT (x${value.toFixed(2)}). User clearly dislikes this.`;
    if (value < 0.9) return `- ${name}: negative lift (x${value.toFixed(2)}).`;
    return `- ${name}: neutral (x${value.toFixed(2)}).`;
  }

  const dimLines = [
    describeLift("Long responses (>800 chars)", agg.long_response_lift),
    describeLift("Pushback / disagreement", agg.pushback_lift),
    describeLift("Research-grounded responses", agg.research_grounded_lift),
    describeLift("Pattern warnings surfaced", agg.pattern_warning_lift),
    describeLift("Emoji usage", agg.emoji_lift),
  ].filter((x): x is string => x !== null);

  if (dimLines.length > 0) {
    lines.push(...dimLines);
  } else {
    lines.push("- (Insufficient per-dimension volume for reliable lift signal -- at least 3 samples per side required.)");
  }

  return lines.join("\n");
}

/**
 * Drift-protection clamp per Section 3.9. Returns the clamped style object.
 * Categorical fields are clamped via numeric encoding then mapped back.
 */
function clampDrift(
  newStyle: Record<string, string>,
  priorStyle: Record<string, string> | null,
): Record<string, string> {
  if (!priorStyle) return newStyle; // no prior -- no clamping
  const clamped: Record<string, string> = { ...newStyle };
  for (const [field, priorVal] of Object.entries(priorStyle)) {
    const newVal = newStyle[field];
    if (!newVal || typeof newVal !== "string" || typeof priorVal !== "string") continue;
    const map = STYLE_FIELD_NUMERIC_MAP[field];
    if (!map) continue; // non-numeric field (e.g. "summary") -- not clamped
    const newNum = map[newVal];
    const priorNum = map[priorVal];
    if (newNum === undefined || priorNum === undefined) continue;
    const delta = newNum - priorNum;
    if (Math.abs(delta) > MAX_FIELD_DRIFT_PER_WEEK) {
      const clampedNum = priorNum + Math.sign(delta) * MAX_FIELD_DRIFT_PER_WEEK;
      const clampedCat = numericToCategorical(field, clampedNum);
      console.log(`[IDENTITY_CRON] Drift-clamp: ${field} ${priorVal}->${newVal} clamped to ${clampedCat} (delta ${delta.toFixed(2)})`);
      clamped[field] = clampedCat;
    }
  }
  return clamped;
}

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("[CRON] SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase: SupabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
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
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const { userId, messageCount } of qualifiedUsers) {
      try {
        // Fetch user data for identity analysis. Added: feedback_signals last 7d
        // for RDD E1 aggregation; prior identity_model for drift-clamp baseline.
        const [
          messagesRes,
          factsRes,
          decisionsRes,
          patternsRes,
          profileRes,
          feedbackRes,
          priorIdentityRes,
        ] = await Promise.all([
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
          supabase.from("feedback_signals")
            .select("signal, surface, response_metadata")
            .eq("user_id", userId)
            .gte("created_at", oneWeekAgo),
          supabase.from("identity_model")
            .select("communication_style")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const messages = messagesRes.data || [];
        const facts = factsRes.data || [];
        const decisions = decisionsRes.data || [];
        const patterns = patternsRes.data || [];
        const profile = profileRes.data;
        const feedbackRows = (feedbackRes.data || []) as FeedbackSignalRow[];
        const priorCommunicationStyle =
          (priorIdentityRes.data?.communication_style as Record<string, string> | undefined) ?? null;

        // Build feedback aggregation (RDD E1)
        const feedbackAgg = aggregateFeedbackSignals(feedbackRows);
        const observedSignalBlock = formatSignalsForPrompt(feedbackAgg);

        // Build analysis input -- user messages only (privacy: no user_id sent)
        const userMessageContents = messages
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

Return ONLY valid JSON, no markdown.

When OBSERVED SIGNAL is provided, weight communication_style fields toward what the user has actually rewarded with positive feedback this week. Strong positive lift on long responses means verbosity should lean "verbose"; strong positive lift on pushback means preferred_tone leans "direct". Treat verbal/inferred preferences and observed signal as two evidence streams; let observed signal dominate when it disagrees with inference (the user's behaviour is more reliable than what they say they want).`,
              },
              {
                role: "user",
                content: `USER MESSAGES (sample of recent messages):\n${userMessageContents}\n\nKNOWN FACTS:\n${factSummary || "None"}\n\nDECISION HISTORY:\n${decisionSummary || "None"}\n\nBEHAVIOUR PATTERNS:\n${patternSummary || "None"}\n\nPROFILE:\n${profile ? `Name: ${profile.self_name}, Role: ${profile.self_role}, Company: ${profile.self_company}, Goals: ${profile.goals?.join(", ")}` : "Not set"}${observedSignalBlock}`,
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

        // Apply drift-protection clamp on communication_style (RDD H1 stability).
        const rawCommStyle = identityData.communication_style || {};
        const clampedCommStyle = clampDrift(rawCommStyle, priorCommunicationStyle);

        // Upsert identity model. communication_style is the clamped value;
        // signals_aggregated stores the weekly aggregation for audit + RDD analysis.
        const { error: upsertErr } = await supabase.from("identity_model").upsert({
          user_id: userId,
          personality_dimensions: identityData.personality_dimensions || {},
          core_values: identityData.core_values || [],
          decision_tendencies: identityData.decision_tendencies || {},
          communication_style: clampedCommStyle,
          strengths: identityData.strengths || [],
          blind_spots: identityData.blind_spots || [],
          built_from_message_count: messageCount,
          last_updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        if (upsertErr) {
          console.error(`[IDENTITY_CRON] Upsert failed for user ${userId.slice(0, 8)}:`, upsertErr.message);
        } else {
          usersProcessed++;
          console.log(`[IDENTITY_CRON] Updated identity model for user ${userId.slice(0, 8)} (${messageCount} messages, ${feedbackAgg.total} feedback signals)`);
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
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
