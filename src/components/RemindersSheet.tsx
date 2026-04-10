import { useState } from "react";
import { format } from "date-fns";
import { Bell, Plus, Sparkles, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/hooks/use-reminders";

interface RemindersSheetProps {
  reminders: Reminder[];
  unseenCount: number;
  onAdd: (title: string, dueAt: Date, description?: string) => void;
  onDismiss: (id: string) => void;
  onMarkAllSeen: () => void;
}

const RemindersSheet = ({ reminders, unseenCount, onAdd, onDismiss, onMarkAllSeen }: RemindersSheetProps) => {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>();
  const [open, setOpen] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) onMarkAllSeen();
  };

  const handleAdd = () => {
    if (!title.trim() || !date) return;
    onAdd(title.trim(), date);
    setTitle("");
    setDate(undefined);
    setAdding(false);
  };

  const sorted = [...reminders].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <button className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
          <Bell size={20} className="text-foreground/70" />
          {unseenCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
            >
              {unseenCount > 9 ? "9+" : unseenCount}
            </motion.span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[18px] font-semibold">Reminders</SheetTitle>
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)} className="h-8 gap-1.5 text-primary">
              <Plus size={16} /> New
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[calc(100vh-120px)]">
          {/* Add form */}
          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3 mb-3">
                  <Input
                    placeholder="What should I remind you about?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-[14px]"
                    autoFocus
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left text-[13px]", !date && "text-muted-foreground")}
                      >
                        {date ? format(date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAdd} disabled={!title.trim() || !date} className="flex-1">
                      Add reminder
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reminders list */}
          {sorted.length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell size={32} className="mb-3 opacity-40" />
              <p className="text-[14px]">No reminders yet</p>
              <p className="text-[12px] mt-1">Tap "New" to create one</p>
            </div>
          ) : (
            <AnimatePresence>
              {sorted.map((r) => {
                const isPast = new Date(r.dueAt) <= new Date();
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className={cn(
                      "rounded-2xl border p-4 transition-colors",
                      isPast
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {r.source === "seven" && (
                            <Sparkles size={13} className="text-primary shrink-0" />
                          )}
                          <p className="text-[14px] font-medium text-foreground truncate">{r.title}</p>
                        </div>
                        {r.description && (
                          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                            {r.description}
                          </p>
                        )}
                        <p className={cn("text-[11px] mt-2 font-medium", isPast ? "text-destructive" : "text-muted-foreground")}>
                          {isPast ? "Due now" : format(new Date(r.dueAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <button
                        onClick={() => onDismiss(r.id)}
                        className="shrink-0 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RemindersSheet;
