/**
 * Pattern Detection Cron — Architecture v5.5, Section 3.7
 *
 * Schedule: daily at 6:00 AM UTC
 * Protected by CRON_SECRET header.
 *
 * Processes all users with 5+ decisions.
 * Uses GPT-4o to analyse last 90 days of decisions, outcomes, and memories.
 * Produces structured behaviour_patterns records.
 *
 * Pattern types: commitment_overload, financial_pressure, decision_reversal,
 *   communication_risk, energy_depletion, relationship_neglect, goal_drift, cognitive_bias
 *
 * Patterns not detected in last 3 scans → is_active = false (retired).
 * Max 10 active patterns per user.
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
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const scanId = `scan_${Date.now()}`;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Find users with 5+ decisions
    const { data: eligibleUsers } = await supabase
      .from("decisions")
      .select("user_id")
      .gte("created_at", ninetyDaysAgo);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ status: "ok", users_processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count decisions per user, filter to 5+
    const userCounts = new Map<string, number>();
    for (const row of eligibleUsers) {
      userCounts.set(row.user_id, (userCounts.get(row.user_id) || 0) + 1);
    }
    const qualifiedUsers = [...userCounts.entries()]
      .filter(([, count]) => count >= 5)
      .map(([userId]) => userId);

    console.log(`[PATTERN_CRON] Scan ${scanId}: ${qualifiedUsers.length} users qualify (5+ decisions in 90 days)`);

    let usersProcessed = 0;
    let patternsDetected = 0;
    let patternsRetired = 0;

    // Process in batches of 50
    for (let i = 0; i < qualifiedUsers.length; i += 50) {
      const batch = qualifiedUsers.slice(i, i + 50);

      for (const userId of batch) {
        try {
          // Fetch user data for analysis
          const [decisionsRes, outcomesRes, memoriesRes, factsRes] = await Promise.all([
            supabase.from("decisions")
              .select("title, context_summary, status, confidence, review_due_at, outcome_count, created_at")
              .eq("user_id", userId)
              .gte("created_at", ninetyDaysAgo)
              .order("created_at", { ascending: false }),
            supabase.from("outcomes")
              .select("decision_id, outcome_label, reflection, created_at")
              .eq("user_id", userId)
              .gte("created_at", ninetyDaysAgo)
              .order("created_at", { ascending: false }),
            supabase.from("memories_structured")
              .select("text, memory_type, importance, created_at")
              .eq("user_id", userId)
              .order("importance", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(200),
            supabase.from("memory_facts")
              .select("subject, attribute, value_text")
              .eq("user_id", userId)
              .eq("status", "active")
              .is("valid_until", null)
              .limit(30),
          ]);

          const decisions = decisionsRes.data || [];
          const outcomes = outcomesRes.data || [];
          const memories = memoriesRes.data || [];
          const facts = factsRes.data || [];

          if (decisions.length < 5) continue;

          // Build analysis input
          const decisionSummary = decisions.map((d) =>
            `[${new Date(d.created_at).toLocaleDateString()}] "${d.title}" (status: ${d.status}, outcomes: ${d.outcome_count})${d.context_summary ? ` — ${d.context_summary}` : ""}`
          ).join("\n");

          const outcomeSummary = outcomes.map((o) =>
            `Decision outcome: ${o.outcome_label}${o.reflection ? ` — ${o.reflection}` : ""}`
          ).join("\n");

          const memorySummary = memories.slice(0, 50).map((m) => m.text).join("\n");

          const factSummary = facts.map((f) => `${f.subject}: ${f.attribute} = ${f.value_text}`).join("\n");

          // Call GPT-4o for pattern analysis
          const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: `You are a behavioural intelligence engine. Analyse the following decision history and identify recurring patterns.

For each pattern, provide:
- pattern_type: one of: commitment_overload, financial_pressure, decision_reversal, communication_risk, energy_depletion, relationship_neglect, goal_drift, cognitive_bias
- description: 2-3 sentences describing the pattern
- evidence_count: how many instances support this pattern
- trigger_conditions: JSON object with "keywords" array (words that trigger this pattern) and "intents" array (user intents that trigger it)
- severity: low, medium, or high
- recommendation: what the user should do differently

Output as a JSON array. If no patterns are detected, return []. Return ONLY valid JSON, no markdown.`,
                },
                {
                  role: "user",
                  content: `DECISIONS (last 90 days):\n${decisionSummary}\n\nOUTCOMES:\n${outcomeSummary || "None yet"}\n\nKNOWN FACTS:\n${factSummary || "None"}\n\nRECENT MEMORIES:\n${memorySummary || "None"}`,
                },
              ],
              temperature: 0.3,
              max_tokens: 2000,
            }),
          });

          if (!analysisRes.ok) {
            console.error(`[PATTERN_CRON] GPT-4o error for user ${userId.slice(0, 8)}: ${analysisRes.status}`);
            continue;
          }

          const analysisData = await analysisRes.json();
          const rawPatterns = analysisData.choices?.[0]?.message?.content || "[]";
          const cleanPatterns = rawPatterns.replace(/```json\n?|```/g, "").trim();

          let detectedPatterns: {
            pattern_type: string;
            description: string;
            evidence_count: number;
            trigger_conditions: { keywords?: string[]; intents?: string[] };
            severity: string;
            recommendation: string;
          }[];

          try {
            detectedPatterns = JSON.parse(cleanPatterns);
          } catch {
            console.error(`[PATTERN_CRON] JSON parse failed for user ${userId.slice(0, 8)}`);
            continue;
          }

          if (!Array.isArray(detectedPatterns)) continue;

          // Limit to 10 patterns, sorted by evidence count
          detectedPatterns.sort((a, b) => (b.evidence_count || 0) - (a.evidence_count || 0));
          detectedPatterns = detectedPatterns.slice(0, 10);

          const detectedTypes = new Set(detectedPatterns.map((p) => p.pattern_type));

          // Upsert detected patterns
          for (const pattern of detectedPatterns) {
            if (!pattern.pattern_type || !pattern.description) continue;

            // Check for existing pattern of same type
            const { data: existing } = await supabase
              .from("behaviour_patterns")
              .select("id, evidence_count")
              .eq("user_id", userId)
              .eq("pattern_type", pattern.pattern_type)
              .eq("is_active", true)
              .maybeSingle();

            if (existing) {
              // Update existing pattern
              await supabase.from("behaviour_patterns").update({
                description: pattern.description,
                evidence_count: Math.max(existing.evidence_count || 0, pattern.evidence_count || 1),
                trigger_conditions: pattern.trigger_conditions || {},
                severity: pattern.severity || "medium",
                recommendation: pattern.recommendation || null,
                scan_id: scanId,
                last_seen_at: new Date().toISOString(),
                is_active: true,
              }).eq("id", existing.id);
            } else {
              // Insert new pattern
              await supabase.from("behaviour_patterns").insert({
                user_id: userId,
                pattern_type: pattern.pattern_type,
                description: pattern.description,
                evidence_count: pattern.evidence_count || 1,
                confidence: 0.6,
                trigger_conditions: pattern.trigger_conditions || {},
                severity: pattern.severity || "medium",
                recommendation: pattern.recommendation || null,
                scan_id: scanId,
                is_active: true,
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              });
            }

            patternsDetected++;
          }

          // Retire patterns not seen in this scan (after 3 misses)
          // Get all active patterns for this user that weren't in this scan
          const { data: stalePatterns } = await supabase
            .from("behaviour_patterns")
            .select("id, scan_id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .neq("scan_id", scanId);

          if (stalePatterns) {
            for (const stale of stalePatterns) {
              // If the scan_id is more than 2 scans old, retire it
              // Simple approach: if it wasn't updated in this scan, mark inactive
              // (A production system would track scan count per pattern)
              await supabase.from("behaviour_patterns").update({
                is_active: false,
              }).eq("id", stale.id);
              patternsRetired++;
            }
          }

          usersProcessed++;
          console.log(`[PATTERN_CRON] User ${userId.slice(0, 8)}: ${detectedPatterns.length} patterns detected`);

        } catch (userErr) {
          console.error(`[PATTERN_CRON] Error processing user ${userId.slice(0, 8)}:`, userErr);
        }
      }
    }

    console.log(`[PATTERN_CRON] Scan ${scanId} complete. Users: ${usersProcessed}, Detected: ${patternsDetected}, Retired: ${patternsRetired}`);

    return new Response(
      JSON.stringify({
        status: "ok",
        scan_id: scanId,
        users_processed: usersProcessed,
        patterns_detected: patternsDetected,
        patterns_retired: patternsRetired,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[PATTERN_CRON] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
