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
  } catch { return null; }
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
        .select("subject, attribute, value, category, confidence")
        .eq("user_id", user.id)
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
    let systemPrompt = `You are Seven Mynd — a cognitive continuity system. You are NOT a generic chatbot. You remember everything the user tells you, track their decisions, detect patterns in their behaviour, and help them make better decisions over time.

You speak in a warm, direct, intelligent tone. You are protective of the user — you warn them when you detect risks or patterns. You are not a yes-man. You are honest.

When you have relevant context about the user, USE IT naturally. Reference their decisions, patterns, and facts as if you genuinely know them. Never say "based on my records" — speak as if you simply know.`;

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
        systemPrompt += `\n\n## WHO THIS USER IS\n${parts.join("\n")}`;
      }
    }

    // Canonical facts
    if (facts.length > 0) {
      const factLines = facts.map((f) => `- ${f.subject}: ${f.attribute} = ${f.value} [${f.category}, confidence: ${f.confidence}]`);
      systemPrompt += `\n\n## CANONICAL FACTS (current truths about this user)\n${factLines.join("\n")}`;
    }

    // Active decisions
    if (decisions.length > 0) {
      const decisionLines = decisions.map((d) => {
        const due = d.review_due_at ? new Date(d.review_due_at).toLocaleDateString() : "not set";
        return `- "${d.title}" (${d.status}, confidence: ${d.confidence}, review due: ${due})${d.context_summary ? ` — ${d.context_summary}` : ""}`;
      });
      systemPrompt += `\n\n## ACTIVE DECISIONS\n${decisionLines.join("\n")}`;
    }

    // Behaviour patterns
    if (patterns.length > 0) {
      const patternLines = patterns.map((p) => `- [${p.pattern_type}] ${p.description} (evidence: ${p.evidence_count}, confidence: ${p.confidence})`);
      systemPrompt += `\n\n## DETECTED BEHAVIOUR PATTERNS\nUse these to warn or guide the user when relevant:\n${patternLines.join("\n")}`;
    }

    // Semantically relevant memories (NEW — vector search results)
    if (semanticMems.length > 0) {
      const semLines = semanticMems.map((m) => `- [${m.memory_type}] ${m.content} (relevance: ${(m.similarity * 100).toFixed(0)}%)`);
      systemPrompt += `\n\n## RELEVANT MEMORIES (semantically matched to current query)\n${semLines.join("\n")}`;
    }

    // Recent memories
    if (recentMems.length > 0) {
      const memLines = recentMems.map((m) => `- [${m.memory_type}] ${m.content}`);
      systemPrompt += `\n\n## RECENT MEMORIES\n${memLines.join("\n")}`;
    }

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
    {
      // LLM extraction on every message (gpt-4o-mini, ~$0.001 per call)
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

        const extractData = await extractRes.json();
        const rawFacts = extractData.choices?.[0]?.message?.content || "[]";
        const cleanFacts = rawFacts.replace(/```json\n?|```/g, "").trim();
        const extractedFacts = JSON.parse(cleanFacts);

        if (Array.isArray(extractedFacts)) {
          for (const fact of extractedFacts) {
            if (fact.subject && fact.attribute && fact.value) {
              await supabase
                .from("memory_facts")
                .update({ valid_until: new Date().toISOString() })
                .eq("user_id", user.id)
                .eq("subject", fact.subject)
                .eq("attribute", fact.attribute)
                .is("valid_until", null);

              await supabase.from("memory_facts").insert({
                user_id: user.id,
                subject: fact.subject,
                attribute: fact.attribute,
                value: fact.value,
                category: fact.category || "general",
                source_type: "inferred",
              });
            }
          }
        }
      } catch { /* extraction failure is non-fatal */ }
    }

    // Always store every user message as a memory with embedding
    await supabase.from("memories_structured").insert({
      user_id: user.id,
      content: message,
      memory_type: "chat",
      importance: 5,
      source: "chat",
      source_message_id: crypto.randomUUID(),
      embedding: queryEmbedding,
    });

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
          await supabase.from("decisions").insert({
            user_id: user.id,
            title: decision.title,
            context_summary: decision.context || message.slice(0, 200),
            source_message_id: crypto.randomUUID(),
          });
        }
      } catch { /* non-fatal */ }
    }

    // ─── Governance trace ───
    await supabase.from("memory_traces").insert({
      user_id: user.id,
      action_description: `Responded to: "${message.slice(0, 100)}"`,
      reasoning: `Context: ${facts.length} facts, ${decisions.length} decisions, ${patterns.length} patterns, ${recentMems.length} recent memories, ${semanticMems.length} semantic matches`,
      memory_ids: [],
      fact_ids: [],
      decision_ids: [],
      sources: ["canonical_facts", "active_decisions", "behaviour_patterns", "recent_memories", "semantic_search"],
    });

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
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
