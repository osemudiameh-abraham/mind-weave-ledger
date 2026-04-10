import { useState, useCallback, useEffect } from "react";

export interface Section {
  id: string;
  name: string;
  createdAt: string;
  hidden: boolean;
  messages: { role: "user" | "ai"; text: string }[];
}

const STORAGE_KEY = "seven_sections";

const generateId = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

const generateName = (messages: { role: "user" | "ai"; text: string }[]) => {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Section";
  const words = firstUser.text.split(" ").slice(0, 5).join(" ");
  return words.length > 30 ? words.slice(0, 30) + "…" : words || "New Section";
};

export function useSections() {
  const [sections, setSections] = useState<Section[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeSectionId, setActiveSectionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("seven_active_section") || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    if (activeSectionId) {
      localStorage.setItem("seven_active_section", activeSectionId);
    } else {
      localStorage.removeItem("seven_active_section");
    }
  }, [activeSectionId]);

  const createSection = useCallback(() => {
    const newSection: Section = {
      id: generateId(),
      name: "New Section",
      createdAt: new Date().toISOString(),
      hidden: false,
      messages: [],
    };
    setSections((prev) => [newSection, ...prev]);
    setActiveSectionId(newSection.id);
    return newSection.id;
  }, []);

  const renameSection = useCallback((id: string, name: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  const deleteSection = useCallback(
    (id: string) => {
      setSections((prev) => prev.filter((s) => s.id !== id));
      if (activeSectionId === id) setActiveSectionId(null);
    },
    [activeSectionId]
  );

  const toggleHideSection = useCallback((id: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s)));
  }, []);

  const addMessage = useCallback(
    (sectionId: string, message: { role: "user" | "ai"; text: string }) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const updated = { ...s, messages: [...s.messages, message] };
          // Auto-name on first user message
          if (s.name === "New Section" && message.role === "user") {
            updated.name = generateName(updated.messages);
          }
          return updated;
        })
      );
    },
    []
  );

  const activeSection = sections.find((s) => s.id === activeSectionId) || null;
  const visibleSections = sections.filter((s) => !s.hidden);

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
  };
}
