import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ThinkingStep } from "@/components/ThinkingTrace";

/**
 * Chat message as held by the UI.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.7 sec.10.9 rule 5
 * ("Every message implicitly carries a timestamp"). Every ChatMessage carries
 * a `createdAt` (ISO string). Two-stage population:
 *
 *   1. On send: client sets it to the local "now" -- optimistic, lets the UI
 *      render the timestamp immediately under the user's bubble while the
 *      server processes the request.
 *
 *   2. On stream done: the server returns `user_message_created_at` and
 *      `assistant_message_created_at` (ISO from postgres `default now()`).
 *      The client patches the optimistic user-message timestamp with the
 *      server-authoritative one and uses the server timestamp for Seven's
 *      reply.
 *
 * v5.7 ADDITIONS (2026-05-03 RDD E1/E6):
 *   - responseId: client-generated UUID per assistant message. Used as the
 *     soft-link target for feedback_signals.response_id (sec.10.10.8).
 *   - thinkingTrace: progress events accumulated during streaming
 *     (sec.10.10.7). Empty array until first progress event.
 *   - isStreaming: true from send() until the done event. UI uses this to
 *     disable affordances and switch render mode.
 *   - modelUsed: model that served the response (gpt-4o, claude-sonnet-4-6,
 *     etc.). Captured from done event metadata when available; used as
 *     response_metadata.model for feedback_signals.
 *   - contextUsed: per-message context counts (was top-level, now on the
 *     message itself for affordance-row display).
 */
export interface ContextUsed {
  facts: number;
  decisions: number;
  patterns: number;
  memories: number;
  semantic_matches?: number;
  situations?: number;
}

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  createdAt: string;
  /** Client-generated UUID for assistant messages. Used as feedback_signals
   *  .response_id soft-link. Absent on user messages. */
  responseId?: string;
  /** Streaming progress events for assistant messages. */
  thinkingTrace?: ThinkingStep[];
  /** True from send() until the SSE done event. */
  isStreaming?: boolean;
  /** Model that served the response (e.g. "gpt-4o"). */
  modelUsed?: string;
  /** Per-message context-used counts. */
  contextUsed?: ContextUsed;
}

interface ChatState {
  messages: ChatMessage[];
  sectionId: string | null;
  loading: boolean;
}

/**
 * Generate a UUIDv4 client-side for response_id. crypto.randomUUID is
 * available in all modern browsers and on iOS Safari 15.4+.
 */
function generateResponseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older browsers -- rare on the chat surface but defensive.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parse a Server-Sent Events buffer into individual events. SSE events
 * are separated by blank lines and each `data:` line carries the payload.
 * Returns parsed events and the unparsed remainder for the next chunk.
 */
function parseSSEBuffer(buffer: string): { events: unknown[]; remainder: string } {
  const events: unknown[] = [];
  // SSE event delimiter is exactly two newlines (\n\n).
  const blocks = buffer.split("\n\n");
  // The last block may be incomplete -- save as remainder.
  const remainder = blocks.pop() ?? "";
  for (const block of blocks) {
    // A block can have multiple `data:` lines per event spec, but our
    // chat function emits one data line per event. Concatenate just in
    // case of future change.
    const dataLines = block.split("\n").filter((line) => line.startsWith("data:"));
    if (dataLines.length === 0) continue;
    const dataPayload = dataLines.map((l) => l.slice(5).trimStart()).join("");
    if (!dataPayload) continue;
    try {
      events.push(JSON.parse(dataPayload));
    } catch (err) {
      console.warn("[CHAT_STREAM] Failed to parse SSE data:", dataPayload.slice(0, 80), err);
    }
  }
  return { events, remainder };
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    sectionId: null,
    loading: false,
  });

  const sendMessage = useCallback(async (text: string) => {
    // Optimistic insert: stamp with the client's current ISO time so the
    // user sees the timestamp immediately. The server will return the
    // authoritative timestamp via the done event.
    const optimisticUserCreatedAt = new Date().toISOString();
    const responseId = generateResponseId();
    const assistantOptimisticCreatedAt = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        { role: "user", text, createdAt: optimisticUserCreatedAt },
        // Assistant stub created up-front. Empty text accumulates as tokens
        // arrive. isStreaming flips false on done. thinkingTrace populates
        // as progress events arrive.
        {
          role: "ai",
          text: "",
          createdAt: assistantOptimisticCreatedAt,
          responseId,
          thinkingTrace: [],
          isStreaming: true,
        },
      ],
      loading: true,
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const functionUrl = `${supabaseUrl}/functions/v1/chat`;

      // Direct fetch + SSE consumption. supabase.functions.invoke does not
      // expose the underlying ReadableStream so we make the call manually.
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          section_id: state.sectionId,
          response_mode: "stream",
          client_context: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: navigator.language,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Chat function returned ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      if (!response.body) {
        throw new Error("Chat function returned no body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let doneSeen = false;

      while (!doneSeen) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSEBuffer(buffer);
        buffer = remainder;

        for (const ev of events) {
          if (typeof ev !== "object" || ev === null || !("type" in ev)) continue;
          const event = ev as { type: string; [key: string]: unknown };

          if (event.type === "token" && typeof event.text === "string") {
            const tokenText = event.text;
            setState((prev) => {
              const msgs = [...prev.messages];
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === "ai" && msgs[i].responseId === responseId) {
                  msgs[i] = { ...msgs[i], text: msgs[i].text + tokenText };
                  break;
                }
              }
              return { ...prev, messages: msgs };
            });
          } else if (event.type === "progress" && typeof event.step === "string") {
            const step = event.step as ThinkingStep["step"];
            const detail = typeof event.detail === "string" ? event.detail : undefined;
            const startedAt = new Date().toISOString();
            setState((prev) => {
              const msgs = [...prev.messages];
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === "ai" && msgs[i].responseId === responseId) {
                  const trace = msgs[i].thinkingTrace ?? [];
                  msgs[i] = {
                    ...msgs[i],
                    thinkingTrace: [...trace, { step, detail, startedAt }],
                  };
                  break;
                }
              }
              return { ...prev, messages: msgs };
            });
          } else if (event.type === "done") {
            doneSeen = true;
            const userServerTs = typeof event.user_message_created_at === "string"
              ? event.user_message_created_at
              : null;
            const assistantServerTs = typeof event.assistant_message_created_at === "string"
              ? event.assistant_message_created_at
              : null;
            const sectionId = typeof event.section_id === "string" ? event.section_id : null;
            const contextUsed = (event.context_used as ContextUsed | undefined) ?? undefined;
            const modelUsed = typeof event.model_used === "string" ? event.model_used : undefined;

            setState((prev) => {
              const msgs = [...prev.messages];
              // Patch the most recent user message with the server timestamp.
              if (userServerTs) {
                for (let i = msgs.length - 1; i >= 0; i--) {
                  if (msgs[i].role === "user" && msgs[i].text === text) {
                    msgs[i] = { ...msgs[i], createdAt: userServerTs };
                    break;
                  }
                }
              }
              // Patch the assistant message with server timestamp + finalize.
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === "ai" && msgs[i].responseId === responseId) {
                  msgs[i] = {
                    ...msgs[i],
                    createdAt: assistantServerTs ?? msgs[i].createdAt,
                    isStreaming: false,
                    contextUsed,
                    modelUsed,
                  };
                  break;
                }
              }
              return {
                ...prev,
                messages: msgs,
                sectionId: sectionId ?? prev.sectionId,
                loading: false,
              };
            });
          } else if (event.type === "error") {
            const errorText = typeof event.text === "string" ? event.text : "Something went wrong.";
            console.error("[CHAT_STREAM] Server error event:", errorText);
            setState((prev) => {
              const msgs = [...prev.messages];
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === "ai" && msgs[i].responseId === responseId) {
                  msgs[i] = {
                    ...msgs[i],
                    text: msgs[i].text || errorText,
                    isStreaming: false,
                  };
                  break;
                }
              }
              return { ...prev, messages: msgs, loading: false };
            });
            doneSeen = true;
          }
        }
      }

      try { reader.releaseLock(); } catch { /* already released */ }
    } catch (err) {
      console.error("Chat error:", err);
      setState((prev) => {
        const msgs = [...prev.messages];
        // Replace the streaming assistant stub with a graceful error.
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "ai" && msgs[i].responseId === responseId) {
            msgs[i] = {
              ...msgs[i],
              text: msgs[i].text || "Something went wrong. Please try again.",
              isStreaming: false,
            };
            break;
          }
        }
        return { ...prev, messages: msgs, loading: false };
      });
    }
  }, [state.sectionId]);

  /**
   * Re-send the user message that preceded the given assistant message.
   * Used by the per-message Regenerate affordance (Architecture v5.7
   * sec.10.10.6). Drops the assistant message + everything after, then
   * re-submits the user message. Server will produce a new response.
   */
  const regenerate = useCallback(async (assistantResponseId: string) => {
    let userText: string | null = null;

    setState((prev) => {
      const idx = prev.messages.findIndex((m) => m.role === "ai" && m.responseId === assistantResponseId);
      if (idx === -1 || idx === 0) return prev;
      const userMsg = prev.messages[idx - 1];
      if (userMsg.role !== "user") return prev;
      userText = userMsg.text;
      // Drop the assistant message + anything after.
      return {
        ...prev,
        messages: prev.messages.slice(0, idx),
      };
    });

    if (userText) {
      // Drop the user message too -- sendMessage will re-add it as optimistic.
      setState((prev) => {
        const msgs = [...prev.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "user" && msgs[msgs.length - 1].text === userText) {
          msgs.pop();
        }
        return { ...prev, messages: msgs };
      });
      await sendMessage(userText);
    }
  }, [sendMessage]);

  /**
   * Edit a user message in place and re-submit. Used by per-message Edit
   * affordance (sec.10.10.6). Replaces the message text on the previous
   * user message + drops everything after it, then re-submits.
   */
  const editAndResend = useCallback(async (assistantResponseId: string, newText: string) => {
    setState((prev) => {
      const idx = prev.messages.findIndex((m) => m.role === "ai" && m.responseId === assistantResponseId);
      if (idx === -1 || idx === 0) return prev;
      // Drop everything from the user message onward; sendMessage will re-insert.
      return {
        ...prev,
        messages: prev.messages.slice(0, idx - 1),
      };
    });
    await sendMessage(newText);
  }, [sendMessage]);

  const loadSection = useCallback(async (sectionId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("section_id", sectionId)
      .order("created_at", { ascending: true });

    if (data) {
      setState({
        messages: data.map((m) => ({
          role: m.role === "assistant" ? "ai" as const : "user" as const,
          text: m.content,
          createdAt: m.created_at ?? "",
          // Historical messages: synthesize a responseId from the DB row id
          // so per-message affordances have a stable target. Real-time
          // streamed messages keep their client-generated UUID.
          responseId: m.role === "assistant" ? `db:${m.id}` : undefined,
          thinkingTrace: [],
          // Historical messages don't carry model_used (column doesn't exist
          // on messages table). Live SSE messages still receive modelUsed
          // from the chat function's done event. Future schema bundle may
          // add messages.model_used + chat function persistence for fuller
          // historical analytics.
          isStreaming: false,
        })),
        sectionId,
        loading: false,
      });
    }
  }, []);

  const newSection = useCallback(() => {
    setState({
      messages: [],
      sectionId: null,
      loading: false,
    });
  }, []);

  return {
    messages: state.messages,
    sectionId: state.sectionId,
    loading: state.loading,
    sendMessage,
    regenerate,
    editAndResend,
    loadSection,
    newSection,
  };
}
