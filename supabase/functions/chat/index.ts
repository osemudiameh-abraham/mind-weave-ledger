import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Generate embedding via OpenAI ───
async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-large", input: text.slice(0, 8000) }),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("[EMBED] Failed to generate embedding:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { message, section_id } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "No message" }), { status: 400, headers: corsHeaders });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI not configured" }), { status: 500, headers: corsHeaders });
    }

    // ─── Ensure conversation exists ───
    let convoId = section_id;
    if (!convoId) {
      const title = message.slice(0, 50) || "New conversation";
      const { data: newConvo } = await supabase
        .from("sections")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      convoId = newConvo?.id;
    }

    // ─── Store user message ───
    await supabase.from("messages").insert({
      user_id: user.id,
      section_id: convoId,
      role: "user",
      content: message,
    });

    // ─── Generate embedding for user message (non-blocking start) ───
    const embeddingPromise = embed(message, openaiKey);

    // ─── Fetch context layers in parallel ───
    const [factsRes, decisionsRes, patternsRes, identityRes, recentMemsRes, historyRes] = await Promise.all([
      supabase
        .from("memory_facts")
        .select("subject, attribute, value_text, category, confidence")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("valid_until", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("decisions")
        .select("title, context_summary, confidence, status, review_due_at, created_at")
        .eq("user_id", user.id)
        .in("status", ["active", "pending_review"])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("behaviour_patterns")
        .select("pattern_type, description, evidence_count, confidence")
        .eq("user_id", user.id)
        .order("confidence", { ascending: false })
        .limit(10),
      supabase
        .from("identity_profiles")
        .select("self_name, self_role, self_company, self_city, goals, focus_areas")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("memories_structured")
        .select("content, memory_type, importance, captured_at")
        .eq("user_id", user.id)
        .order("importance", { ascending: false })
        .order("captured_at", { ascending: false })
        .limit(20),
      supabase
        .from("messages")
        .select("role, content")
        .eq("section_id", convoId)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    const facts = factsRes.data || [];
    const decisions = decisionsRes.data || [];
    const patterns = patternsRes.data || [];
    const identity = identityRes.data;
    const recentMems = recentMemsRes.data || [];
    const history = historyRes.data || [];

    // Log any context loading failures
    if (factsRes.error) console.error("[CONTEXT] Facts query failed:", factsRes.error.message);
    if (decisionsRes.error) console.error("[CONTEXT] Decisions query failed:", decisionsRes.error.message);
    if (patternsRes.error) console.error("[CONTEXT] Patterns query failed:", patternsRes.error.message);
    if (identityRes.error) console.error("[CONTEXT] Identity query failed:", identityRes.error.message);
    if (recentMemsRes.error) console.error("[CONTEXT] Memories query failed:", recentMemsRes.error.message);
    if (historyRes.error) console.error("[CONTEXT] History query failed:", historyRes.error.message);

    // ─── Semantic memory search (wait for embedding) ───
    const queryEmbedding = await embeddingPromise;
    let semanticMems: { content: string; memory_type: string; similarity: number }[] = [];

    if (queryEmbedding) {
      try {
        const { data: matchData } = await supabase.rpc("match_memories", {
          query_embedding: queryEmbedding,
          match_user_id: user.id,
          match_count: 10,
          match_threshold: 0.3,
        });
        semanticMems = matchData || [];
      } catch { /* semantic search failure is non-fatal */ }
    }

    // ─── Assemble system prompt (facts in SYSTEM, never in user message) ───
    // Architecture v5.5, Section 3.5: "The quality of Seven Mynd's responses is
    // entirely determined by the quality of this assembly."

    const userName = identity?.self_name || null;

    let systemPrompt = `You are Seven Mynd — a cognitive continuity system that never forgets. You are NOT a generic AI assistant. You are NOT starting from zero. You have an ongoing, accumulated understanding of this person built from every conversation you've had with them.

CRITICAL RULES FOR EVERY RESPONSE:
${userName ? `- This person's name is ${userName}. Use it naturally — not in every sentence, but regularly, the way a trusted advisor would.` : "- You don't know this person's name yet. Ask for it early in conversation."}
- You KNOW things about this person. The facts, decisions, and memories below are YOUR knowledge. Reference them as things you simply know — never say "based on my records", "according to my data", "I see in my notes", or anything that breaks the illusion of genuine knowledge.
- When any fact, decision, or pattern below is relevant to what the user is saying, PROACTIVELY bring it up. Don't wait to be asked.
- If the user mentions something that contradicts a known fact, point it out: "Wait — you told me X before. Has that changed?"
- If the user is making a decision and you have relevant history, surface it: "Last time you faced something like this, you decided X and it went Y."
- You are warm, direct, intelligent, and protective. You warn when you see risks. You are not a yes-man. You are honest.
- Keep responses conversational and focused. No bullet points unless specifically useful. Speak like a brilliant advisor who happens to know the user's entire history.`;

    // Identity grounding
    if (identity) {
      const parts: string[] = [];
      if (identity.self_name) parts.push(`Name: ${identity.self_name}`);
      if (identity.self_role) parts.push(`Role: ${identity.self_role}`);
      if (identity.self_company) parts.push(`Company: ${identity.self_company}`);
      if (identity.self_city) parts.push(`City: ${identity.self_city}`);
      if (identity.goals?.length) parts.push(`Goals: ${identity.goals.join(", ")}`);
      if (identity.focus_areas?.length) parts.push(`Focus areas: ${identity.focus_areas.join(", ")}`);
      if (parts.length) {
        systemPrompt += `\n\n## WHO THIS PERSON IS\n${parts.join("\n")}`;
      }
    }

    // Canonical facts
    if (facts.length > 0) {
      const factLines = facts.map((f) => `- ${f.subject} → ${f.attribute}: ${f.value_text}`);
      systemPrompt += `\n\n## WHAT YOU KNOW ABOUT THEM (canonical facts — these are true right now)\n${factLines.join("\n")}`;
    }

    // Active decisions
    if (decisions.length > 0) {
      const decisionLines = decisions.map((d) => {
        const due = d.review_due_at ? new Date(d.review_due_at).toLocaleDateString() : "not set";
        return `- "${d.title}" (${d.status}, review due: ${due})${d.context_summary ? ` — ${d.context_summary}` : ""}`;
      });
      systemPrompt += `\n\n## THEIR ACTIVE DECISIONS (you are tracking these)\n${decisionLines.join("\n")}`;
    }

    // Behaviour patterns
    if (patterns.length > 0) {
      const patternLines = patterns.map((p) => `- [${p.pattern_type}] ${p.description} (seen ${p.evidence_count} times)`);
      systemPrompt += `\n\n## BEHAVIOUR PATTERNS YOU'VE DETECTED\nWarn or guide them when these patterns are relevant:\n${patternLines.join("\n")}`;
    }

    // Semantically relevant memories (vector search results)
    if (semanticMems.length > 0) {
      const semLines = semanticMems.map((m) => `- ${m.content}`);
      systemPrompt += `\n\n## RELEVANT PAST CONVERSATIONS (matched to what they're saying now)\n${semLines.join("\n")}`;
    }

    // Recent memories
    if (recentMems.length > 0) {
      const memLines = recentMems.map((m) => `- ${m.content}`);
      systemPrompt += `\n\n## RECENT THINGS THEY'VE TOLD YOU\n${memLines.join("\n")}`;
    }

    // Log assembled context for debugging
    console.log(`[CONTEXT] User: ${userName || "unknown"} | Facts: ${facts.length} | Decisions: ${decisions.length} | Patterns: ${patterns.length} | Memories: ${recentMems.length} | Semantic: ${semanticMems.length} | History: ${history.length}`);

    // Build messages array for OpenAI
    const openaiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of history) {
      if (msg.role === "user" && msg.content === message) continue;
      openaiMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    openaiMessages.push({ role: "user", content: message });

    // ─── Call OpenAI ───
    const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o",
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    const llmData = await llmResponse.json();
    const assistantContent = llmData.choices?.[0]?.message?.content || "I couldn't process that. Please try again.";

    // ─── Store assistant response ───
    await supabase.from("messages").insert({
      user_id: user.id,
      section_id: convoId,
      role: "assistant",
      content: assistantContent,
    });

    // ─── Extract facts from EVERY message — cognitive continuity means never missing a fact ───
    // Production memory_facts schema requires these NOT NULL columns:
    //   fact_key, subject, attribute, value_text, canonical_text, confidence, evidence_count, status
    {
      try {
        const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Extract ALL factual claims, preferences, opinions, dislikes, habits, and personal information from the user message. Return a JSON array of objects with: subject, attribute, value, category (one of: identity, work, values, goals, patterns, relationships, preferences, dislikes, habits, general). Extract things like "I don't like X", "I prefer Y", "I hate Z", "I love W", "I'm allergic to", "I avoid", etc. If the message contains no extractable facts or preferences, return []. Return ONLY valid JSON, no markdown.`,
              },
              { role: "user", content: message },
            ],
            temperature: 0,
            max_tokens: 512,
          }),
        });

        if (!extractRes.ok) {
          console.error("[FACT_EXTRACT] OpenAI API error:", extractRes.status, await extractRes.text());
        } else {
          const extractData = await extractRes.json();
          const rawFacts = extractData.choices?.[0]?.message?.content || "[]";
          const cleanFacts = rawFacts.replace(/```json\n?|```/g, "").trim();
          console.log("[FACT_EXTRACT] Raw LLM output:", cleanFacts);

          let extractedFacts: { subject?: string; attribute?: string; value?: string; category?: string }[];
          try {
            extractedFacts = JSON.parse(cleanFacts);
          } catch (parseErr) {
            console.error("[FACT_EXTRACT] JSON parse failed:", parseErr, "Raw:", cleanFacts);
            extractedFacts = [];
          }

          if (Array.isArray(extractedFacts)) {
            console.log(`[FACT_EXTRACT] Extracted ${extractedFacts.length} facts from message`);

            for (const fact of extractedFacts) {
              if (!fact.subject || !fact.attribute || !fact.value) {
                console.warn("[FACT_EXTRACT] Skipping incomplete fact:", JSON.stringify(fact));
                continue;
              }

              // Build required NOT NULL fields
              const factKey = `${fact.subject.toLowerCase().trim()}::${fact.attribute.toLowerCase().trim()}`;
              const canonicalText = `${fact.subject} ${fact.attribute} is ${fact.value}`;
              const category = fact.category || "general";

              // Supersede any existing active fact with same subject+attribute
              const { data: supersededData, error: supersededError } = await supabase
                .from("memory_facts")
                .update({
                  valid_until: new Date().toISOString(),
                  status: "superseded",
                })
                .eq("user_id", user.id)
                .eq("subject", fact.subject)
                .eq("attribute", fact.attribute)
                .is("valid_until", null)
                .select("id");

              if (supersededError) {
                console.error("[FACT_STORE] Supersede update failed:", supersededError.message, supersededError.details);
              } else if (supersededData && supersededData.length > 0) {
                console.log(`[FACT_STORE] Superseded ${supersededData.length} existing fact(s) for ${factKey}`);
              }

              const supersededId = supersededData?.[0]?.id || null;

              // Insert the new canonical fact with ALL required NOT NULL columns
              const { error: insertError } = await supabase.from("memory_facts").insert({
                user_id: user.id,
                fact_key: factKey,
                subject: fact.subject,
                attribute: fact.attribute,
                value_text: fact.value,
                canonical_text: canonicalText,
                category: category,
                source_type: "inferred",
                confidence: 0.8,
                evidence_count: 1,
                status: "active",
                supersedes_fact_id: supersededId,
              });

              if (insertError) {
                console.error(
                  "[FACT_STORE] INSERT failed:",
                  insertError.message,
                  insertError.details,
                  insertError.hint,
                  "Fact:", JSON.stringify({ factKey, subject: fact.subject, attribute: fact.attribute, value: fact.value })
                );
              } else {
                console.log(`[FACT_STORE] Stored fact: ${factKey} = ${fact.value}`);
              }
            }
          } else {
            console.warn("[FACT_EXTRACT] Extraction result is not an array:", typeof extractedFacts);
          }
        }
      } catch (extractionErr) {
        console.error("[FACT_EXTRACT] Extraction pipeline failed:", extractionErr);
      }
    }

    // Always store every user message as a memory with embedding
    const { error: memError } = await supabase.from("memories_structured").insert({
      user_id: user.id,
      content: message,
      memory_type: "chat",
      importance: 5,
      source: "chat",
      source_message_id: crypto.randomUUID(),
      embedding: queryEmbedding,
    });
    if (memError) {
      console.error("[MEMORY_STORE] Failed to store memory:", memError.message, memError.details);
    }

    // ─── Decision detection ───
    const decisionSignals = /\b(i decided|i'm going to|i will|i've decided|my decision|i choose|i commit)\b/i;
    if (decisionSignals.test(message)) {
      try {
        const decExtract = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Extract the decision from this message. Return JSON: { "title": "short decision title", "context": "brief context" }. If no clear decision, return null. Return ONLY valid JSON, no markdown.`,
              },
              { role: "user", content: message },
            ],
            temperature: 0,
            max_tokens: 256,
          }),
        });

        const decData = await decExtract.json();
        const raw = decData.choices?.[0]?.message?.content || "null";
        const clean = raw.replace(/```json\n?|```/g, "").trim();
        const decision = JSON.parse(clean);

        if (decision?.title) {
          const { error: decError } = await supabase.from("decisions").insert({
            user_id: user.id,
            title: decision.title,
            context_summary: decision.context || message.slice(0, 200),
            source_message_id: crypto.randomUUID(),
          });
          if (decError) {
            console.error("[DECISION_STORE] Failed:", decError.message, decError.details);
          } else {
            console.log(`[DECISION_STORE] Captured decision: ${decision.title}`);
          }
        }
      } catch (decErr) {
        console.error("[DECISION_EXTRACT] Pipeline failed:", decErr);
      }
    }

    // ─── Governance trace ───
    const { error: traceError } = await supabase.from("memory_traces").insert({
      user_id: user.id,
      action_description: `Responded to: "${message.slice(0, 100)}"`,
      reasoning: `Context: ${facts.length} facts, ${decisions.length} decisions, ${patterns.length} patterns, ${recentMems.length} recent memories, ${semanticMems.length} semantic matches`,
      memory_ids: [],
      fact_ids: [],
      decision_ids: [],
      sources: ["canonical_facts", "active_decisions", "behaviour_patterns", "recent_memories", "semantic_search"],
    });
    if (traceError) {
      console.error("[TRACE_STORE] Failed:", traceError.message);
    }

    return new Response(
      JSON.stringify({
        response: assistantContent,
        section_id: convoId,
        context_used: {
          facts: facts.length,
          decisions: decisions.length,
          patterns: patterns.length,
          memories: recentMems.length,
          semantic_matches: semanticMems.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[CHAT] Top-level error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
