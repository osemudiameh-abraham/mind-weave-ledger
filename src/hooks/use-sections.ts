import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface Section {
  id: string;
  name: string;
  createdAt: string;
  is_archived: boolean;
  messageCount: number;
  messages: { role: "user" | "ai"; text: string }[];
}

export function useSections() {
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Load conversations from Supabase. Extracted into a callback so the caller
  // (e.g. Home after sending a chat message) can re-sync after the DB trigger
  // updates message_count — without this, the sidebar's per-section count
  // stays stale until the next page load.
  const refreshSections = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("sections")
      .select("id, title, is_archived, message_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setSections(
        data.map((c) => ({
          id: c.id,
          name: c.title || "New Section",
          createdAt: c.created_at,
          is_archived: c.is_archived || false,
          messageCount: c.message_count || 0,
          messages: [], // Messages loaded separately when conversation selected
        }))
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshSections();
  }, [user, refreshSections]);

  const createSection = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("sections")
      .insert({ user_id: user.id, title: "New Section" })
      .select("id, title, is_archived, message_count, created_at")
      .single();

    if (data) {
      const newSection: Section = {
        id: data.id,
        name: data.title,
        createdAt: data.created_at,
        is_archived: false,
        messageCount: data.message_count || 0,
        messages: [],
      };
      setSections((prev) => [newSection, ...prev]);
      setActiveSectionId(data.id);
      return data.id;
    }
    return null;
  }, [user]);

  const renameSection = useCallback(async (id: string, name: string) => {
    await supabase.from("sections").update({ title: name }).eq("id", id);
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  const deleteSection = useCallback(async (id: string) => {
    await supabase.from("sections").delete().eq("id", id);
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (activeSectionId === id) setActiveSectionId(null);
  }, [activeSectionId]);

  const toggleHideSection = useCallback(async (id: string) => {
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    await supabase.from("sections").update({ is_archived: !section.is_archived }).eq("id", id);
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, is_archived: !s.is_archived } : s)));
  }, [sections]);

  const addMessage = useCallback(
    (_sectionId: string, _message: { role: "user" | "ai"; text: string }) => {
      // No-op: messages now handled by useChat hook and stored in messages table
    },
    []
  );

  const activeSection = sections.find((s) => s.id === activeSectionId) || null;
  const visibleSections = sections.filter((s) => !s.is_archived);

  return {
    sections,
    visibleSections,
    activeSection,
    activeSectionId,
    setActiveSectionId,
    createSection,
    renameSection,
    deleteSection,
    toggleHideSection,
    addMessage,
    refreshSections,
  };
}
