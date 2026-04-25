import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Chat message as held by the UI.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.7 §10.9 rule 5
 * ("Every message implicitly carries a timestamp"). Every ChatMessage carries
 * a `createdAt` (ISO string). Two-stage population:
 *
 *   1. On send: client sets it to the local "now" — optimistic, lets the UI
 *      render the timestamp immediately under the user's bubble while the
 *      server processes the request.
 *
 *   2. On response: the server returns `user_message_created_at` and
 *      `assistant_message_created_at` (ISO from postgres `default now()`).
 *      The client patches the optimistic user-message timestamp with the
 *      server-authoritative one and uses the server timestamp for Seven's
 *      reply. This eliminates clock-skew drift between user devices and
 *      keeps memory blocks (which the chat function injects via
 *      formatRelativeMessageTime) consistent with what the UI displays.
 */
interface ChatMessage {
  role: "user" | "ai";
  text: string;
  /** ISO 8601 timestamp. Client-set on optimistic insert, replaced with
   *  server-authoritative value when the response arrives. */
  createdAt: string;
}

interface ChatState {
  messages: ChatMessage[];
  sectionId: string | null;
  loading: boolean;
  contextUsed: { facts: number; decisions: number; patterns: number; memories: number } | null;
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    sectionId: null,
    loading: false,
    contextUsed: null,
  });

  const sendMessage = useCallback(async (text: string) => {
    // Optimistic insert: stamp with the client's current ISO time so the
    // user sees the timestamp immediately. The server will return the
    // authoritative timestamp, which we patch in below.
    const optimisticUserCreatedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        { role: "user", text, createdAt: optimisticUserCreatedAt },
      ],
      loading: true,
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("chat", {
        body: {
          message: text,
          section_id: state.sectionId,
          // Client context for time/locale awareness (Architecture Section 3.5).
          // Kept minimal: timezone + locale. Server uses these to compute the
          // user's local time and frame responses with correct day/date.
          client_context: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: navigator.language,
          },
        },
      });

      if (response.error) throw response.error;

      const data = response.data as {
        response: string;
        section_id: string;
        user_message_created_at: string | null;
        assistant_message_created_at: string | null;
        context_used: { facts: number; decisions: number; patterns: number; memories: number } | null;
      };

      // Patch the user message timestamp with the server-authoritative value
      // when present, then append Seven's reply. If the server didn't return
      // a timestamp (defensive — shouldn't happen post-B3.2 but the chat
      // function may transiently lag during deploy), keep the optimistic one
      // and stamp Seven's reply with `now()` as a last-resort fallback.
      const assistantCreatedAt =
        data.assistant_message_created_at ?? new Date().toISOString();

      setState((prev) => {
        const patchedMessages = [...prev.messages];
        if (data.user_message_created_at) {
          // Find the most recent user message that matches this send and
          // replace its createdAt with the server value. We match by content
          // + role to handle the (rare) case where multiple sends queued
          // before the first response landed.
          for (let i = patchedMessages.length - 1; i >= 0; i--) {
            const m = patchedMessages[i];
            if (m.role === "user" && m.text === text) {
              patchedMessages[i] = { ...m, createdAt: data.user_message_created_at };
              break;
            }
          }
        }
        return {
          ...prev,
          messages: [
            ...patchedMessages,
            { role: "ai", text: data.response, createdAt: assistantCreatedAt },
          ],
          sectionId: data.section_id,
          loading: false,
          contextUsed: data.context_used,
        };
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "ai",
            text: "Something went wrong. Please try again.",
            createdAt: new Date().toISOString(),
          },
        ],
        loading: false,
      }));
      console.error("Chat error:", err);
    }
  }, [state.sectionId]);

  const loadSection = useCallback(async (sectionId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("section_id", sectionId)
      .order("created_at", { ascending: true });

    if (data) {
      setState({
        messages: data.map((m) => ({
          role: m.role === "assistant" ? "ai" as const : "user" as const,
          text: m.content,
          // created_at is non-null in the DB (`default now()`), but TypeScript
          // sees it as nullable from the .select(). Fall back to empty string
          // — the UI treats falsy createdAt as "no timestamp", consistent
          // with the server-side null contract.
          createdAt: m.created_at ?? "",
        })),
        sectionId,
        loading: false,
        contextUsed: null,
      });
    }
  }, []);

  const newSection = useCallback(() => {
    setState({
      messages: [],
      sectionId: null,
      loading: false,
      contextUsed: null,
    });
  }, []);

  return {
    messages: state.messages,
    sectionId: state.sectionId,
    loading: state.loading,
    contextUsed: state.contextUsed,
    sendMessage,
    loadSection,
    newSection,
  };
}
