import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Send, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import LiveButton from "./LiveButton";
import { useDeepgramDictation } from "@/hooks/use-deepgram-dictation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (text: string) => void;
  onLive?: () => void;
}

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

const ChatInput = ({ onSend, onLive }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSend = () => {
    if (!hasText) return;
    onSend(value.trim());
    setValue("");
  };

  // Deepgram dictation
  const onInterim = useCallback((text: string) => {
    setValue(text);
  }, []);

  const onFinal = useCallback((text: string) => {
    setValue(text);
    setRecording(false);
  }, []);

  useDeepgramDictation({
    active: recording,
    onInterim,
    onFinal,
  });

  // File upload handler (Architecture Section 3.3)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    // Validate file type
    if (!SUPPORTED_TYPES.includes(file.type) && !file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast.error("Unsupported file type. Seven accepts PDF, Word, Excel, CSV, text, and image files.");
      return;
    }

    // Validate size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum 50MB.");
      return;
    }

    setUploading(true);
    toast.info(`Uploading ${file.name}...`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      // Upload to Supabase Storage
      const storagePath = `${session.user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, file);

      if (uploadErr) throw uploadErr;

      // Create document record
      const { data: doc, error: docErr } = await supabase.from("documents").insert({
        user_id: session.user.id,
        filename: file.name,
        file_type: file.type || "application/octet-stream",
        storage_path: storagePath,
        status: "uploading",
      }).select("id").single();

      if (docErr || !doc) throw docErr || new Error("Failed to create document record");

      toast.info(`Processing ${file.name}...`);

      // Trigger processing
      const { error: processErr } = await supabase.functions.invoke("document-process", {
        body: { document_id: doc.id },
      });

      if (processErr) {
        toast.error(`Failed to process ${file.name}`);
        console.error("[DOC_UPLOAD] Processing failed:", processErr);
      } else {
        // Send a message about the uploaded document
        onSend(`I just uploaded a document: ${file.name}. What can you tell me about it?`);
        toast.success(`${file.name} processed successfully`);
      }
    } catch (err) {
      console.error("[DOC_UPLOAD] Upload failed:", err);
      toast.error("Upload failed. Please try again.");
    }

    setUploading(false);
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 px-3 pb-2 bg-background"
      style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="max-w-[780px] mx-auto">
        <div className="bg-card rounded-[28px] border border-border/50 shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] flex items-end gap-1 px-2 py-1.5">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileSelect}
            aria-hidden="true"
            tabIndex={-1}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 mb-0.5 disabled:opacity-50"
            aria-label={uploading ? "Uploading document" : "Upload document"}
          >
            {uploading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
          </button>

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={recording ? "Listening…" : uploading ? "Processing document…" : "Talk to Seven"}
            rows={1}
            aria-label="Message Seven"
            className="flex-1 bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground outline-none resize-none py-2 leading-relaxed min-h-[24px]"
          />

          {hasText && !recording ? (
            <motion.button
              type="button"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleSend}
              aria-label="Send message"
              className="w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center shrink-0 mb-0.5"
            >
              <Send size={16} aria-hidden="true" />
            </motion.button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRecording((r) => !r)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shrink-0 mb-0.5 ${
                  recording ? "bg-destructive/15 text-destructive animate-pulse" : "text-muted-foreground hover:bg-muted"
                }`}
                aria-label={recording ? "Stop recording" : "Start voice input"}
                aria-pressed={recording}
              >
                {recording ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
              </button>
              {onLive && <LiveButton onClick={onLive} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
