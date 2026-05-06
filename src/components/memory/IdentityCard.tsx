import { useState } from "react";
import { User, Sparkles, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIdentityCardData, type IdentityModel, type IdentityProfile } from "@/hooks/use-identity-card-data";

/**
 * Identity Card panel for the Memory Surface (architecture v5.7 sec.10.13.1).
 *
 * Two sub-cards:
 *   A. "What you've told Seven" -- declared identity from identity_profiles
 *   B. "What Seven has learned about you" -- inferred from identity_model
 *
 * Sub-card B has per-field "Right" / "Not right" affordances that write to
 * feedback_signals. Per the substrate-visibility principle (§1.5), the user
 * can audit and correct what Seven has inferred about them. Per §3.13 the
 * feedback updates identity_model confidence with drift-clamped semantics
 * on the next cron-identity-model pass -- the substrate doesn't react
 * synchronously, by design.
 *
 * Empty fields render explicitly as "Seven hasn't characterised this yet"
 * per §10.13.1 -- absence is information about the substrate's depth, not
 * something to hide.
 */
const IdentityCard = () => {
  const { profile, model, loading, error, submitFieldFeedback } = useIdentityCardData();
  const [pendingField, setPendingField] = useState<string | null>(null);

  const handleFeedback = async (
    field: string,
    kind: "identity_correct" | "identity_misframed",
    contextValue?: unknown,
  ) => {
    setPendingField(field);
    const result = await submitFieldFeedback(field, kind, contextValue);
    setPendingField(null);
    if (result.ok) {
      toast.success(
        kind === "identity_correct"
          ? "Thanks -- Seven will weight this higher"
          : "Thanks -- Seven will reconsider",
      );
    } else {
      toast.error(`Feedback failed: ${result.error ?? "unknown error"}`);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <User size={18} className="text-muted-foreground" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold text-foreground">Identity</h2>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Loading what Seven knows about you...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={18} className="text-destructive" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold text-foreground">Identity</h2>
        </div>
        <p className="text-[13px] text-destructive">Couldn&rsquo;t load identity: {error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 mb-4">
      <DeclaredIdentitySubCard profile={profile} />
      <InferredIdentitySubCard
        model={model}
        pendingField={pendingField}
        onFeedback={handleFeedback}
      />
    </section>
  );
};

// -- Sub-card A: declared identity ---------------------------------------

const DeclaredIdentitySubCard = ({ profile }: { profile: IdentityProfile | null }) => {
  // Each declared field renders as a "label + value" row, or an empty-state
  // hint if not yet captured. The hint matters: it tells the user how to
  // correct the absence (tell Seven in chat).
  const rows: { label: string; value: string | null; hint: string }[] = [
    {
      label: "Name",
      value: profile?.display_name ?? null,
      hint: "Tell Seven your name in chat",
    },
    {
      label: "Role",
      value: profile?.self_role ?? null,
      hint: "Tell Seven what you do",
    },
    {
      label: "Company",
      value: profile?.self_company ?? null,
      hint: "Tell Seven where you work",
    },
    {
      label: "City",
      value: profile?.self_city ?? null,
      hint: "Tell Seven where you're based",
    },
  ];

  const goals = profile?.goals ?? [];
  const focusAreas = profile?.focus_areas ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <User size={18} className="text-muted-foreground" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold text-foreground">What you&rsquo;ve told Seven</h3>
      </div>
      <p className="text-[12px] text-muted-foreground mb-4">
        Things you&rsquo;ve shared directly. Seven uses these as canonical truth.
      </p>

      <dl className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-3">
            <dt className="text-[12px] uppercase tracking-wide text-muted-foreground w-20 shrink-0">
              {row.label}
            </dt>
            <dd className={`text-[14px] ${row.value ? "text-foreground" : "text-muted-foreground italic"}`}>
              {row.value ?? row.hint}
            </dd>
          </div>
        ))}
      </dl>

      <ChipRow label="Goals" items={goals} emptyHint="Mention goals in chat to track them" />
      <ChipRow label="Focus areas" items={focusAreas} emptyHint="Tell Seven what you're focused on" />
    </div>
  );
};

const ChipRow = ({
  label,
  items,
  emptyHint,
}: {
  label: string;
  items: string[];
  emptyHint: string;
}) => (
  <div className="mt-4">
    <div className="text-[12px] uppercase tracking-wide text-muted-foreground mb-1.5">
      {label}
    </div>
    {items.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${label}-${i}-${item}`}
            className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-[13px] text-muted-foreground italic">{emptyHint}</p>
    )}
  </div>
);

// -- Sub-card B: inferred identity ---------------------------------------

const InferredIdentitySubCard = ({
  model,
  pendingField,
  onFeedback,
}: {
  model: IdentityModel | null;
  pendingField: string | null;
  onFeedback: (
    field: string,
    kind: "identity_correct" | "identity_misframed",
    contextValue?: unknown,
  ) => void | Promise<void>;
}) => {
  // If there's no row at all, the substrate hasn't started inferring yet.
  // Empty arrays + zero counts is a different state from no row at all,
  // but the UI presentation is similar.
  const isEmpty =
    !model ||
    (model.core_values.length === 0 &&
      model.strengths.length === 0 &&
      model.blind_spots.length === 0 &&
      Object.keys(model.personality_dimensions).length === 0 &&
      Object.keys(model.decision_tendencies).length === 0 &&
      Object.keys(model.communication_style).length === 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-muted-foreground" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold text-foreground">
          What Seven has learned about you
        </h3>
      </div>
      <p className="text-[12px] text-muted-foreground mb-4">
        Inferred from how you talk and decide. Tell Seven when something&rsquo;s off.
      </p>

      {isEmpty ? (
        <div className="rounded-xl bg-muted/40 px-4 py-5">
          <p className="text-[13px] text-muted-foreground">
            Seven hasn&rsquo;t built a model of you yet. Keep using Seven and patterns
            will emerge across decisions, communication, and recurring themes.
            {model && model.built_from_message_count > 0 ? (
              <span className="block mt-1 text-[12px]">
                {model.built_from_message_count} messages so far.
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <ListField
            field="core_values"
            label="Core values"
            items={model!.core_values}
            pendingField={pendingField}
            onFeedback={onFeedback}
          />
          <ListField
            field="strengths"
            label="Strengths"
            items={model!.strengths}
            pendingField={pendingField}
            onFeedback={onFeedback}
          />
          <ListField
            field="blind_spots"
            label="Blind spots"
            items={model!.blind_spots}
            pendingField={pendingField}
            onFeedback={onFeedback}
          />
          <JsonField
            field="personality_dimensions"
            label="Personality"
            value={model!.personality_dimensions}
            pendingField={pendingField}
            onFeedback={onFeedback}
          />
          <JsonField
            field="decision_tendencies"
            label="Decision tendencies"
            value={model!.decision_tendencies}
            pendingField={pendingField}
            onFeedback={onFeedback}
          />
          <JsonField
            field="communication_style"
            label="Communication style"
            value={model!.communication_style}
            pendingField={pendingField}
            onFeedback={onFeedback}
          />

          {model!.built_from_message_count > 0 ? (
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Built from {model!.built_from_message_count}{" "}
              {model!.built_from_message_count === 1 ? "message" : "messages"}
              {model!.last_updated_at
                ? ` -- updated ${formatRelative(model!.last_updated_at)}`
                : ""}
              .
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};

const ListField = ({
  field,
  label,
  items,
  pendingField,
  onFeedback,
}: {
  field: string;
  label: string;
  items: string[];
  pendingField: string | null;
  onFeedback: (
    field: string,
    kind: "identity_correct" | "identity_misframed",
    contextValue?: unknown,
  ) => void | Promise<void>;
}) => {
  if (items.length === 0) {
    return (
      <FieldRow label={label} pending={false}>
        <span className="text-[13px] text-muted-foreground italic">
          Seven hasn&rsquo;t characterised your {label.toLowerCase()} yet.
        </span>
      </FieldRow>
    );
  }
  return (
    <FieldRow
      label={label}
      pending={pendingField === field}
      onCorrect={() => onFeedback(field, "identity_correct", items)}
      onMisframed={() => onFeedback(field, "identity_misframed", items)}
    >
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${field}-${i}-${item}`}
            className="text-[12px] px-2 py-0.5 rounded-full bg-muted text-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </FieldRow>
  );
};

const JsonField = ({
  field,
  label,
  value,
  pendingField,
  onFeedback,
}: {
  field: string;
  label: string;
  value: Record<string, unknown>;
  pendingField: string | null;
  onFeedback: (
    field: string,
    kind: "identity_correct" | "identity_misframed",
    contextValue?: unknown,
  ) => void | Promise<void>;
}) => {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return (
      <FieldRow label={label} pending={false}>
        <span className="text-[13px] text-muted-foreground italic">
          Seven hasn&rsquo;t characterised your {label.toLowerCase()} yet.
        </span>
      </FieldRow>
    );
  }
  return (
    <FieldRow
      label={label}
      pending={pendingField === field}
      onCorrect={() => onFeedback(field, "identity_correct", value)}
      onMisframed={() => onFeedback(field, "identity_misframed", value)}
    >
      <ul className="space-y-1">
        {entries.map(([k, v]) => (
          <li key={k} className="text-[13px] text-foreground">
            <span className="text-muted-foreground">{k}:</span>{" "}
            <span>{formatValue(v)}</span>
          </li>
        ))}
      </ul>
    </FieldRow>
  );
};

const FieldRow = ({
  label,
  children,
  pending,
  onCorrect,
  onMisframed,
}: {
  label: string;
  children: React.ReactNode;
  pending: boolean;
  onCorrect?: () => void;
  onMisframed?: () => void;
}) => (
  <div className="rounded-xl bg-muted/30 px-3 py-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
          {label}
        </div>
        {children}
      </div>
      {onCorrect && onMisframed ? (
        <div className="flex items-center gap-1 shrink-0">
          {pending ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <>
              <button
                type="button"
                onClick={onCorrect}
                aria-label={`${label} is right`}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
              >
                <ThumbsUp size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onMisframed}
                aria-label={`${label} is not right`}
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
              >
                <ThumbsDown size={13} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  </div>
);

// -- helpers ------------------------------------------------------------

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return "(empty)";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const formatRelative = (iso: string): string => {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = now - then;
    const day = 86_400_000;
    const hour = 3_600_000;
    const min = 60_000;
    if (diff < min) return "just now";
    if (diff < hour) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    return `${Math.floor(diff / day)}d ago`;
  } catch {
    return "recently";
  }
};

export default IdentityCard;
