import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
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
    // Add user message immediately
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "user", text }],
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

      const data = response.data;

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "ai", text: data.response }],
        sectionId: data.section_id,
        loading: false,
        contextUsed: data.context_used,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role: "ai", text: "Something went wrong. Please try again." },
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
