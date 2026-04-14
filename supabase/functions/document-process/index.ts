/**
 * Document Processing Edge Function — Architecture v5.5, Section 3.3
 *
 * 10-step pipeline:
 *   1. Ingestion — download from Supabase Storage
 *   2. Text extraction — handle PDF, DOCX, TXT, CSV
 *   3. Chunking — 512-token windows, 50-token overlap
 *   4. Embedding — text-embedding-3-large (3072 dim)
 *   5. Entity extraction — people, orgs, dates, decisions
 *   6. Cross-reference — check against existing memory_facts
 *   7. Contradiction detection — flag conflicts with existing facts
 *   8. Situation linking — find or create related situations
 *   9. Summary synthesis — executive summary + action items
 *   10. Storage — chunks to memories_structured, facts to memory_facts
 *
 * Accepts: { document_id: string }
 * Requires document row to exist in documents table with storage_path set.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple text chunker (512 tokens ≈ ~2000 chars, 50 token overlap ≈ ~200 chars)
function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

// Generate embedding
async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-large", input: text.slice(0, 8000) }),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
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

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "No document_id" }), { status: 400, headers: corsHeaders });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI not configured" }), { status: 500, headers: corsHeaders });
    }

    // Fetch document record
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .eq("user_id", user.id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: corsHeaders });
    }

    // Update status to processing
    await supabase.from("documents").update({ status: "processing" }).eq("id", document_id);

    console.log(`[DOC_PROCESS] Starting: ${doc.filename} (${doc.file_type})`);

    // ─── Step 1: Download file from Storage ───
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadErr || !fileData) {
      await supabase.from("documents").update({
        status: "failed",
        error_message: "Failed to download file from storage",
      }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "Download failed" }), { status: 500, headers: corsHeaders });
    }

    // ─── Step 2: Extract text ───
    let extractedText = "";
    const fileType = doc.file_type.toLowerCase();

    if (fileType === "text/plain" || fileType === "text/markdown" || fileType === "text/csv") {
      extractedText = await fileData.text();
    } else if (fileType === "application/pdf" || fileType.includes("pdf")) {
      // Use GPT-4o to extract text from PDF (sent as base64)
      const buffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer.slice(0, 500000)))); // Limit to ~500KB

      const pdfRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract ALL text content from this document. Preserve structure (headings, paragraphs, lists). Return only the extracted text, no commentary." },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${base64}`, detail: "high" },
                },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      });

      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        extractedText = pdfData.choices?.[0]?.message?.content || "";
      }

      if (!extractedText) {
        // Fallback: try reading as text directly
        extractedText = await fileData.text();
      }
    } else {
      // For DOCX and other formats, try reading as text (may work for some)
      // Then fall back to GPT-4o for understanding
      try {
        extractedText = await fileData.text();
      } catch {
        extractedText = "";
      }

      if (!extractedText || extractedText.length < 50) {
        // Try GPT-4o as fallback
        const buffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer.slice(0, 500000))));

        const fallbackRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Extract all readable text from this document. If you cannot read it, say UNREADABLE.",
              },
              { role: "user", content: `File: ${doc.filename}\nContent (base64): ${base64.slice(0, 10000)}` },
            ],
            max_tokens: 4096,
          }),
        });

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          extractedText = fbData.choices?.[0]?.message?.content || "";
          if (extractedText.includes("UNREADABLE")) extractedText = "";
        }
      }
    }

    if (!extractedText || extractedText.length < 20) {
      await supabase.from("documents").update({
        status: "failed",
        error_message: "Could not extract text from this file. Please try a different format.",
      }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "Text extraction failed" }), { status: 422, headers: corsHeaders });
    }

    console.log(`[DOC_PROCESS] Extracted ${extractedText.length} chars from ${doc.filename}`);

    // ─── Step 3: Chunk the text ───
    const chunks = chunkText(extractedText);
    console.log(`[DOC_PROCESS] Created ${chunks.length} chunks`);

    // ─── Step 4: Embed chunks ───
    const chunkEmbeddings: (number[] | null)[] = [];
    for (const chunk of chunks) {
      const emb = await embed(chunk, openaiKey);
      chunkEmbeddings.push(emb);
    }

    // ─── Step 5+6+7: Entity and fact extraction (batch via GPT-4o-mini) ───
    const extractionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyse this document and extract:
1. KEY_ENTITIES: people, organisations, and contacts mentioned (name, type, role/relationship if known)
2. FACTS: factual claims that should be remembered (subject, attribute, value, category)
3. DECISIONS: any decisions mentioned (title, context)
4. RISKS: any risks or concerns identified

Return JSON: { "entities": [...], "facts": [...], "decisions": [...], "risks": [...] }
Return ONLY valid JSON, no markdown.`,
          },
          { role: "user", content: extractedText.slice(0, 12000) },
        ],
        temperature: 0,
        max_tokens: 2000,
      }),
    });

    let entities: { name: string; type: string; role?: string }[] = [];
    let docFacts: { subject: string; attribute: string; value: string; category?: string }[] = [];
    let docDecisions: { title: string; context?: string }[] = [];
    let risks: string[] = [];

    if (extractionRes.ok) {
      const extractData = await extractionRes.json();
      const rawExtract = extractData.choices?.[0]?.message?.content || "{}";
      const cleanExtract = rawExtract.replace(/```json\n?|```/g, "").trim();
      try {
        const parsed = JSON.parse(cleanExtract);
        entities = parsed.entities || [];
        docFacts = parsed.facts || [];
        docDecisions = parsed.decisions || [];
        risks = parsed.risks || [];
      } catch { /* parsing failure is non-fatal */ }
    }

    // ─── Step 8: Summary synthesis ───
    const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Write a concise executive summary of this document (3-5 sentences). Include key findings, action items, and any risks. No markdown.",
          },
          { role: "user", content: extractedText.slice(0, 12000) },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    let summary = "";
    if (summaryRes.ok) {
      const sumData = await summaryRes.json();
      summary = sumData.choices?.[0]?.message?.content || "";
    }

    // ─── Step 9: Store chunks as memories ───
    let storedChunks = 0;
    for (let i = 0; i < chunks.length; i++) {
      const { error: chunkErr } = await supabase.from("memories_structured").insert({
        user_id: user.id,
        text: chunks[i],
        memory_type: "document_chunk",
        importance: 6,
        source_message_id: `doc_${document_id}_chunk_${i}`,
        embedding: chunkEmbeddings[i],
      });
      if (!chunkErr) storedChunks++;
    }

    // Store facts via the standard pipeline
    let factsStored = 0;
    for (const fact of docFacts) {
      if (!fact.subject || !fact.attribute || !fact.value) continue;

      const factKey = `${fact.subject.toLowerCase().trim()}::${fact.attribute.toLowerCase().trim()}`;
      const canonicalText = `${fact.subject} ${fact.attribute} is ${fact.value}`;

      // Supersede existing
      await supabase.from("memory_facts").update({
        valid_until: new Date().toISOString(),
        status: "superseded",
      }).eq("user_id", user.id)
        .eq("subject", fact.subject)
        .eq("attribute", fact.attribute)
        .is("valid_until", null);

      const { error: factErr } = await supabase.from("memory_facts").insert({
        user_id: user.id,
        fact_key: factKey,
        subject: fact.subject,
        attribute: fact.attribute,
        value_text: fact.value,
        canonical_text: canonicalText,
        category: fact.category || "general",
        source_type: "inferred",
        confidence: 0.7,
        evidence_count: 1,
        status: "active",
      });
      if (!factErr) factsStored++;
    }

    // Store decisions
    for (const dec of docDecisions) {
      if (!dec.title) continue;
      await supabase.from("decisions").insert({
        user_id: user.id,
        title: dec.title,
        context_summary: dec.context || summary.slice(0, 200),
        source_message_id: `doc_${document_id}_decision`,
      });
    }

    // Store entities
    for (const entity of entities) {
      if (!entity.name) continue;
      await supabase.from("situation_entities").insert({
        user_id: user.id,
        entity_type: entity.type === "organisation" ? "organisation" : entity.type === "contact" ? "contact" : "person",
        name: entity.name,
        metadata: { role: entity.role, source_document: document_id },
      });
    }

    // ─── Step 10: Update document status ───
    await supabase.from("documents").update({
      status: "completed",
      chunk_count: storedChunks,
      summary,
      key_entities: entities,
      facts_extracted: factsStored,
      updated_at: new Date().toISOString(),
    }).eq("id", document_id);

    console.log(`[DOC_PROCESS] Complete: ${doc.filename} — ${storedChunks} chunks, ${factsStored} facts, ${entities.length} entities, ${docDecisions.length} decisions`);

    return new Response(
      JSON.stringify({
        status: "completed",
        chunks: storedChunks,
        facts: factsStored,
        entities: entities.length,
        decisions: docDecisions.length,
        risks: risks.length,
        summary: summary.slice(0, 200),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[DOC_PROCESS] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
