/**
 * format-message-time
 *
 * Relative timestamp formatter for chat messages.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.7, Section 10.9
 *   ("Every message implicitly carries a timestamp. Seven references past
 *   exchanges by time.") and Section 10.5 (timestamp shown on hover desktop /
 *   long-press mobile — the format is the same in both surfaces).
 *
 * Output style — chosen to match how Seven would speak the timestamp:
 *
 *   < 1 minute ago        → "Just now"
 *   Same calendar day     → "Today at 14:23"
 *   Yesterday             → "Yesterday at 09:05"
 *   Same calendar week    → "Tuesday at 18:30"
 *   Same calendar year    → "15 Apr at 11:00"
 *   Different year        → "15 Apr 2025 at 11:00"
 *
 * All times rendered in 24-hour format. v5.7 §10.9 rule 5 example uses
 * "Tuesday at 18:30" — 24-hour matches the spec.
 *
 * The formatter is timezone-aware via Intl.DateTimeFormat — the caller is
 * responsible for ensuring the input Date is correct UTC. The formatter
 * always renders in the BROWSER'S local timezone (frontend usage); for
 * server-side usage in the chat Edge Function, see
 * supabase/functions/chat/_format-message-time.ts (separate copy because
 * Deno can't import from src/; kept in sync manually — any change to
 * one file should be applied to the other).
 *
 * Pure function. No side effects. Unit-testable.
 */

/**
 * Format a Date or ISO string as a relative timestamp suitable for display
 * under a chat message.
 *
 * @param when - The message timestamp. Accepts Date, ISO string, or number (ms).
 * @param now - Optional reference point for "now" (defaults to Date.now()).
 *              Exposed for deterministic testing.
 * @returns Human-readable relative timestamp string.
 */
export function formatMessageTime(
  when: Date | string | number,
  now: Date | number = Date.now(),
): string {
  const messageDate = when instanceof Date ? when : new Date(when);
  const reference = now instanceof Date ? now : new Date(now);

  // Defensive: invalid dates produce empty string rather than "Invalid Date".
  // Caller can choose to suppress the timestamp display when this happens.
  if (Number.isNaN(messageDate.getTime())) {
    return "";
  }

  const diffMs = reference.getTime() - messageDate.getTime();

  // Sub-minute: treat as "Just now". Negative diffs (clock skew, future
  // optimistic timestamps) also collapse here.
  if (diffMs < 60_000) {
    return "Just now";
  }

  const time24 = formatTime24(messageDate);

  // Same calendar day (in local time).
  if (isSameLocalDay(messageDate, reference)) {
    return `Today at ${time24}`;
  }

  // Yesterday (in local time).
  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(messageDate, yesterday)) {
    return `Yesterday at ${time24}`;
  }

  // Within the last 6 days — show weekday name. Past 6 days fall through
  // to the date format below to avoid ambiguity ("last Tuesday" vs "this
  // Tuesday" — calendar dates are unambiguous).
  const sixDaysAgo = new Date(reference);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  sixDaysAgo.setHours(0, 0, 0, 0);
  if (messageDate.getTime() >= sixDaysAgo.getTime()) {
    const weekday = messageDate.toLocaleDateString(undefined, {
      weekday: "long",
    });
    return `${weekday} at ${time24}`;
  }

  // Same calendar year — drop the year for compactness.
  const dayMonth = messageDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  if (messageDate.getFullYear() === reference.getFullYear()) {
    return `${dayMonth} at ${time24}`;
  }

  // Different year — include it.
  const dayMonthYear = messageDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${dayMonthYear} at ${time24}`;
}

function formatTime24(date: Date): string {
  // Hand-rolled to guarantee 24-hour format regardless of locale defaults.
  // toLocaleTimeString with hour12: false works on every modern browser
  // but locale-specific edge cases (e.g. some Arabic locales emit Eastern
  // Arabic numerals) can produce surprising output; this is deterministic.
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
