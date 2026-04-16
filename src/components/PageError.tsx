import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * PageError
 *
 * Shared error card shown when a page fails to load.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.5, Section 10.6 —
 * every page must handle loading, empty, and error states explicitly.
 *
 * Accessibility:
 *   - role="alert" + aria-live="polite" announces the failure to screen readers.
 *   - Retry button meets the 44x44px minimum touch target (Section 10.4).
 *   - Focus-visible ring for keyboard users.
 *
 * Design system: Gemini light theme — white surface, Seven Mynd blue (#1558D6)
 * accent for the retry affordance (Section 10.1).
 */
export interface PageErrorProps {
  /** Short heading. Defaults to "Unable to load". */
  title?: string;
  /** Human-readable description of what went wrong. */
  message?: string;
  /** Optional retry handler. If omitted, no retry button is shown. */
  onRetry?: () => void;
  /** Optional raw error for console/debug surfacing. Never rendered to the user. */
  error?: unknown;
}

export function PageError({
  title = "Unable to load",
  message = "Something went wrong. Please try again.",
  onRetry,
  error,
}: PageErrorProps) {
  // Surface the underlying error to the console for debugging without leaking
  // implementation detail into the UI.
  if (error !== undefined) {
    // eslint-disable-next-line no-console
    console.error("[PageError]", title, error);
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full max-w-[780px] mx-auto px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[60vh]"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8 text-center">
        <div
          className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center"
          aria-hidden="true"
        >
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
            aria-label="Retry loading"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export default PageError;
