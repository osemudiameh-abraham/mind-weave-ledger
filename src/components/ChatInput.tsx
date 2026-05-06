import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Send, Plus, Loader2, X, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LiveButton from "./LiveButton";
import VoiceOnboardingSheet from "./VoiceOnboardingSheet";
import DocumentPickerSheet from "./DocumentPickerSheet";
import LanguagePickerSheet from "./LanguagePickerSheet";
import { useDeepgramDictation } from "@/hooks/use-deepgram-dictation";
import {
  evaluateVoiceOnboarding,
  markOnboardingDismissed,
  markSurfaceUsed,
  getVoiceLanguage,
  type OnboardingDecision,
} from "@/lib/onboarding-triggers";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (text: string) => void;
  onLive?: () => void;
}

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/heif",
  "image/webp",
];

const MAX_STAGED_FILES = 3;

/**
 * A file currently staged in the input bar (sec.10.11.1). Each chip in
 * the bar above the textarea corresponds to one StagedFile. The lifecycle:
 *
 *   1. User picks file via DocumentPickerSheet -> StagedFile created with
 *      status "uploading", thumbnail blob URL if image
 *   2. Upload to Supabase Storage completes -> status moves to "processing"
 *   3. document-process Edge Function returns summary -> status moves to
 *      "ready", summary stored
 *   4. User submits message -> all "ready" files concatenated into the
 *      final message body, then staged list is cleared
 *   5. User clicks chip X at any stage -> file removed from staging
 *      (orphaned in storage; future cleanup cron handles)
 *
 *   On error at any stage: status moves to "error" and the chip shows a
 *   destructive treatment with a retry/remove option.
 */
type StagedFileStatus = "uploading" | "processing" | "ready" | "error";

interface StagedFile {
  /** Stable UUID for React key + chip removal lookups. */
  id: string;
  /** The original File object (used during upload; kept around for retry). */
  file: File;
  /** Blob URL for image thumbnail; revoked when chip is removed. */
  thumbnailUrl: string | null;
  /** documents.id once the row is created. */
  documentId: string | null;
  /** Extracted summary, populated when status becomes "ready". */
  summary: string | null;
  /** Current pipeline stage. */
  status: StagedFileStatus;
  /** Error message if status is "error". */
  errorMessage: string | null;
}

const ChatInput = ({ onSend, onLive }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [voiceSheet, setVoiceSheet] = useState<OnboardingDecision | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  // Voice language state. Reads from localStorage on mount via getVoiceLanguage
  // (defaults to "en" when nothing has been picked yet). Updated when the user
  // picks a different language via the chip-triggered LanguagePickerSheet.
  // Architecture v5.7 sec.4.14.4 + sec.1.5: the chip near the mic shows which
  // language Seven is currently listening for, and is always-tappable so the
  // user can change it without waiting for the onboarding sheet to re-trigger.
  const [language, setLanguage] = useState(() => getVoiceLanguage());
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const hasStaged = stagedFiles.length > 0;
  const anyUploading = stagedFiles.some((s) => s.status === "uploading" || s.status === "processing");
  const allReady = stagedFiles.every((s) => s.status === "ready");
  const canSend = !recording && (hasText || (hasStaged && allReady)) && !anyUploading;

  // ---------------------------------------------------------------------
  // Voice onboarding sheet (sec.4.13 v2 -- intent-triggered).
  // The mic onClick is intercepted: if onboarding-triggers says we should
  // show the sheet for this user (first-time / post-update / long-absence),
  // open it instead of starting recording. Recording starts on Continue.
  // If already-recording (toggle off) or sheet conditions don't fire, mic
  // click goes straight to setRecording toggle (preserves existing UX).
  // ---------------------------------------------------------------------
  const handleMicClick = useCallback(() => {
    // Stopping a recording in progress -- never show the sheet, just stop.
    if (recording) {
      setRecording(false);
      return;
    }
    // Starting fresh -- evaluate the trigger.
    const decision = evaluateVoiceOnboarding();
    if (decision.shouldShow) {
      setVoiceSheet(decision);
      return;
    }
    // No sheet needed. Mark used (so future evals know the user has used
    // voice) and start recording immediately.
    markSurfaceUsed("voice");
    setRecording(true);
  }, [recording]);

  const handleVoiceSheetContinue = useCallback(() => {
    if (voiceSheet) markOnboardingDismissed(voiceSheet);
    markSurfaceUsed("voice");
    setVoiceSheet(null);
    setRecording(true);
  }, [voiceSheet]);

  const handleVoiceSheetClose = useCallback(() => {
    if (voiceSheet) markOnboardingDismissed(voiceSheet);
    setVoiceSheet(null);
    // User declined. Do NOT start recording.
  }, [voiceSheet]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  /**
   * Submit the message. Architecture v5.7 sec.10.11.1: when files are
   * staged, compose the final message body as the user's typed text
   * followed by each ready file's summary in a fenced block. If no text
   * was typed but files are staged, fall back to a synthesized prefix so
   * Seven still has user intent ("I just uploaded X") -- this preserves
   * the prior behaviour for users who just want to ask about a file.
   */
  const handleSend = () => {
    if (!canSend) return;

    const userText = value.trim();
    const readyFiles = stagedFiles.filter((s) => s.status === "ready");

    let body: string;
    if (readyFiles.length === 0) {
      // Plain text message, no files attached.
      body = userText;
    } else {
      // One or more files staged. Build the file context block.
      const fileBlocks = readyFiles.map((s) => {
        const noun = s.file.type.startsWith("image/") ? "image" : "document";
        const summary = (s.summary ?? "").trim();
        return summary
          ? `[Attached ${noun}: ${s.file.name}]\n---\n${summary}\n---`
          : `[Attached ${noun}: ${s.file.name}]`;
      }).join("\n\n");

      if (userText) {
        // User typed alongside the file -- their words come first, file
        // context follows. This preserves user agency: they're asking
        // their own question, with the file as supporting context, not
        // having a question synthesized for them.
        body = `${userText}\n\n${fileBlocks}`;
      } else {
        // No text but files staged -- synthesize a minimal opener so
        // Seven has user intent. Same shape as legacy auto-submit but
        // user explicitly chose to send (not auto-fired on upload).
        const nouns = readyFiles.map((s) => s.file.type.startsWith("image/") ? "image" : "document");
        const allSame = nouns.every((n) => n === nouns[0]);
        const noun = allSame ? nouns[0] : "attachment";
        const plural = readyFiles.length > 1 ? `${noun}s` : noun;
        body = `I'm sharing ${readyFiles.length === 1 ? `a ${noun}` : `${readyFiles.length} ${plural}`}: ${readyFiles.map((s) => s.file.name).join(", ")}.\n\n${fileBlocks}\n\nWhat can you tell me?`;
      }
    }

    onSend(body);
    setValue("");
    // Revoke any thumbnail URLs to free memory, then clear staging.
    stagedFiles.forEach((s) => {
      if (s.thumbnailUrl) URL.revokeObjectURL(s.thumbnailUrl);
    });
    setStagedFiles([]);
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

  /**
   * DocumentPickerSheet returned a file. Validate, stage, and kick off
   * upload + processing. Each file gets its own StagedFile entry that
   * progresses through statuses without blocking other files or the
   * input bar.
   */
  const handlePickerFile = useCallback(async (file: File) => {
    setPickerOpen(false);

    // Validate file type
    const isMd = file.name.endsWith(".md");
    const isTxt = file.name.endsWith(".txt");
    if (!SUPPORTED_TYPES.includes(file.type) && !isMd && !isTxt) {
      toast.error("Unsupported file type. Seven accepts PDF, Word, Excel, CSV, text, and image files.");
      return;
    }

    // Validate size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Maximum 50MB.");
      return;
    }

    // Cap concurrent staged files
    if (stagedFiles.length >= MAX_STAGED_FILES) {
      toast.error(`You can attach up to ${MAX_STAGED_FILES} files at once.`);
      return;
    }

    // Build the StagedFile and add to state immediately so the chip appears
    // before the upload starts.
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const isImage = file.type.startsWith("image/");
    const thumbnailUrl = isImage ? URL.createObjectURL(file) : null;

    setStagedFiles((prev) => [...prev, {
      id,
      file,
      thumbnailUrl,
      documentId: null,
      summary: null,
      status: "uploading",
      errorMessage: null,
    }]);

    // Updater helper -- finds the staged file by id and applies a partial
    // update. Using the functional updater form so concurrent uploads
    // don't race each other's state.
    const updateStaged = (updates: Partial<StagedFile>) => {
      setStagedFiles((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
    };

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

      updateStaged({ documentId: doc.id, status: "processing" });

      // Trigger processing. The Edge Function awaits the full 10-step pipeline
      // and returns a summary we attach to the staged file. Unlike the prior
      // implementation, we do NOT auto-submit a chat message -- the user
      // composes their own message alongside the staged file.
      const { data: processData, error: processErr } = await supabase.functions.invoke("document-process", {
        body: { document_id: doc.id },
      });

      if (processErr) {
        throw processErr;
      }

      const summary: string = (processData?.summary as string | undefined)?.trim() || "";
      updateStaged({ summary, status: "ready" });
    } catch (err) {
      console.error("[DOC_UPLOAD] Pipeline failed:", err);
      const message = err instanceof Error ? err.message : "Upload failed";
      updateStaged({ status: "error", errorMessage: message });
      toast.error(`${file.name}: ${message}`);
    }
  }, [stagedFiles.length]);

  /**
   * Remove a staged file. Revokes the thumbnail blob URL to free memory.
   * The file in Supabase Storage stays orphaned (cleanup is a future cron).
   */
  const handleRemoveStaged = useCallback((id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.thumbnailUrl) URL.revokeObjectURL(target.thumbnailUrl);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  // Cleanup: revoke any remaining blob URLs on unmount.
  useEffect(() => {
    return () => {
      stagedFiles.forEach((s) => {
        if (s.thumbnailUrl) URL.revokeObjectURL(s.thumbnailUrl);
      });
    };
    // Intentionally only run on unmount; the staged files are tracked
    // internally and don't change identity in a way that needs re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    <div
      className="fixed left-0 right-0 z-40 px-3 pb-2 bg-background"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="max-w-[780px] mx-auto">
        {/* Staged-files chip row (sec.10.11.1). Renders ABOVE the input
            bar when one or more files are staged. Each chip shows the
            file's progress + a remove X. Chips are independent -- one
            file's error or upload doesn't block the others. */}
        <AnimatePresence>
          {hasStaged ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="mb-1.5 flex flex-wrap gap-1.5 px-1"
            >
              {stagedFiles.map((s) => (
                <StagedFileChip key={s.id} staged={s} onRemove={() => handleRemoveStaged(s.id)} />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="bg-card rounded-[28px] border border-border/50 shadow-[0_1px_3px_0_rgba(0,0,0,0.08)] flex items-end gap-1 px-2 py-1.5">
          {/* Attachment picker trigger -- opens DocumentPickerSheet */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={stagedFiles.length >= MAX_STAGED_FILES}
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 mb-0.5 disabled:opacity-50"
            aria-label="Add attachment"
          >
            <Plus size={20} aria-hidden="true" />
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
            placeholder={recording ? "Listening..." : anyUploading ? "Processing attachment..." : hasStaged ? "Add a question or send" : "Talk to Seven"}
            rows={1}
            aria-label="Message Seven"
            className="flex-1 bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground outline-none resize-none py-2 leading-relaxed min-h-[24px]"
          />

          {canSend ? (
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
              {/* Language chip -- always visible (when not recording) so the
                  user can always see and change which language Seven is
                  listening for. Architecture v5.7 sec.4.14.4 + sec.1.5
                  (Substrate Visibility Principle). Hidden while recording
                  so the active state isn't cluttered, hidden while files
                  are staging to give the chip-row above room. */}
              {!recording && !hasStaged ? (
                <button
                  type="button"
                  onClick={() => setLanguagePickerOpen(true)}
                  aria-label={`Speech language: ${language.toUpperCase()}. Tap to change.`}
                  className="h-7 px-2 rounded-full flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted transition-colors shrink-0 mb-1.5"
                >
                  {language.toUpperCase()}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleMicClick}
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

    <VoiceOnboardingSheet
      open={voiceSheet !== null}
      onContinue={handleVoiceSheetContinue}
      onClose={handleVoiceSheetClose}
    />

    <DocumentPickerSheet
      open={pickerOpen}
      onPick={handlePickerFile}
      onClose={() => setPickerOpen(false)}
    />

    <LanguagePickerSheet
      open={languagePickerOpen}
      currentLanguage={language}
      onSelect={(code) => setLanguage(code)}
      onClose={() => setLanguagePickerOpen(false)}
    />
    </>
  );
};

/**
 * Single chip in the staged-files row above the input bar (sec.10.11.1).
 * Shows thumbnail (image preview if image, FileText icon if document) +
 * filename truncated + status indicator + remove X.
 *
 * Status indicators:
 *   - uploading / processing: small Loader2 spinner, neutral border
 *   - ready:                  no indicator, neutral border, opacity 1
 *   - error:                  destructive border, error text
 */
interface StagedFileChipProps {
  staged: StagedFile;
  onRemove: () => void;
}

const StagedFileChip = ({ staged, onRemove }: StagedFileChipProps) => {
  const isImage = staged.file.type.startsWith("image/");
  const isPending = staged.status === "uploading" || staged.status === "processing";
  const isError = staged.status === "error";

  const containerClass = isError
    ? "border-destructive/50 bg-destructive/5"
    : "border-border/60 bg-card";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.16 }}
      className={`inline-flex items-center gap-2 pl-1.5 pr-1.5 py-1 rounded-2xl border ${containerClass} max-w-[260px]`}
    >
      {/* Thumbnail */}
      <div className="shrink-0 w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-muted/60 relative">
        {isImage && staged.thumbnailUrl ? (
          <img
            src={staged.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText size={16} className="text-muted-foreground" aria-hidden="true" />
        )}
        {isPending ? (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-white" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      {/* Filename + status */}
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-[12px] font-medium text-foreground truncate" title={staged.file.name}>
          {staged.file.name}
        </span>
        <span className={`text-[10px] truncate ${isError ? "text-destructive" : "text-muted-foreground"}`}>
          {staged.status === "uploading" ? "Uploading..." :
           staged.status === "processing" ? "Processing..." :
           staged.status === "ready" ? "Ready" :
           staged.errorMessage || "Failed"}
        </span>
      </div>

      {/* Remove X */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${staged.file.name}`}
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </motion.div>
  );
};

export default ChatInput;
