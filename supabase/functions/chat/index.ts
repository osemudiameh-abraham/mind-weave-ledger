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

// ─── Post-processing: runs after LLM response for both batch and stream modes ───
async function runPostProcessing(params: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  convoId: string;
  message: string;
  assistantContent: string;
  queryEmbedding: number[] | null;
  openaiKey: string;
  facts: { subject: string; attribute: string; value_text: string }[];
  decisions: { id: string; title: string }[];
  patterns: { pattern_type: string }[];
  recentMems: { text: string }[];
  semanticMems: { text: string }[];
  matchedPatternIds: string[];
  situations: { id: string; title: string }[];
  metadata: { source?: string } | null;
}) {
  const { supabase, userId, convoId, message, assistantContent, queryEmbedding, openaiKey, facts, decisions, patterns, recentMems, semanticMems, matchedPatternIds, situations, metadata } = params;

  // Store assistant response
  await supabase.from("messages").insert({
    user_id: userId,
    section_id: convoId,
    role: "assistant",
    content: assistantContent,
  });

  // ─── THREE-TIER EXTRACTION PIPELINE (Architecture Section 3.6) ───
  // Tier 1: Heuristic gate — filter messages unlikely to contain facts (65% filtered, zero cost)
  // Tier 2: Regex patterns — extract common fact types without LLM (zero cost)
  // Tier 3: LLM extraction — GPT-4o-mini for complex/implicit facts (~$0.001/call)
  {
    try {
      // ── TIER 1: Heuristic Gate ──
      // Pure function, no async, under 5ms. Returns true if message likely contains extractable facts.
      const tier1Signals = [
        /\b(i am|i'm|my name|i work|i live|i was born|i grew up|my age|i'm from|i moved)\b/i,
        /\b(i decided|i've decided|i'm going to|i will|i choose|i commit|my decision)\b/i,
        /\b(i (love|hate|like|dislike|prefer|enjoy|avoid|can't stand|always|never))\b/i,
        /\b(my (wife|husband|partner|son|daughter|mother|father|brother|sister|boss|friend|team|company))\b/i,
        /\b(i'm (a|an|the) \w+)/i,
        /\b(i (started|joined|left|quit|began|finished|completed|graduated|studied))\b/i,
        /\b(my (goal|dream|plan|priority|focus|habit|routine|allergy|fear))\b/i,
        /\b(i (believe|think|feel|know|value|want|need|hope|worry))\b/i,
        /\b(born in|i earn|my salary|my budget|i spent|i saved|i invested)\b/i,
        /\b(diagnosed|allergic|intolerant|vegetarian|vegan|gluten.free)\b/i,
      ];
      const hasSignals = tier1Signals.some((r) => r.test(message));

      if (!hasSignals) {
        console.log("[EXTRACT] Tier 1: No fact signals — skipping extraction");
      } else {
        console.log("[EXTRACT] Tier 1: Fact signals detected — proceeding to Tier 2");

        // ── TIER 2: Regex Patterns ──
        // Structured extraction without LLM. ~80% coverage of fact-containing messages.
        const tier2Facts: { subject: string; attribute: string; value: string; category: string }[] = [];

        const regexPatterns: { pattern: RegExp; extract: (m: RegExpMatchArray) => { subject: string; attribute: string; value: string; category: string } | null }[] = [
          { pattern: /\bi(?:'m| am) (?:a |an )?(\w[\w\s]*?) at (\w[\w\s&.]*)/i, extract: (m) => ({ subject: "user", attribute: "job_role", value: m[1].trim(), category: "work" }) },
          { pattern: /\bi(?:'m| am) (?:a |an )?(\w[\w\s]*?) at (\w[\w\s&.]*)/i, extract: (m) => ({ subject: "user", attribute: "employer", value: m[2].trim(), category: "work" }) },
          { pattern: /\bi (?:work|worked) (?:at|for) (\w[\w\s&.]*)/i, extract: (m) => ({ subject: "user", attribute: "employer", value: m[1].trim(), category: "work" }) },
          { pattern: /\bi live (?:in|at) ([\w\s,]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: "location", value: m[1].trim(), category: "identity" }) },
          { pattern: /\bmy name is ([\w\s'-]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: "name", value: m[1].trim(), category: "identity" }) },
          { pattern: /\bi(?:'m| am) (\d{1,3})(?: years old)?/i, extract: (m) => ({ subject: "user", attribute: "age", value: m[1], category: "identity" }) },
          { pattern: /\bborn in (\d{4})/i, extract: (m) => ({ subject: "user", attribute: "birth_year", value: m[1], category: "identity" }) },
          { pattern: /\bmy (wife|husband|partner|girlfriend|boyfriend) (?:is |named )?([\w\s'-]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: "relationship", value: `${m[1]}: ${m[2].trim()}`, category: "relationships" }) },
          { pattern: /\bmy (son|daughter|child|kid) (?:is |named )?([\w\s'-]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: "family", value: `${m[1]}: ${m[2].trim()}`, category: "relationships" }) },
          { pattern: /\bi (?:really )?(love|hate|dislike|enjoy|avoid|prefer|can't stand) ([\w\s]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: m[1].toLowerCase(), value: m[2].trim(), category: "preferences" }) },
          { pattern: /\bi(?:'m| am) (allergic|intolerant) to ([\w\s]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: "allergy", value: m[2].trim(), category: "identity" }) },
          { pattern: /\bi(?:'m| am) (?:a )?(vegetarian|vegan|pescatarian)/i, extract: (m) => ({ subject: "user", attribute: "diet", value: m[1], category: "preferences" }) },
          { pattern: /\bmy goal is (?:to )?([\w\s]+?)(?:\.|,|$)/i, extract: (m) => ({ subject: "user", attribute: "goal", value: m[1].trim(), category: "goals" }) },
        ];

        for (const { pattern, extract } of regexPatterns) {
          const match = message.match(pattern);
          if (match) {
            const fact = extract(match);
            if (fact && fact.value.length > 1 && fact.value.length < 200) {
              tier2Facts.push(fact);
            }
          }
        }

        if (tier2Facts.length > 0) {
          console.log(`[EXTRACT] Tier 2: Regex extracted ${tier2Facts.length} facts`);
        }

        // ── TIER 3: LLM Extraction ──
        // Only runs if Tier 2 found fewer than 2 facts (may have missed complex/implicit ones)
        let tier3Facts: { subject?: string; attribute?: string; value?: string; category?: string }[] = [];

        if (tier2Facts.length < 2) {
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

          if (extractRes.ok) {
            const extractData = await extractRes.json();
            const rawFacts = extractData.choices?.[0]?.message?.content || "[]";
            const cleanFacts = rawFacts.replace(/```json\n?|```/g, "").trim();
            try {
              const parsed = JSON.parse(cleanFacts);
              if (Array.isArray(parsed)) {
                tier3Facts = parsed;
                console.log(`[EXTRACT] Tier 3: LLM extracted ${tier3Facts.length} facts`);
              }
            } catch {
              console.error("[EXTRACT] Tier 3: JSON parse failed");
            }
          } else {
            console.error("[EXTRACT] Tier 3: OpenAI error:", extractRes.status);
          }
        } else {
          console.log("[EXTRACT] Tier 3: Skipped — Tier 2 extracted enough facts");
        }

        // ── Merge and deduplicate facts from Tier 2 + Tier 3 ──
        const allFacts = [...tier2Facts];
        for (const t3 of tier3Facts) {
          if (!t3.subject || !t3.attribute || !t3.value) continue;
          const key = `${t3.subject.toLowerCase()}::${t3.attribute.toLowerCase()}`;
          const exists = allFacts.some((f) => `${f.subject.toLowerCase()}::${f.attribute.toLowerCase()}` === key);
          if (!exists) {
            allFacts.push({ subject: t3.subject, attribute: t3.attribute, value: t3.value, category: t3.category || "general" });
          }
        }

        // ── EXTRACTION-TO-FACT PIPELINE (Section 3.6) ──
        // For each fact: check existing → skip if same → supersede if different → flag contradiction if within 24h
        for (const fact of allFacts) {
          if (!fact.subject || !fact.attribute || !fact.value) continue;

          const factKey = `${fact.subject.toLowerCase().trim()}::${fact.attribute.toLowerCase().trim()}`;
          const canonicalText = `${fact.subject} ${fact.attribute} is ${fact.value}`;

          // Check for existing fact with same (user_id, subject, attribute) WHERE valid_until IS NULL
          const { data: existingFact } = await supabase
            .from("memory_facts")
            .select("id, value_text, created_at")
            .eq("user_id", userId)
            .eq("subject", fact.subject)
            .eq("attribute", fact.attribute)
            .is("valid_until", null)
            .maybeSingle();

          if (existingFact) {
            // Same value → skip (idempotent)
            if (existingFact.value_text?.toLowerCase().trim() === fact.value.toLowerCase().trim()) {
              console.log(`[FACT_STORE] Idempotent skip: ${factKey} = ${fact.value}`);
              continue;
            }

            // Different value → supersede
            // Check for contradiction: if existing fact was extracted within 24h, flag for user
            const existingAge = Date.now() - new Date(existingFact.created_at).getTime();
            const isRecentContradiction = existingAge < 24 * 60 * 60 * 1000;

            await supabase.from("memory_facts").update({
              valid_until: new Date().toISOString(),
              status: "superseded",
            }).eq("id", existingFact.id);

            console.log(`[FACT_STORE] Superseded: ${factKey} (old: "${existingFact.value_text}" → new: "${fact.value}")${isRecentContradiction ? " ⚠️ CONTRADICTION within 24h" : ""}`);
          }

          // Insert new fact
          const { error: insertError } = await supabase.from("memory_facts").insert({
            user_id: userId,
            fact_key: factKey,
            subject: fact.subject,
            attribute: fact.attribute,
            value_text: fact.value,
            canonical_text: canonicalText,
            category: fact.category || "general",
            source_type: existingFact ? "corrected" : "inferred",
            confidence: tier2Facts.includes(fact) ? 0.9 : 0.8,
            evidence_count: 1,
            status: "active",
            supersedes_fact_id: existingFact?.id || null,
            source_message_id: crypto.randomUUID(),
          });

          if (insertError) {
            console.error("[FACT_STORE] INSERT failed:", insertError.message, insertError.details);
          } else {
            console.log(`[FACT_STORE] Stored: ${factKey} = ${fact.value} (tier: ${tier2Facts.includes(fact) ? "2" : "3"})`);
          }
        }

        console.log(`[EXTRACT] Pipeline complete: ${allFacts.length} facts processed (Tier 2: ${tier2Facts.length}, Tier 3: ${tier3Facts.length})`);
      }
    } catch (extractionErr) {
      console.error("[EXTRACT] Pipeline failed:", extractionErr);
    }
  }

  // Always store every user message as a memory with embedding
  const { error: memError } = await supabase.from("memories_structured").insert({
    user_id: userId,
    text: message,
    memory_type: "chat",
    importance: 5,
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
          user_id: userId,
          title: decision.title,
          context_summary: decision.context || message.slice(0, 200),
          source_message_id: `${metadata?.source === "voice" ? "voice" : "chat"}_${crypto.randomUUID()}`,
        });
        if (decError) {
          console.error("[DECISION_STORE] Failed:", decError.message, decError.details);
        } else {
          console.log(`[DECISION_STORE] Captured decision: ${decision.title} (source: ${metadata?.source || "chat"})`);
        }
      }
    } catch (decErr) {
      console.error("[DECISION_EXTRACT] Pipeline failed:", decErr);
    }
  }

  // ─── Outcome capture (Section 4.11) ───
  // Detect when the user describes an outcome for an existing decision.
  // Signals: "it worked", "it failed", "it was mixed", "that didn't work", "it went well", etc.
  const outcomeSignals = /\b(it worked|it failed|it was mixed|that worked|that failed|didn't work|went well|went badly|was a mistake|turned out|outcome was|result was)\b/i;
  if (outcomeSignals.test(message) && decisions.length > 0) {
    try {
      const decisionList = decisions.map((d) => `ID: ${d.id} | Title: "${d.title}"`).join("\n");
      const outcomeExtract = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `The user is describing the outcome of a past decision. Match their message to one of these decisions and extract the outcome.\n\nDecisions:\n${decisionList}\n\nReturn JSON: { "decision_id": "uuid", "outcome": "worked" | "failed" | "mixed", "reflection": "brief summary of what the user said" }. If the message doesn't clearly relate to any of these decisions, return null. Return ONLY valid JSON, no markdown.`,
            },
            { role: "user", content: message },
          ],
          temperature: 0,
          max_tokens: 256,
        }),
      });

      const outcomeData = await outcomeExtract.json();
      const rawOutcome = outcomeData.choices?.[0]?.message?.content || "null";
      const cleanOutcome = rawOutcome.replace(/```json\n?|```/g, "").trim();
      const outcome = JSON.parse(cleanOutcome);

      if (outcome?.decision_id && outcome?.outcome) {
        const { error: outcomeError } = await supabase.from("outcomes").insert({
          user_id: userId,
          decision_id: outcome.decision_id,
          outcome_label: outcome.outcome,
          reflection: outcome.reflection || message.slice(0, 200),
          idempotency_key: `${outcome.decision_id}_${new Date().toISOString().slice(0, 10)}`,
        });

        if (outcomeError) {
          // Idempotency key may conflict if outcome already logged today
          if (!outcomeError.message.includes("duplicate")) {
            console.error("[OUTCOME_STORE] Failed:", outcomeError.message);
          }
        } else {
          // Update decision outcome_count and status
          await supabase.from("decisions").update({
            outcome_count: (decisions.find((d) => d.id === outcome.decision_id) as { outcome_count?: number } | undefined)?.outcome_count
              ? ((decisions.find((d) => d.id === outcome.decision_id) as { outcome_count?: number })?.outcome_count || 0) + 1
              : 1,
            status: "reviewed",
            updated_at: new Date().toISOString(),
          }).eq("id", outcome.decision_id);
          console.log(`[OUTCOME_STORE] Logged outcome for decision ${outcome.decision_id}: ${outcome.outcome}`);
        }
      }
    } catch (outcomeErr) {
      console.error("[OUTCOME_EXTRACT] Pipeline failed:", outcomeErr);
    }
  }

  // ─── Situation detection (Architecture Section 6.2) ───
  // Detect complex ongoing scenarios and create/update situations.
  const situationSignals = /\b(situation|project|deal|partnership|negotiation|dispute|lawsuit|buying|selling|hiring|firing|moving|renovation|startup|launch|campaign|initiative)\b/i;
  const complexitySignals = message.length > 100 && (message.split(",").length > 2 || message.split(" and ").length > 2);
  
  if (situationSignals.test(message) && complexitySignals) {
    try {
      const sitExtract = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Detect if this message describes a complex ongoing situation worth tracking. Return JSON: { "is_situation": true/false, "title": "short title", "narrative": "1-2 sentence summary", "entities": [{"name": "...", "type": "person|organisation"}], "risks": ["risk1", "risk2"] }. Return only valid JSON, no markdown.`,
            },
            { role: "user", content: message },
          ],
          temperature: 0,
          max_tokens: 400,
        }),
      });

      if (sitExtract.ok) {
        const sitData = await sitExtract.json();
        const raw = sitData.choices?.[0]?.message?.content || "{}";
        const clean = raw.replace(/```json\n?|```/g, "").trim();
        const sitResult = JSON.parse(clean);

        if (sitResult?.is_situation && sitResult?.title) {
          // Check if a situation with similar title already exists
          const { data: existingSit } = await supabase
            .from("situations")
            .select("id, title")
            .eq("user_id", userId)
            .eq("status", "active")
            .ilike("title", `%${sitResult.title.split(" ").slice(0, 3).join("%")}%`)
            .maybeSingle();

          if (existingSit) {
            // Update existing situation with new info
            await supabase.from("situations").update({
              narrative: sitResult.narrative || undefined,
              entities: sitResult.entities || undefined,
              risks: sitResult.risks || undefined,
              updated_at: new Date().toISOString(),
            }).eq("id", existingSit.id);
            console.log(`[SITUATION] Updated: "${existingSit.title}"`);
          } else {
            // Create new situation
            const { error: sitErr } = await supabase.from("situations").insert({
              user_id: userId,
              title: sitResult.title,
              narrative: sitResult.narrative || message.slice(0, 500),
              status: "active",
              entities: sitResult.entities || [],
              risks: sitResult.risks || [],
            });
            if (!sitErr) {
              console.log(`[SITUATION] Created: "${sitResult.title}"`);
            } else {
              console.error("[SITUATION] Create failed:", sitErr.message);
            }
          }
        }
      }
    } catch (sitErr) {
      console.error("[SITUATION] Detection failed:", sitErr);
    }
  }

  // Detect situation resolution
  const resolveSignals = /\b(resolved|concluded|settled|sorted|wrapped up|closed the deal|finished|done with|behind me now)\b/i;
  if (resolveSignals.test(message) && situations.length > 0) {
    try {
      const resolveExtract = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `The user may be indicating a situation is resolved. Active situations: ${situations.map((s) => `"${s.title}"`).join(", ")}. If the message indicates one is resolved, return JSON: { "resolved_title": "matching title" }. If none match, return null. Return only valid JSON.`,
            },
            { role: "user", content: message },
          ],
          temperature: 0,
          max_tokens: 100,
        }),
      });

      if (resolveExtract.ok) {
        const rData = await resolveExtract.json();
        const rRaw = rData.choices?.[0]?.message?.content || "null";
        const rClean = rRaw.replace(/```json\n?|```/g, "").trim();
        const rResult = JSON.parse(rClean);
        if (rResult?.resolved_title) {
          const matched = situations.find((s) => s.title.toLowerCase().includes(rResult.resolved_title.toLowerCase().slice(0, 20)));
          if (matched) {
            await supabase.from("situations").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", matched.id);
            console.log(`[SITUATION] Resolved: "${matched.title}"`);
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  // ─── Governance trace ───
  const { error: traceError } = await supabase.from("memory_traces").insert({
    user_id: userId,
    action_description: `Chat response: "${message.slice(0, 200)}"`,
    reasoning: `Context: ${facts.length} facts, ${decisions.length} decisions, ${patterns.length} patterns, ${recentMems.length} memories, ${semanticMems.length} semantic matches. ${matchedPatternIds.length > 0 ? `Pattern interventions fired: ${matchedPatternIds.length}` : "No pattern interventions."}`,
    memory_ids: [],
    fact_ids: [],
    decision_ids: [],
    situation_ids: matchedPatternIds,
    sources: ["canonical_facts", "active_decisions", "behaviour_patterns", "recent_memories", "semantic_search"],
  });
  if (traceError) {
    console.error("[TRACE_STORE] Failed:", traceError.message);
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

    const { message, section_id, response_mode, metadata, visual_context } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "No message" }), { status: 400, headers: corsHeaders });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI not configured" }), { status: 500, headers: corsHeaders });
    }

    // ─── Rate limiting (Architecture Section 19.4) ───
    // 60 messages per hour per user. Uses messages table as the counter.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", oneHourAgo);

    if ((recentMessages || 0) >= 60) {
      console.log(`[RATE_LIMIT] User ${user.id.slice(0, 8)} exceeded 60 msg/hr`);
      return new Response(
        JSON.stringify({ error: "You've sent a lot of messages recently. Please wait a moment.", retry_after: 60 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
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
      metadata: metadata || null,
    });

    // ─── Generate embedding for user message (non-blocking start) ───
    const embeddingPromise = embed(message, openaiKey);

    // ─── Fetch context layers in parallel ───
    const [factsRes, decisionsRes, patternsRes, identityRes, recentMemsRes, historyRes, identityModelRes, situationsRes] = await Promise.all([
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
        .select("id, title, context_summary, confidence, status, review_due_at, outcome_count, created_at")
        .eq("user_id", user.id)
        .in("status", ["active", "pending_review"])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("behaviour_patterns")
        .select("id, pattern_type, description, evidence_count, confidence, trigger_conditions, last_seen_at, severity, recommendation")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("confidence", { ascending: false })
        .limit(10),
      supabase
        .from("identity_profiles")
        .select("self_name, self_role, self_company, self_city, goals, focus_areas")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("memories_structured")
        .select("text, memory_type, importance, created_at")
        .eq("user_id", user.id)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("messages")
        .select("role, content")
        .eq("section_id", convoId)
        .order("created_at", { ascending: true })
        .limit(20),
      // Identity model — personality, values, communication style (built by weekly cron)
      supabase
        .from("identity_model")
        .select("personality_dimensions, core_values, decision_tendencies, communication_style, strengths, blind_spots")
        .eq("user_id", user.id)
        .maybeSingle(),
      // Active situations — narrative intelligence (Section 6.2)
      supabase
        .from("situations")
        .select("id, title, narrative, status, entities, risks")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    const facts = factsRes.data || [];
    const decisions = decisionsRes.data || [];
    const patterns = patternsRes.data || [];
    const identity = identityRes.data;
    const recentMems = recentMemsRes.data || [];
    const history = historyRes.data || [];
    const identityModel = identityModelRes.data;
    const situations = situationsRes.data || [];

    if (factsRes.error) console.error("[CONTEXT] Facts query failed:", factsRes.error.message);
    if (decisionsRes.error) console.error("[CONTEXT] Decisions query failed:", decisionsRes.error.message);
    if (patternsRes.error) console.error("[CONTEXT] Patterns query failed:", patternsRes.error.message);
    if (identityRes.error) console.error("[CONTEXT] Identity query failed:", identityRes.error.message);
    if (recentMemsRes.error) console.error("[CONTEXT] Memories query failed:", recentMemsRes.error.message);
    if (historyRes.error) console.error("[CONTEXT] History query failed:", historyRes.error.message);

    // ─── Semantic memory search (wait for embedding) ───
    const queryEmbedding = await embeddingPromise;
    let semanticMems: { text: string; memory_type: string; similarity: number }[] = [];

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
    const userName = identity?.self_name || null;

    // ─── Decision intelligence: fetch recent outcomes and detect due reviews (Section 4.11) ───
    let recentOutcomes: { decision_id: string; outcome_label: string; reflection: string | null; created_at: string }[] = [];
    try {
      const { data: outcomeData } = await supabase
        .from("outcomes")
        .select("decision_id, outcome_label, reflection, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      recentOutcomes = outcomeData || [];
    } catch { /* non-fatal */ }

    // Identify decisions due for review within 7 days
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const dueDecisions = decisions.filter((d) => {
      if (!d.review_due_at) return false;
      const dueTime = new Date(d.review_due_at).getTime();
      return dueTime <= now + sevenDaysMs && dueTime >= now - sevenDaysMs;
    });
    const overdueDecisions = decisions.filter((d) => {
      if (!d.review_due_at) return false;
      return new Date(d.review_due_at).getTime() < now - sevenDaysMs;
    });

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

    // Identity model — deep personality understanding (built by weekly cron, Section 3.7)
    if (identityModel) {
      const modelParts: string[] = [];
      const pd = identityModel.personality_dimensions as Record<string, string> | null;
      if (pd?.summary) modelParts.push(`Personality: ${pd.summary}`);
      const dt = identityModel.decision_tendencies as Record<string, string> | null;
      if (dt?.summary) modelParts.push(`Decision style: ${dt.summary}`);
      const cs = identityModel.communication_style as Record<string, string> | null;
      if (cs?.summary) modelParts.push(`Communication: ${cs.summary}`);
      if (cs?.preferred_tone) modelParts.push(`Preferred tone: ${cs.preferred_tone}`);
      if (identityModel.core_values?.length) modelParts.push(`Core values: ${identityModel.core_values.join(", ")}`);
      if (identityModel.strengths?.length) modelParts.push(`Strengths: ${identityModel.strengths.join(", ")}`);
      if (identityModel.blind_spots?.length) modelParts.push(`Blind spots to be aware of: ${identityModel.blind_spots.join(", ")}`);
      if (modelParts.length) {
        systemPrompt += `\n\n## THEIR PERSONALITY & IDENTITY MODEL (built from sustained interaction)\nAdapt your tone and approach to match who they are:\n${modelParts.join("\n")}`;
      }
    }

    // Canonical facts
    if (facts.length > 0) {
      const factLines = facts.map((f) => `- ${f.subject} → ${f.attribute}: ${f.value_text}`);
      systemPrompt += `\n\n## WHAT YOU KNOW ABOUT THEM (canonical facts — these are true right now)\n${factLines.join("\n")}`;
    }

    // Active decisions with outcome history
    if (decisions.length > 0) {
      // Build outcome map for quick lookup
      const outcomeMap = new Map<string, { label: string; reflection: string | null }[]>();
      for (const o of recentOutcomes) {
        if (!outcomeMap.has(o.decision_id)) outcomeMap.set(o.decision_id, []);
        outcomeMap.get(o.decision_id)!.push({ label: o.outcome_label, reflection: o.reflection });
      }

      const decisionLines = decisions.map((d) => {
        const due = d.review_due_at ? new Date(d.review_due_at).toLocaleDateString() : "not set";
        const made = new Date(d.created_at).toLocaleDateString();
        const outcomes = outcomeMap.get(d.id);
        let line = `- "${d.title}" (made: ${made}, status: ${d.status}, review due: ${due})`;
        if (d.context_summary) line += ` — ${d.context_summary}`;
        if (outcomes && outcomes.length > 0) {
          const outcomeStr = outcomes.map((o) => `${o.label}${o.reflection ? `: ${o.reflection}` : ""}`).join("; ");
          line += ` [Outcomes: ${outcomeStr}]`;
        }
        return line;
      });
      systemPrompt += `\n\n## THEIR ACTIVE DECISIONS (you are tracking these)\n${decisionLines.join("\n")}`;
    }

    // ─── Priority: decisions due for review (Section 4.11) ───
    if (dueDecisions.length > 0) {
      const dueLines = dueDecisions.map((d) => {
        const due = new Date(d.review_due_at!).toLocaleDateString();
        return `📋 "${d.title}" — review due ${due}. Ask: "How did this work out — worked, failed, or mixed?"`;
      });
      systemPrompt += `\n\n## 📋 DECISIONS DUE FOR REVIEW — PROMPT THE USER\nThese decisions are due for review. If the conversation topic is related, ask the user how it went. If not related, mention it naturally at the end of your response:\n${dueLines.join("\n")}`;
    }

    if (overdueDecisions.length > 0) {
      const overdueLines = overdueDecisions.map((d) => `- "${d.title}" (was due ${new Date(d.review_due_at!).toLocaleDateString()})`);
      systemPrompt += `\n\n## OVERDUE REVIEWS\nThese decisions are past their review date. Gently remind the user if appropriate:\n${overdueLines.join("\n")}`;
    }

    // ─── Real-time pattern intervention (Architecture Section 4.9) ───
    // Before generating a response, check active patterns for trigger matches.
    // Matched patterns are injected as PRIORITY warnings the LLM must address.
    const matchedPatternIds: string[] = [];
    const messageLower = message.toLowerCase();

    if (patterns.length > 0) {
      const triggeredPatterns: typeof patterns = [];
      const passivePatterns: typeof patterns = [];

      for (const p of patterns) {
        let triggered = false;

        // Check trigger_conditions keywords against the current message
        if (p.trigger_conditions && typeof p.trigger_conditions === "object") {
          const conditions = p.trigger_conditions as { keywords?: string[]; intents?: string[] };
          if (conditions.keywords && Array.isArray(conditions.keywords)) {
            for (const keyword of conditions.keywords) {
              if (messageLower.includes(keyword.toLowerCase())) {
                triggered = true;
                break;
              }
            }
          }
          if (!triggered && conditions.intents && Array.isArray(conditions.intents)) {
            for (const intent of conditions.intents) {
              if (messageLower.includes(intent.toLowerCase())) {
                triggered = true;
                break;
              }
            }
          }
        }

        // Fallback: keyword match against pattern_type and description
        if (!triggered) {
          const patternWords = `${p.pattern_type} ${p.description}`.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4);
          const matchCount = patternWords.filter((w: string) => messageLower.includes(w)).length;
          if (matchCount >= 2) {
            triggered = true;
          }
        }

        if (triggered) {
          triggeredPatterns.push(p);
          matchedPatternIds.push(p.id);
        } else {
          passivePatterns.push(p);
        }
      }

      // PRIORITY pattern warnings — LLM MUST address these
      if (triggeredPatterns.length > 0) {
        const warningLines = triggeredPatterns.map((p) => {
          const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString() : "unknown";
          return `⚠️ ACTIVE WARNING — [${p.pattern_type}]: ${p.description} (observed ${p.evidence_count} times, last seen: ${lastSeen}, confidence: ${Math.round(p.confidence * 100)}%)`;
        });
        systemPrompt += `\n\n## ⚠️ PATTERN WARNINGS — YOU MUST ADDRESS THESE IN YOUR RESPONSE\nThe following behaviour patterns match what the user is currently saying or doing. You MUST:\n1. Acknowledge the pattern naturally (not robotically)\n2. Reference specific evidence ("You've done this X times before")\n3. Warn them clearly but warmly — you are protective, not preachy\n4. Let them override if they choose — you warn, you don't block\n${warningLines.join("\n")}`;
        console.log(`[PATTERN_INTERVENTION] ${triggeredPatterns.length} pattern(s) triggered for user ${user.id.slice(0, 8)}: ${triggeredPatterns.map((p) => p.pattern_type).join(", ")}`);
      }

      // Passive pattern listing (non-triggered patterns, for general awareness)
      if (passivePatterns.length > 0) {
        const patternLines = passivePatterns.map((p) => `- [${p.pattern_type}] ${p.description} (seen ${p.evidence_count} times)`);
        systemPrompt += `\n\n## BEHAVIOUR PATTERNS YOU'VE DETECTED\nMention these if relevant, but they are not triggered by the current message:\n${patternLines.join("\n")}`;
      }
    }

    // Semantically relevant memories
    if (semanticMems.length > 0) {
      const semLines = semanticMems.map((m) => `- ${m.text}`);
      systemPrompt += `\n\n## RELEVANT PAST CONVERSATIONS (matched to what they're saying now)\n${semLines.join("\n")}`;
    }

    // Recent memories
    if (recentMems.length > 0) {
      const memLines = recentMems.map((m) => `- ${m.text}`);
      systemPrompt += `\n\n## RECENT THINGS THEY'VE TOLD YOU\n${memLines.join("\n")}`;
    }

    // Active situations — narrative intelligence (Section 6.2)
    if (situations.length > 0) {
      const sitLines = situations.map((s) => {
        let line = `• "${s.title}" (${s.status})`;
        if (s.narrative) line += ` — ${s.narrative.slice(0, 200)}`;
        if (s.risks && Array.isArray(s.risks) && s.risks.length > 0) line += ` | Risks: ${s.risks.join(", ")}`;
        return line;
      });
      systemPrompt += `\n\n## ACTIVE SITUATIONS THEY'RE NAVIGATING\nThese are complex, ongoing situations. Reference them when relevant:\n${sitLines.join("\n")}`;
    }

    // Voice-optimised system prompt (Section 4.8)
    if (metadata?.source === "voice") {
      systemPrompt += `\n\nYou are in a live voice conversation. Respond conversationally — short sentences, natural rhythm. Never monologue. Keep responses under 2-3 sentences unless the user specifically asks for detail. Match the user's emotional tone — if they sound frustrated, acknowledge it. If they're excited, match their energy. If they share something difficult, respond with empathy. Use natural conversational markers like 'right', 'I see', 'that makes sense', 'got it' when appropriate. You are having a real-time spoken conversation, not writing an essay. Pause points matter — structure your response so it can be spoken naturally with sentence-level TTS streaming. Never use markdown, bullet points, numbered lists, or any formatting that only works visually. Speak like a trusted advisor who knows the user deeply, not like a search engine.`;
    }

    // ─── Visual context from camera/screen-share (Section 4.5) ───
    // Injected into system prompt so LLM can reference what the user is seeing.
    // Visual context NEVER blocks the voice response — if absent, it's simply omitted.
    if (visual_context) {
      systemPrompt += `\n\n## 👁️ VISUAL CONTEXT (from camera/screen, captured seconds ago)\n${visual_context}\nYou can see what the user is looking at. Reference it naturally if relevant to what they're saying. Don't describe the image back to them unless they ask — just use it to inform your response.`;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GEL — Governed Execution Layer (Architecture Part XI, Section 4.10)
    // Intent detection, pending action management, approval, execution.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Step 1: Check for pending actions awaiting approval
    const { data: pendingActions } = await supabase
      .from("pending_actions")
      .select("id, action_type, intent_data, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    const pendingAction = pendingActions?.[0] || null;

    // Step 2: If there's a pending action, check if user is approving/rejecting
    if (pendingAction) {
      const approvalSignals = /\b(yes|send it|approve|go ahead|do it|confirmed|sure|okay|ok|yep|yeah)\b/i;
      const rejectSignals = /\b(no|cancel|don't|stop|wait|nevermind|never mind|hold on|scratch that)\b/i;
      const editSignals = /\b(change|edit|modify|make it|rephrase|rewrite|update the)\b/i;

      if (approvalSignals.test(message) && !rejectSignals.test(message)) {
        // ─── Execute the approved action ───
        const actionType = pendingAction.action_type;
        const intentData = pendingAction.intent_data || {};
        let executionResult = "";

        if (actionType === "reminder") {
          // Store reminder as a memory
          const { error: remErr } = await supabase.from("memories_structured").insert({
            user_id: user.id,
            text: intentData.description || intentData.title || "Reminder",
            memory_type: "reminder",
            importance: 7,
            source_message_id: `gel_${pendingAction.id}`,
          });
          executionResult = remErr ? `Failed: ${remErr.message}` : "Reminder set successfully";
        } else if (actionType === "email") {
          // Draft email using LLM with identity context, then generate mailto link
          const recipient = intentData.recipient || "unknown";
          const subject = intentData.subject || "";
          const bodyHint = intentData.body_hint || "";

          // Use GPT-4o-mini to draft the email body
          let draftBody = bodyHint;
          try {
            const draftRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `Draft a short, professional email body. Match the user's communication style. Keep it concise. Return ONLY the email body text, no subject line, no greeting line (it will be added). No markdown.${userName ? ` The sender's name is ${userName}.` : ""}`,
                  },
                  { role: "user", content: `Draft an email to ${recipient} about: ${bodyHint}. Subject: ${subject}` },
                ],
                temperature: 0.5,
                max_tokens: 300,
              }),
            });
            if (draftRes.ok) {
              const draftData = await draftRes.json();
              draftBody = draftData.choices?.[0]?.message?.content || bodyHint;
            }
          } catch { /* fallback to bodyHint */ }

          // Generate mailto link
          const mailtoParams = new URLSearchParams();
          if (subject) mailtoParams.set("subject", subject);
          if (draftBody) mailtoParams.set("body", draftBody);

          // Look up recipient email from situation_entities if available
          let recipientEmail = "";
          const { data: entityMatch } = await supabase
            .from("situation_entities")
            .select("email, phone")
            .eq("user_id", user.id)
            .ilike("name", `%${recipient}%`)
            .limit(1)
            .maybeSingle();
          if (entityMatch?.email) {
            recipientEmail = entityMatch.email;
          }

          const mailtoLink = `mailto:${recipientEmail}?${mailtoParams.toString()}`;
          const gmailLink = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(draftBody)}`;

          executionResult = JSON.stringify({
            type: "email",
            recipient,
            recipient_email: recipientEmail || "not found — user will need to enter",
            subject,
            body: draftBody,
            mailto_link: mailtoLink,
            gmail_link: gmailLink,
          });
        } else if (actionType === "message") {
          // Generate WhatsApp or iMessage link
          const recipient = intentData.recipient || "unknown";
          const platform = intentData.platform || "whatsapp";
          const bodyHint = intentData.body_hint || "";

          // Draft message
          let draftMessage = bodyHint;
          try {
            const draftRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `Draft a short, casual message. Match how the user naturally communicates. Keep it brief. Return ONLY the message text.`,
                  },
                  { role: "user", content: `Draft a ${platform} message to ${recipient}: ${bodyHint}` },
                ],
                temperature: 0.5,
                max_tokens: 150,
              }),
            });
            if (draftRes.ok) {
              const draftData = await draftRes.json();
              draftMessage = draftData.choices?.[0]?.message?.content || bodyHint;
            }
          } catch { /* fallback to bodyHint */ }

          // Look up phone/contact from situation_entities
          let contactPhone = "";
          const { data: contactMatch } = await supabase
            .from("situation_entities")
            .select("email, phone")
            .eq("user_id", user.id)
            .ilike("name", `%${recipient}%`)
            .limit(1)
            .maybeSingle();
          if (contactMatch?.phone) {
            contactPhone = contactMatch.phone;
          }

          let actionLink = "";
          if (platform === "whatsapp" || platform === "wa") {
            actionLink = contactPhone
              ? `https://wa.me/${contactPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(draftMessage)}`
              : `https://wa.me/?text=${encodeURIComponent(draftMessage)}`;
          } else {
            // iMessage / SMS
            actionLink = contactPhone
              ? `sms:${contactPhone}&body=${encodeURIComponent(draftMessage)}`
              : `sms:&body=${encodeURIComponent(draftMessage)}`;
          }

          executionResult = JSON.stringify({
            type: "message",
            platform,
            recipient,
            contact_phone: contactPhone || "not found — user will need to enter",
            body: draftMessage,
            action_link: actionLink,
          });
        } else {
          executionResult = `Action type '${actionType}' acknowledged`;
        }

        // Update pending_action status
        await supabase.from("pending_actions").update({
          status: "executed",
          result: { outcome: executionResult },
          executed_at: new Date().toISOString(),
        }).eq("id", pendingAction.id);

        // Audit log
        await supabase.from("audit_log").insert({
          user_id: user.id,
          action: `gel_execute_${actionType}`,
          table_name: "pending_actions",
          row_id: pendingAction.id,
          details: {
            action_type: actionType,
            intent_data: intentData,
            result: executionResult,
            approval_method: metadata?.source === "voice" ? "voice" : "text",
          },
        });

        systemPrompt += `\n\n## ✅ ACTION EXECUTED\nThe user just approved a pending action. Confirm it naturally:\n- Action: ${actionType}\n- Details: ${JSON.stringify(intentData)}\n- Result: ${executionResult}\nFor email/message actions: tell the user the draft is ready and they can tap/click the link to send it. Read back a brief summary of what will be sent. For reminders: confirm it's set. Be brief and natural.`;
        console.log(`[GEL] Executed ${actionType}: ${executionResult}`);

      } else if (rejectSignals.test(message)) {
        // ─── Reject the pending action ───
        await supabase.from("pending_actions").update({
          status: "rejected",
          result: { reason: "User rejected" },
        }).eq("id", pendingAction.id);

        await supabase.from("audit_log").insert({
          user_id: user.id,
          action: `gel_reject_${pendingAction.action_type}`,
          table_name: "pending_actions",
          row_id: pendingAction.id,
          details: { action_type: pendingAction.action_type, approval_method: metadata?.source === "voice" ? "voice" : "text" },
        });

        systemPrompt += `\n\n## ACTION CANCELLED\nThe user cancelled a pending ${pendingAction.action_type} action. Acknowledge briefly.`;
        console.log(`[GEL] User rejected ${pendingAction.action_type}`);

      } else if (editSignals.test(message)) {
        // User wants to edit — keep the action pending, inject edit context
        systemPrompt += `\n\n## ACTION EDIT REQUESTED\nThe user wants to modify a pending ${pendingAction.action_type} action:\n- Current details: ${JSON.stringify(pendingAction.intent_data)}\nHelp them edit it, then re-confirm: "Here's the updated version. Should I go ahead?"`;

      } else {
        // Pending action exists but user said something else — remind them
        systemPrompt += `\n\n## PENDING ACTION (awaiting confirmation)\nThere is a pending ${pendingAction.action_type} action: ${JSON.stringify(pendingAction.intent_data)}. If the user's current message is unrelated, continue the conversation normally. If it seems related, ask: "By the way, should I still go ahead with that ${pendingAction.action_type}?"`;
      }
    }

    // Step 3: Detect new actionable intents in the current message
    const intentSignals = {
      reminder: /\b(remind me|set a reminder|don't let me forget|remember to tell me)\b/i,
      email: /\b(send .* email|email .* to|write .* email|draft .* email|send .* a message via email)\b/i,
      message: /\b(send .* message|text .* to|message .* on|whatsapp|tell .* that)\b/i,
    };

    let detectedIntent: string | null = null;
    for (const [intentType, regex] of Object.entries(intentSignals)) {
      if (regex.test(message)) {
        detectedIntent = intentType;
        break;
      }
    }

    if (detectedIntent && !pendingAction) {
      // Use LLM to extract structured intent data
      try {
        const intentExtract = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Extract the actionable intent from this message. The intent type is: ${detectedIntent}. Return JSON with these fields based on type:\n- reminder: { "title": "short title", "description": "what to remember", "when": "time description if mentioned" }\n- email: { "recipient": "who to email", "subject": "subject line", "body_hint": "what the email should say" }\n- message: { "recipient": "who to message", "platform": "whatsapp/imessage/sms", "body_hint": "what to say" }\nReturn ONLY valid JSON, no markdown.`,
              },
              { role: "user", content: message },
            ],
            temperature: 0,
            max_tokens: 256,
          }),
        });

        const intentRaw = await intentExtract.json();
        const intentText = intentRaw.choices?.[0]?.message?.content || "{}";
        const intentClean = intentText.replace(/```json\n?|```/g, "").trim();
        let intentData = {};
        try { intentData = JSON.parse(intentClean); } catch { intentData = { raw: message }; }

        // Store as pending action
        const { data: newAction, error: actionErr } = await supabase.from("pending_actions").insert({
          user_id: user.id,
          action_type: detectedIntent,
          intent_data: intentData,
          status: "pending",
          source_message_id: `${metadata?.source === "voice" ? "voice" : "chat"}_${crypto.randomUUID()}`,
        }).select("id").single();

        if (actionErr) {
          console.error("[GEL] Failed to store pending action:", actionErr.message);
        } else {
          console.log(`[GEL] Stored pending ${detectedIntent}: ${JSON.stringify(intentData)}`);

          // Audit log
          await supabase.from("audit_log").insert({
            user_id: user.id,
            action: `gel_detect_${detectedIntent}`,
            table_name: "pending_actions",
            row_id: newAction?.id,
            details: { action_type: detectedIntent, intent_data: intentData, source: metadata?.source || "chat" },
          });

          // Inject confirmation instruction into system prompt
          systemPrompt += `\n\n## 🎯 ACTION DETECTED — CONFIRM WITH USER\nYou detected an actionable intent in the user's message. You MUST:\n1. Confirm what you understood: read back the action clearly\n2. Ask for explicit approval: "Should I go ahead?" or "Want me to set that?"\n3. Do NOT execute yet — wait for their confirmation\n- Action type: ${detectedIntent}\n- Extracted details: ${JSON.stringify(intentData)}\nBe natural and conversational. In voice mode, keep it brief.`;
        }
      } catch (intentErr) {
        console.error("[GEL] Intent extraction failed:", intentErr);
      }
    }

    console.log(`[CONTEXT] User: ${userName || "unknown"} | Facts: ${facts.length} | Decisions: ${decisions.length} | Patterns: ${patterns.length} | Memories: ${recentMems.length} | Semantic: ${semanticMems.length} | History: ${history.length} | Mode: ${response_mode || "batch"}`);

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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STREAMING MODE — Architecture v5.5, Section 4.7
    // Returns SSE events with tokens for sentence-level TTS streaming.
    // Post-processing runs after streaming completes.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (response_mode === "stream") {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let fullText = "";

          try {
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
                stream: true,
              }),
            });

            if (!llmResponse.ok || !llmResponse.body) {
              const errText = await llmResponse.text();
              console.error("[CHAT_STREAM] OpenAI error:", llmResponse.status, errText);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text: "I had trouble processing that. Please try again." })}\n\n`));
              controller.close();
              return;
            }

            const reader = llmResponse.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              sseBuffer += decoder.decode(value, { stream: true });
              const lines = sseBuffer.split("\n");
              sseBuffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const token = parsed.choices?.[0]?.delta?.content;
                  if (token) {
                    fullText += token;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`));
                  }
                } catch { /* skip malformed chunks */ }
              }
            }

            // ─── Post-processing after stream completes ───
            const assistantContent = fullText || "I couldn't process that. Please try again.";

            await runPostProcessing({
              supabase,
              userId: user.id,
              convoId,
              message,
              assistantContent,
              queryEmbedding,
              openaiKey,
              facts,
              decisions,
              patterns,
              recentMems,
              semanticMems,
              matchedPatternIds,
              situations,
              metadata: metadata || null,
            });

            // Final event with metadata
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              section_id: convoId,
              context_used: {
                facts: facts.length,
                decisions: decisions.length,
                patterns: patterns.length,
                memories: recentMems.length,
                semantic_matches: semanticMems.length,
                situations: situations.length,
              },
            })}\n\n`));
          } catch (streamErr) {
            console.error("[CHAT_STREAM] Stream error:", streamErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", text: "Something went wrong. Please try again." })}\n\n`));
          }

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BATCH MODE — Unchanged. Used by text chat (Home page).
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

    await runPostProcessing({
      supabase,
      userId: user.id,
      convoId,
      message,
      assistantContent,
      queryEmbedding,
      openaiKey,
      facts,
      decisions,
      patterns,
      recentMems,
      semanticMems,
      matchedPatternIds,
      situations,
      metadata: metadata || null,
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
    console.error("[CHAT] Top-level error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
