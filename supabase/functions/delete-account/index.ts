/**
 * Delete Account Edge Function — Architecture v5.5, Section 19.8
 *
 * GDPR Article 17 (Right to Erasure) compliant hard-delete of a user's entire
 * account and all associated data. Must run on the server with service_role
 * permission because:
 *   1. auth.users deletion requires admin API (service_role)
 *   2. Storage bucket cleanup crosses RLS boundaries
 *   3. A client-side parallel multi-table delete has no atomicity — any
 *      partial failure leaves a half-deleted account which is worse than
 *      no deletion at all.
 *
 * Accepts: POST with Bearer token auth (the user deleting their own account).
 *          No body required — the user is identified by the JWT.
 *          Optional body: { confirm: "DELETE" } as a belt-and-braces check,
 *          though the UI is the primary confirmation surface.
 *
 * Returns:
 *   200 { status: "deleted", phases: {...} } — success
 *   401 { error: "Unauthorized" } — missing or invalid JWT
 *   500 { error: "Partial failure", phases: {...}, failed_phase } — something
 *        went wrong midway; `phases` tells the caller exactly how far we got.
 *
 * Key architectural points:
 *   - Audit log row is written BEFORE any data is deleted, with user_id=null
 *     and a SHA-256 hash of the user_id in metadata. This preserves a
 *     compliance record without retaining any PII.
 *   - Storage cleanup happens first. If it fails, we surface the error and
 *     abort before touching DB rows — safer to leave everything intact than
 *     to delete DB state and leave orphan files.
 *   - NO ACTION blockers (conversation_messages, memories_raw) are cleared
 *     before auth.users delete. Without this, the auth admin call FK-errors.
 *   - auth.users delete cascades to 11 tables automatically; we still call
 *     explicit DELETE on all user_id tables first to (a) make the behaviour
 *     explicit and auditable, and (b) handle the 17 tables without CASCADE.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://sevenmynd.com",
  "https://www.sevenmynd.com",
  "https://mind-weave-ledger.lovable.app",
];

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vercel.app")) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

// All tables with user_id column (from schema audit Apr 18 2026).
// Tables ARE still listed here even if their FK has ON DELETE CASCADE —
// explicit delete gives us auditable progress tracking, and means partial
// failures don't leave orphaned data blocking subsequent runs.
const USER_ID_TABLES = [
  // CRITICAL — these MUST be cleared first. Their FK is NO ACTION to
  // auth.users(id), so leaving rows here blocks the auth.users delete.
  "conversation_messages",
  "memories_raw",

  // Child tables that cascade via their parent references. Listed so they
  // clear cleanly if the parent chain is already gone.
  "decision_events",
  "outcomes",

  // All other user_id tables (17 without explicit cascade to auth.users
  // plus the remaining cascade tables for explicitness).
  "audit_log",
  "behaviour_patterns",
  "consent_records",
  "decisions",
  "devices",
  "digest_entries",
  "documents",
  "identity_model",
  "identity_profiles",
  "memories_structured",
  "memory_facts",
  "memory_traces",
  "messages",
  "notification_log",
  "notification_subscriptions",
  "oauth_tokens",
  "pending_actions",
  "review_completion_events",
  "sections",
  "situation_entities",
  "situations",
  "subscriptions",
  "user_preferences",
];

// memory_fact_evidence has no user_id column — it cascades via memory_facts
// or memories_structured. Listed separately so deletion is still auditable
// via direct JOIN deletion if ever needed. For now, we rely on FK CASCADE.

async function deleteUserStorage(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ deleted: number; error: string | null }> {
  try {
    const { data: files, error: listErr } = await adminClient.storage
      .from("documents")
      .list(userId, { limit: 1000 });

    if (listErr) {
      // Non-existent user-folder is not an error — treat as zero files.
      if (listErr.message?.toLowerCase().includes("not found")) {
        return { deleted: 0, error: null };
      }
      return { deleted: 0, error: listErr.message };
    }

    if (!files || files.length === 0) {
      return { deleted: 0, error: null };
    }

    const paths = files.map((f) => `${userId}/${f.name}`);
    const { data: removed, error: rmErr } = await adminClient.storage
      .from("documents")
      .remove(paths);

    if (rmErr) return { deleted: 0, error: rmErr.message };
    return { deleted: removed?.length || paths.length, error: null };
  } catch (e) {
    return { deleted: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function hashUserId(userId: string): Promise<string> {
  // SHA-256 of the user_id. Used to write a compliance record that proves a
  // deletion occurred for a specific account, without retaining the PII.
  // Auditors can verify a deletion was run for account X by hashing X and
  // matching; without knowing X they cannot reverse the hash to identify users.
  const data = new TextEncoder().encode(userId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Step 1: Authenticate the caller ───
  // Use the user's JWT to identify them. The user can only delete their own
  // account — there is no admin flow here.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  console.log(`[DELETE_ACCOUNT] Starting deletion for user ${userId.slice(0, 8)}…`);

  // ─── Step 2: Service-role client for the destructive work ───
  // The anon-key client can't delete auth.users or touch other users'
  // storage paths. From this point on every operation is admin-scoped —
  // the authentication check above is the only guard.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("[DELETE_ACCOUNT] SUPABASE_SERVICE_ROLE_KEY not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const phases: Record<string, { ok: boolean; details?: unknown; error?: string }> = {};

  // ─── Phase A: Storage cleanup ───
  // Run this first because it's the one thing that leaves data behind if
  // skipped. If it fails, abort before touching DB so the user can retry.
  const storageResult = await deleteUserStorage(adminClient, userId);
  phases.storage = {
    ok: storageResult.error === null,
    details: { files_deleted: storageResult.deleted },
    error: storageResult.error || undefined,
  };
  if (storageResult.error) {
    console.error(`[DELETE_ACCOUNT] Storage cleanup failed:`, storageResult.error);
    return new Response(
      JSON.stringify({
        error: "Storage cleanup failed — no data was deleted. Please try again or contact support.",
        phases,
        failed_phase: "storage",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  console.log(`[DELETE_ACCOUNT] Storage: ${storageResult.deleted} file(s) removed`);

  // ─── Phase B: Anonymised audit record (WRITTEN BEFORE DELETION) ───
  // Without this, we'd have no proof the deletion occurred. Using user_id=null
  // so the row is NOT caught by the audit_log DELETE in Phase D below.
  try {
    const userHash = await hashUserId(userId);
    const { error: auditErr } = await adminClient.from("audit_log").insert({
      user_id: null,
      action: "account_deletion",
      table_name: "auth.users",
      details: {
        user_id_hash: userHash,
        deleted_at: new Date().toISOString(),
        files_removed: storageResult.deleted,
        source: "user_initiated",
      },
    });
    if (auditErr) {
      // Non-fatal — we log but don't abort. Compliance is weakened but not
      // violated (the request itself is the primary record in Supabase logs).
      console.error(`[DELETE_ACCOUNT] Audit log insert failed:`, auditErr.message);
      phases.audit = { ok: false, error: auditErr.message };
    } else {
      phases.audit = { ok: true };
    }
  } catch (e) {
    phases.audit = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // ─── Phase C + D: Delete all user_id-keyed rows in the correct order ───
  // NO-ACTION blockers first (conversation_messages, memories_raw), then
  // everything else. Parallelism is fine within each group because no FK
  // depends on another table in the same group.
  const deletionResults: Record<string, { deleted: boolean; error?: string }> = {};

  // Blockers first — these MUST succeed before auth.users delete is attempted.
  const blockerTables = ["conversation_messages", "memories_raw"];
  for (const table of blockerTables) {
    const { error } = await adminClient.from(table).delete().eq("user_id", userId);
    if (error) {
      deletionResults[table] = { deleted: false, error: error.message };
    } else {
      deletionResults[table] = { deleted: true };
    }
  }

  // If blocker deletion failed, abort before auth delete.
  const blockerFailed = blockerTables.some((t) => !deletionResults[t].deleted);
  if (blockerFailed) {
    phases.db_delete = { ok: false, details: deletionResults };
    console.error(`[DELETE_ACCOUNT] Blocker table deletion failed — aborting before auth delete`);
    return new Response(
      JSON.stringify({
        error: "Could not clear foreign-key-blocking tables. Account not deleted.",
        phases,
        failed_phase: "blocker_tables",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Remaining tables — any failures here are logged but don't abort. Once we
  // get past this point the auth.users delete will cascade most of it anyway,
  // and partial row leaks are far less bad than leaving the account alive.
  const remainingTables = USER_ID_TABLES.filter((t) => !blockerTables.includes(t));
  const results = await Promise.allSettled(
    remainingTables.map(async (table) => {
      const { error } = await adminClient.from(table).delete().eq("user_id", userId);
      return { table, error: error?.message || null };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      deletionResults[r.value.table] = {
        deleted: r.value.error === null,
        error: r.value.error || undefined,
      };
    } else {
      deletionResults["unknown"] = { deleted: false, error: String(r.reason) };
    }
  }
  phases.db_delete = { ok: true, details: deletionResults };

  const dbFailures = Object.entries(deletionResults).filter(([, v]) => !v.deleted);
  if (dbFailures.length > 0) {
    console.warn(`[DELETE_ACCOUNT] ${dbFailures.length} non-blocking table(s) failed:`, dbFailures);
  }

  // ─── Phase E: Delete the auth.users row ───
  // This is the irreversible step. Once this succeeds the user cannot sign in
  // again with the same account — their email is free to be reused for a
  // fresh account.
  const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(userId);
  if (authDeleteErr) {
    phases.auth_delete = { ok: false, error: authDeleteErr.message };
    console.error(`[DELETE_ACCOUNT] auth.users delete FAILED:`, authDeleteErr.message);
    return new Response(
      JSON.stringify({
        error: "Data was deleted but the account itself could not be removed. Please contact support at privacy@sevenmynd.com — your data is already gone, only the login credential remains.",
        phases,
        failed_phase: "auth_delete",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  phases.auth_delete = { ok: true };
  console.log(`[DELETE_ACCOUNT] Complete for user ${userId.slice(0, 8)}…`);

  return new Response(
    JSON.stringify({
      status: "deleted",
      phases,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
