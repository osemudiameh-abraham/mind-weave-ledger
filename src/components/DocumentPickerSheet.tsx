import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, FileText, X } from "lucide-react";
import { useRef } from "react";

/**
 * DocumentPickerSheet -- Architecture v5.7 sec.10.11.1.
 *
 * Three-option picker that replaces the single broken "+" file input. Each
 * option triggers a hidden <input type="file"> with a specific accept and
 * (for Camera) capture attribute, so the OS picker shows the right tool
 * without ambiguity:
 *
 *   - Camera: capture="environment" forces device camera on mobile
 *   - Photos: accept="image/*" opens gallery picker
 *   - Files:  accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls" opens
 *             documents-only picker (no images -- they go through the
 *             Camera/Photos paths so users always know what they're picking)
 *
 * Selected file is returned via onPick(file). Caller owns staging logic
 * (chip-in-bar, upload, processing, submit-with-message). This component
 * is purely the picker UI.
 *
 * Form factor:
 *   Mobile (<= 640px): slide up from bottom, partial height
 *   Desktop (> 640px): centered modal (uses the same dim+blur backdrop +
 *     flex-center pattern from OnboardingSheet to avoid the C67
 *     motion-vs-Tailwind transform conflict)
 */

interface DocumentPickerSheetProps {
  open: boolean;
  onPick: (file: File) => void;
  onClose: () => void;
}

const DOCS_ACCEPT = ".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const DocumentPickerSheet = ({ open, onPick, onClose }: DocumentPickerSheetProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be picked again next time.
    e.target.value = "";
    if (!file) return;
    onPick(file);
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Mobile: bottom sheet */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/40 sm:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Choose attachment source"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-0 right-0 bottom-0 z-[101] sm:hidden bg-background rounded-t-3xl shadow-2xl flex flex-col"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-[16px] font-semibold text-foreground">Add attachment</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted transition-colors text-foreground"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <PickerRows
              cameraInputRef={cameraInputRef}
              photosInputRef={photosInputRef}
              filesInputRef={filesInputRef}
            />
          </motion.div>

          {/* Desktop: centered modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm hidden sm:flex sm:items-center sm:justify-center sm:p-4"
            onClick={onClose}
            aria-hidden="true"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Choose attachment source"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[400px] max-w-full rounded-3xl bg-background flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-[16px] font-semibold text-foreground">Add attachment</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 hover:bg-muted transition-colors text-foreground"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <PickerRows
                cameraInputRef={cameraInputRef}
                photosInputRef={photosInputRef}
                filesInputRef={filesInputRef}
              />
            </motion.div>
          </motion.div>

          {/* Hidden inputs (rendered once at root level so refs survive layout) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
            aria-hidden="true"
          />
          <input
            ref={photosInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            aria-hidden="true"
          />
          <input
            ref={filesInputRef}
            type="file"
            accept={DOCS_ACCEPT}
            onChange={handleFile}
            className="hidden"
            aria-hidden="true"
          />
        </>
      ) : null}
    </AnimatePresence>
  );
};

interface PickerRowsProps {
  cameraInputRef: React.RefObject<HTMLInputElement>;
  photosInputRef: React.RefObject<HTMLInputElement>;
  filesInputRef: React.RefObject<HTMLInputElement>;
}

const PickerRows = ({ cameraInputRef, photosInputRef, filesInputRef }: PickerRowsProps) => (
  <div className="px-2 pb-3">
    <PickerRow
      icon={Camera}
      label="Camera"
      hint="Take a new photo"
      onClick={() => cameraInputRef.current?.click()}
    />
    <PickerRow
      icon={ImageIcon}
      label="Photos"
      hint="Pick from your library"
      onClick={() => photosInputRef.current?.click()}
    />
    <PickerRow
      icon={FileText}
      label="Files"
      hint="PDF, Word, Excel, text"
      onClick={() => filesInputRef.current?.click()}
    />
  </div>
);

interface PickerRowProps {
  icon: typeof Camera;
  label: string;
  hint: string;
  onClick: () => void;
}

const PickerRow = ({ icon: Icon, label, hint, onClick }: PickerRowProps) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/50 transition-colors text-left"
  >
    <span className="shrink-0 w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-foreground">
      <Icon size={20} aria-hidden="true" />
    </span>
    <span className="flex-1 flex flex-col">
      <span className="text-[15px] font-medium text-foreground">{label}</span>
      <span className="text-[12px] text-muted-foreground">{hint}</span>
    </span>
  </button>
);

export default DocumentPickerSheet;
