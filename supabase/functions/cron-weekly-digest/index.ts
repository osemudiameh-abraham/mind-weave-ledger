/**
 * Weekly Digest Cron — Architecture v5.5, Section 10.7 (Type 3)
 *
 * Schedule: Sunday 10:00 AM UTC
 * Protected by CRON_SECRET header.
 *
 * Generates a weekly digest for each active user:
 *   - Decisions made this week
 *   - Reviews completed
 *   - New facts learned
 *   - Patterns detected
 *   - Key memories
 *
 * Stores digest in digest_entries table.
 * Sends push notification + could send email via Resend (future).
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("[CRON] SUPABASE_SERVICE_ROLE_KEY not set — cannot process users");
      return new Response(JSON.stringify({ error: "SERVICE_ROLE_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find users who had any activity this week
    const { data: activeUsers } = await supabase
      .from("messages")
      .select("user_id")
      .gte("created_at", weekAgo);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(JSON.stringify({ status: "ok", digests_generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueUsers = [...new Set(activeUsers.map((m) => m.user_id))];
    console.log(`[DIGEST_CRON] ${uniqueUsers.length} active users this week`);

    let digestsGenerated = 0;

    for (const userId of uniqueUsers) {
      try {
        // Gather weekly stats
        const [factsRes, decisionsRes, outcomesRes, patternsRes, memoriesRes, messagesRes] = await Promise.all([
          supabase.from("memory_facts")
            .select("subject, attribute, value_text")
            .eq("user_id", userId)
            .gte("created_at", weekAgo)
            .limit(20),
          supabase.from("decisions")
            .select("title, status, created_at")
            .eq("user_id", userId)
            .gte("created_at", weekAgo),
          supabase.from("outcomes")
            .select("outcome_label, reflection")
            .eq("user_id", userId)
            .gte("created_at", weekAgo),
          supabase.from("behaviour_patterns")
            .select("pattern_type, description, severity")
            .eq("user_id", userId)
            .eq("is_active", true),
          supabase.from("memories_structured")
            .select("text, importance")
            .eq("user_id", userId)
            .gte("created_at", weekAgo)
            .order("importance", { ascending: false })
            .limit(10),
          supabase.from("messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", weekAgo),
        ]);

        const facts = factsRes.data || [];
        const decisions = decisionsRes.data || [];
        const outcomes = outcomesRes.data || [];
        const patterns = patternsRes.data || [];
        const memories = memoriesRes.data || [];
        const messageCount = messagesRes.count || 0;

        // Skip users with minimal activity
        if (messageCount < 3) continue;

        // Generate narrative digest using GPT-4o-mini
        const digestInput = `WEEKLY STATS:
- Messages exchanged: ${messageCount}
- New facts learned: ${facts.length}
- Decisions made: ${decisions.length}
- Reviews completed: ${outcomes.length}
- Active patterns: ${patterns.length}

DECISIONS THIS WEEK:
${decisions.map((d) => `- "${d.title}" (${d.status})`).join("\n") || "None"}

OUTCOMES LOGGED:
${outcomes.map((o) => `- ${o.outcome_label}${o.reflection ? `: ${o.reflection}` : ""}`).join("\n") || "None"}

NEW FACTS LEARNED:
${facts.map((f) => `- ${f.subject}: ${f.attribute} = ${f.value_text}`).join("\n") || "None"}

ACTIVE PATTERNS:
${patterns.map((p) => `- [${p.severity}] ${p.pattern_type}: ${p.description}`).join("\n") || "None"}

KEY MEMORIES:
${memories.map((m) => `- ${m.text}`).join("\n") || "None"}`;

        const digestRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Write a brief, warm weekly digest summary (3-5 short paragraphs). Address the user directly. Highlight key decisions, patterns to watch, and progress. Be encouraging but honest. If there are concerning patterns, mention them gently. End with a forward-looking statement. No markdown, no bullet points — conversational prose only.`,
              },
              { role: "user", content: digestInput },
            ],
            temperature: 0.6,
            max_tokens: 500,
          }),
        });

        if (!digestRes.ok) {
          console.error(`[DIGEST_CRON] GPT error for user ${userId.slice(0, 8)}: ${digestRes.status}`);
          continue;
        }

        const digestData = await digestRes.json();
        const narrative = digestData.choices?.[0]?.message?.content || "";

        if (!narrative) continue;

        // Store digest
        const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const weekEnd = new Date().toISOString().slice(0, 10);

        const { error: digestErr } = await supabase.from("digest_entries").insert({
          user_id: userId,
          week_start: weekStart,
          week_end: weekEnd,
          summary: narrative,
          decisions_made: decisions.length,
          patterns_detected: patterns.length,
          facts_learned: facts.length,
          highlights: [
            { type: "messages", count: messageCount },
            { type: "outcomes", count: outcomes.length },
          ],
        });

        if (digestErr) {
          console.error(`[DIGEST_CRON] Storage failed for user ${userId.slice(0, 8)}:`, digestErr.message);
        }

        // Send push notification
        try {
          await supabase.functions.invoke("notify", {
            body: {
              user_id: userId,
              notification_type: "weekly_digest",
              title: "Your Weekly Digest is Ready",
              body: `You made ${decisions.length} decisions and Seven learned ${facts.length} new facts this week.`,
              url: "/digest",
            },
          });
        } catch { /* push is non-fatal */ }

        digestsGenerated++;
        console.log(`[DIGEST_CRON] Generated digest for user ${userId.slice(0, 8)}`);

      } catch (userErr) {
        console.error(`[DIGEST_CRON] Error for user ${userId.slice(0, 8)}:`, userErr);
      }
    }

    console.log(`[DIGEST_CRON] Complete. Digests generated: ${digestsGenerated}/${uniqueUsers.length}`);

    return new Response(
      JSON.stringify({ status: "ok", digests_generated: digestsGenerated, total_users: uniqueUsers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[DIGEST_CRON] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
