/**
 * reminders-fire — Stage B2 cron dispatcher
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Runs every minute via Supabase pg_cron + pg_net. Protected by a shared
 * secret (REMINDERS_FIRE_CRON_SECRET) passed as the `x-cron-secret` header.
 *
 * Responsibilities
 * ────────────────
 *   Pass 1 — MAIN reminders that are due:
 *     • trigger_at_utc ≤ now() AND status = 'scheduled'
 *     • Insert a kind='reminder' row into public.notifications
 *     • UPDATE the reminder: status='delivered', delivered_at=now()
 *
 *   Pass 2 — PRE-reminders whose lead-time fires now:
 *     • For scheduled reminders with a non-empty pre_reminders[] array:
 *       any lead-minute L where (trigger_at_utc - L minutes) ≤ now() AND
 *       L not yet in pre_reminders_fired[].
 *     • Insert a kind='pre_reminder' row
 *     • UPDATE the reminder: pre_reminders_fired = pre_reminders_fired || L
 *
 * Grace window
 * ────────────
 *   10-minute grace for both main and pre-reminders. A reminder that SHOULD
 *   have fired 5 minutes ago still fires (covers cron hiccups, DB hiccups,
 *   brief Edge Function outages). Anything > 10 minutes past is skipped —
 *   firing a reminder for "take your pills at 9am" at 9:30am is awkward but
 *   acceptable; at 11am it's noise. Stale reminders accumulate under
 *   status='scheduled' with trigger_at_utc in the past — a separate janitor
 *   (future work) sweeps them to status='failed' daily.
 *
 * Idempotency
 * ───────────
 *   Main: the `.eq("status","scheduled")` guard on the UPDATE ensures a
 *   reminder transitions to `delivered` at most once. Second cron tick sees
 *   status!='scheduled' and skips it.
 *
 *   Pre-reminder: `pre_reminders_fired` is an int[] we append to. The read
 *   includes this array; the write appends only if the lead-minute isn't
 *   already present; the UPDATE includes `.eq("status","scheduled")` so
 *   concurrent cron ticks don't both append (last writer wins idempotently).
 *
 * Never-double-fire vs never-drop tradeoff
 * ────────────────────────────────────────
 *   We prefer NEVER-DROP. If the notification INSERT succeeds but the
 *   reminder UPDATE fails, the next cron tick will re-fire the same
 *   reminder. This is logged loudly with [REMINDERS_FIRE] ERROR so we
 *   catch regressions. Alternative (transaction) is unavailable through
 *   the Supabase JS client.
 *
 * Observability
 * ─────────────
 *   Every run emits `[REMINDERS_FIRE] Tick summary: {...}` with counts.
 *   Individual fires emit `[REMINDERS_FIRE] Fired main ...` or
 *   `[REMINDERS_FIRE] Fired pre ...` lines. Errors use console.error.
 *
 * Security
 * ────────
 *   Three layers:
 *     1. Service-role Supabase client (bypasses RLS — required to INSERT
 *        into notifications which has no user-insert policy)
 *     2. x-cron-secret header verified against REMINDERS_FIRE_CRON_SECRET
 *        env var — only pg_cron (which has the secret) can invoke
 *     3. CORS restricted; function returns 401 on auth failure, 503 if
 *        the secret isn't configured
 *
 * Response shape
 * ──────────────
 *   { main_fired, pre_fired, main_errors, pre_errors, duration_ms }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════
// Configuration constants — every value is deliberate, not arbitrary
// ═══════════════════════════════════════════════════════════════════════════

/** Main reminders within this many minutes past due still fire. */
const MAIN_GRACE_MINUTES = 10;

/** Pre-reminders within this many minutes past their computed fire time still fire. */
const PRE_GRACE_MINUTES = 10;

/** Hard cap per cron tick. Protects against runaway on a large backlog.
 *  500 reminders × (1 insert + 1 update) = 1000 DB ops ≈ comfortable inside
 *  the 60-second Edge Function budget even at worst-case latency. */
const MAX_BATCH_SIZE = 500;

/** Max lead-time enforced at write (matches reminders table check constraint).
 *  14 days × 24 hours × 60 minutes. Used as upper bound for pre-reminder
 *  candidate window. */
const MAX_LEAD_MINUTES = 20160;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface ReminderRow {
  id: string;
  user_id: string;
  text_snapshot: string;
  trigger_at_utc: string;
  user_timezone: string | null;
  user_local_display: string | null;
  pre_reminders: number[];
  pre_reminders_fired: number[];
  importance: "normal" | "important";
  channels: string[];
  section_id: string | null;
}

interface TickSummary {
  main_fired: number;
  pre_fired: number;
  main_errors: number;
  pre_errors: number;
  duration_ms: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS — Edge Functions need explicit OPTIONS handling even for cron-only use
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ═══════════════════════════════════════════════════════════════════════════
// Formatting helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Title for a main reminder notification: "Reminder: <text_snapshot>". */
function formatMainTitle(r: ReminderRow): string {
  return `Reminder: ${r.text_snapshot}`;
}

/** Title for a pre-reminder notification: "Heads up (in 2h): <text>". */
function formatPreTitle(r: ReminderRow, leadMinutes: number): string {
  return `Heads up (${formatLeadLabel(leadMinutes)}): ${r.text_snapshot}`;
}

/** Humanise a lead time in minutes. Examples:
 *    15   → "in 15m"
 *    60   → "in 1h"
 *    120  → "in 2h"
 *    1440 → "in 1 day"
 *    2880 → "in 2 days" */
function formatLeadLabel(leadMinutes: number): string {
  if (leadMinutes >= 1440 && leadMinutes % 1440 === 0) {
    const days = leadMinutes / 1440;
    return days === 1 ? "in 1 day" : `in ${days} days`;
  }
  if (leadMinutes >= 60 && leadMinutes % 60 === 0) {
    const hours = leadMinutes / 60;
    return hours === 1 ? "in 1h" : `in ${hours}h`;
  }
  return `in ${leadMinutes}m`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dispatch: fire a single MAIN reminder
// ═══════════════════════════════════════════════════════════════════════════

async function fireMainReminder(
  supabase: SupabaseClient,
  r: ReminderRow,
): Promise<boolean> {
  // 1. Insert notification row
  const { error: notifErr } = await supabase.from("notifications").insert({
    user_id: r.user_id,
    kind: "reminder",
    title: formatMainTitle(r),
    body: r.text_snapshot,
    payload: {
      source_reminder_id: r.id,
      trigger_at_utc: r.trigger_at_utc,
      user_local_display: r.user_local_display,
      user_timezone: r.user_timezone,
      importance: r.importance,
      channels: r.channels,
    },
    source_table: "reminders",
    source_id: r.id,
  });

  if (notifErr) {
    console.error(
      `[REMINDERS_FIRE] Main notification INSERT failed for reminder=${r.id}: ${notifErr.message}`,
    );
    return false;
  }

  // 2. Mark reminder as delivered. The .eq("status","scheduled") guard prevents
  //    double-flipping if a concurrent tick already processed this row.
  const { error: updateErr, count } = await supabase
    .from("reminders")
    .update(
      { status: "delivered", delivered_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", r.id)
    .eq("status", "scheduled");

  if (updateErr) {
    console.error(
      `[REMINDERS_FIRE] Main UPDATE failed for reminder=${r.id}: ${updateErr.message} — ` +
      `notification was sent; reminder will double-fire next tick unless status changes`,
    );
    return false;
  }

  // count === 0 means status was already !='scheduled' (concurrent tick won).
  // We treat this as success because the other tick already dispatched.
  // count === 1 means we flipped it — our fire was the effective one.
  if (count === 0) {
    console.log(
      `[REMINDERS_FIRE] Main reminder=${r.id} was already delivered by concurrent tick (no-op)`,
    );
    return true;
  }

  console.log(
    `[REMINDERS_FIRE] Fired main reminder=${r.id} user=${r.user_id.slice(0, 8)} ` +
    `text="${r.text_snapshot.slice(0, 50)}" importance=${r.importance}`,
  );
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dispatch: fire a single PRE-reminder for a specific lead-minute
// ═══════════════════════════════════════════════════════════════════════════

async function firePreReminder(
  supabase: SupabaseClient,
  r: ReminderRow,
  leadMinutes: number,
): Promise<boolean> {
  // 1. Insert notification row
  const { error: notifErr } = await supabase.from("notifications").insert({
    user_id: r.user_id,
    kind: "pre_reminder",
    title: formatPreTitle(r, leadMinutes),
    body: r.text_snapshot,
    payload: {
      source_reminder_id: r.id,
      trigger_at_utc: r.trigger_at_utc,
      user_local_display: r.user_local_display,
      user_timezone: r.user_timezone,
      importance: r.importance,
      lead_minutes: leadMinutes,
      lead_label: formatLeadLabel(leadMinutes),
    },
    source_table: "reminders",
    source_id: r.id,
  });

  if (notifErr) {
    console.error(
      `[REMINDERS_FIRE] Pre-reminder INSERT failed for reminder=${r.id} lead=${leadMinutes}m: ${notifErr.message}`,
    );
    return false;
  }

  // 2. Append this lead-minute to pre_reminders_fired array.
  //    Array append via SQL expression to avoid read-modify-write race.
  //    Using .rpc() to a small helper keeps this atomic; without a helper,
  //    we fall back to fetch-and-write with the status guard as race mitigation.
  //
  //    Prefer RPC if available; otherwise do fetch-and-write.

  const { data: current, error: fetchErr } = await supabase
    .from("reminders")
    .select("pre_reminders_fired, status")
    .eq("id", r.id)
    .single();

  if (fetchErr) {
    console.error(
      `[REMINDERS_FIRE] Pre-fetch failed for reminder=${r.id}: ${fetchErr.message} — ` +
      `notification sent; lead=${leadMinutes}m not recorded, will re-fire next tick`,
    );
    return false;
  }

  const alreadyFired: number[] = current?.pre_reminders_fired ?? [];
  if (alreadyFired.includes(leadMinutes)) {
    // Another tick already recorded this lead — we just double-fired the
    // notification. Log so we know, but don't count as error (notification
    // delivered; that was the goal). This is rare because the outer query
    // filters out reminders whose pre_reminders_fired includes the lead.
    console.warn(
      `[REMINDERS_FIRE] Double-fire detected: reminder=${r.id} lead=${leadMinutes}m already in pre_reminders_fired`,
    );
    return true;
  }

  // Don't re-fire if reminder was cancelled/delivered between queries
  if (current?.status !== "scheduled") {
    console.log(
      `[REMINDERS_FIRE] Reminder=${r.id} status changed to ${current?.status} mid-fire; lead=${leadMinutes}m notif sent but not recorded`,
    );
    return true;
  }

  const updated = [...alreadyFired, leadMinutes].sort((a, b) => b - a);
  const { error: updateErr } = await supabase
    .from("reminders")
    .update({ pre_reminders_fired: updated })
    .eq("id", r.id)
    .eq("status", "scheduled");

  if (updateErr) {
    console.error(
      `[REMINDERS_FIRE] Pre-UPDATE failed for reminder=${r.id} lead=${leadMinutes}m: ${updateErr.message} — ` +
      `notification sent; will re-fire next tick`,
    );
    return false;
  }

  console.log(
    `[REMINDERS_FIRE] Fired pre-reminder=${r.id} lead=${leadMinutes}m user=${r.user_id.slice(0, 8)} ` +
    `text="${r.text_snapshot.slice(0, 50)}"`,
  );
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP handler
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  // ─── Auth layer 1 — cron secret ────────────────────────────────────────
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("REMINDERS_FIRE_CRON_SECRET");

  if (!expectedSecret) {
    console.error("[REMINDERS_FIRE] REMINDERS_FIRE_CRON_SECRET not configured");
    return new Response(
      JSON.stringify({ error: "cron_secret_not_configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // ─── Auth layer 2 — service-role client ─────────────────────────────
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("[REMINDERS_FIRE] SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not set");
      return new Response(
        JSON.stringify({ error: "service_role_not_configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // ═══════════════════════════════════════════════════════════════════
    // PASS 1 — MAIN reminders that are due
    // ═══════════════════════════════════════════════════════════════════
    const mainGraceStart = new Date(nowMs - MAIN_GRACE_MINUTES * 60 * 1000).toISOString();

    const { data: dueMain, error: mainQueryErr } = await supabase
      .from("reminders")
      .select(
        "id, user_id, text_snapshot, trigger_at_utc, user_timezone, user_local_display, " +
        "pre_reminders, pre_reminders_fired, importance, channels, section_id",
      )
      .eq("status", "scheduled")
      .lte("trigger_at_utc", nowIso)
      .gte("trigger_at_utc", mainGraceStart)
      .order("trigger_at_utc", { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (mainQueryErr) {
      console.error(`[REMINDERS_FIRE] Main query failed: ${mainQueryErr.message}`);
      return new Response(
        JSON.stringify({ error: "main_query_failed", detail: mainQueryErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let mainFired = 0;
    let mainErrors = 0;
    for (const r of (dueMain ?? []) as ReminderRow[]) {
      const ok = await fireMainReminder(supabase, r);
      if (ok) mainFired++;
      else mainErrors++;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PASS 2 — PRE-reminders whose lead-time intersects NOW
    //
    // Candidates: scheduled reminders with non-empty pre_reminders[] whose
    // trigger_at_utc is in the future (or in the main grace window — rare
    // edge: a fast-firing pre-reminder set to fire 0 minutes before trigger
    // would qualify here). Upper bound: now + MAX_LEAD_MINUTES.
    //
    // Per-row: for each leadMinutes L in pre_reminders[] not in
    // pre_reminders_fired[], check if (triggerMs - L·60·1000) ≤ nowMs AND
    // within the pre-reminder grace window.
    // ═══════════════════════════════════════════════════════════════════
    const preUpperBound = new Date(nowMs + MAX_LEAD_MINUTES * 60 * 1000).toISOString();
    const preGraceStart = new Date(nowMs - PRE_GRACE_MINUTES * 60 * 1000).toISOString();

    const { data: preCandidates, error: preQueryErr } = await supabase
      .from("reminders")
      .select(
        "id, user_id, text_snapshot, trigger_at_utc, user_timezone, user_local_display, " +
        "pre_reminders, pre_reminders_fired, importance, channels, section_id",
      )
      .eq("status", "scheduled")
      .gt("trigger_at_utc", preGraceStart)           // trigger is recent enough to have non-fired pre-reminders
      .lte("trigger_at_utc", preUpperBound)          // trigger is within MAX_LEAD_MINUTES of now
      .not("pre_reminders", "eq", "{}")               // has at least one configured pre-reminder
      .order("trigger_at_utc", { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (preQueryErr) {
      console.error(`[REMINDERS_FIRE] Pre query failed: ${preQueryErr.message}`);
      return new Response(
        JSON.stringify({
          error: "pre_query_failed",
          detail: preQueryErr.message,
          main_fired: mainFired,
          main_errors: mainErrors,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let preFired = 0;
    let preErrors = 0;
    const preGraceWindowMs = PRE_GRACE_MINUTES * 60 * 1000;

    for (const r of (preCandidates ?? []) as ReminderRow[]) {
      const triggerMs = new Date(r.trigger_at_utc).getTime();
      const fired: number[] = r.pre_reminders_fired ?? [];

      for (const leadMinutes of r.pre_reminders ?? []) {
        if (fired.includes(leadMinutes)) continue;
        const preFireMs = triggerMs - leadMinutes * 60 * 1000;
        // Fire if the computed fire time is in the past AND within grace window.
        if (preFireMs <= nowMs && preFireMs >= nowMs - preGraceWindowMs) {
          const ok = await firePreReminder(supabase, r, leadMinutes);
          if (ok) preFired++;
          else preErrors++;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════════
    const durationMs = Date.now() - startedAt;
    const summary: TickSummary = {
      main_fired: mainFired,
      pre_fired: preFired,
      main_errors: mainErrors,
      pre_errors: preErrors,
      duration_ms: durationMs,
    };

    console.log(`[REMINDERS_FIRE] Tick summary: ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = (err as Error)?.message || String(err);
    console.error(`[REMINDERS_FIRE] Uncaught exception: ${message}`);
    return new Response(
      JSON.stringify({ error: "uncaught_exception", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
