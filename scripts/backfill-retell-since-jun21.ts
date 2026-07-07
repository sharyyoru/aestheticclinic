/**
 * Backfill Retell call data since June 21, 2026
 *
 * Two tables are backfilled:
 *   1. retell_request_logs — one row per lifecycle event (call_started /
 *      call_ended / call_analyzed) for every Retell call. This is what the
 *      /agents "Retell Logs" tab reads. After the migration to conversation-
 *      flow agents and before the logRetellAgentRequest fix deployed ~Jun 25,
 *      no rows were written for outbound workflow-triggered calls.
 *
 *   2. call_logs — one row per call. This is what the patient CRM "Call Logs"
 *      tab reads. Workflow-triggered calls were pointing webhook_url to the
 *      wrong endpoint, so they were never written here either.
 *
 * The script is fully idempotent: it skips any call_id that already has the
 * relevant rows. Run it as many times as needed.
 *
 * Usage:
 *   npx tsx scripts/backfill-retell-since-jun21.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), ".env.local");
const env: Record<string, string> = {};
for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].split(/\s+#/)[0].trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RETELL_KEY   = env.RETELL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !RETELL_KEY) {
  console.error("Missing env vars:", { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY, RETELL_KEY: !!RETELL_KEY });
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── cutoff ────────────────────────────────────────────────────────────────────
// We want everything since June 21 00:00 UTC (the last date showing in the tab)
const CUTOFF_MS = new Date("2026-06-21T00:00:00Z").getTime();

// ── helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function retellFetch(path: string, body?: unknown, method = "POST") {
  const res = await fetch(`https://api.retellai.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${RETELL_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Retell ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

/** Normalize phone to E.164, stripping non-digit/+ chars */
function normPhone(raw: string | undefined | null): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length >= 10) return `+${digits}`;
  return raw;
}

/** Last N digits for fuzzy phone matching */
function phoneTail(raw: string | undefined | null, n = 9): string {
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "").slice(-n);
}

/** Fetch a patient row by id, or null */
async function patientById(id: string) {
  const { data } = await sb.from("patients").select("id,first_name,last_name,phone,email").eq("id", id).maybeSingle();
  return data as null | { id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string | null };
}

/** Fetch a patient row by phone tail, or null */
async function patientByPhone(phone: string) {
  if (!phone) return null;
  const tail = phoneTail(phone);
  if (!tail) return null;
  const { data } = await sb
    .from("patients")
    .select("id,first_name,last_name,phone,email")
    .ilike("phone", `%${tail}%`)
    .limit(1)
    .maybeSingle();
  return data as null | { id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string | null };
}

// ── Retell list-calls pagination ──────────────────────────────────────────────
async function fetchAllRetellCallsSince(cutoffMs: number) {
  const all: any[] = [];
  let pagination_key: string | undefined;
  let page = 0;

  console.log("Fetching calls from Retell API …");
  while (true) {
    page++;
    const body: Record<string, unknown> = { limit: 100, sort_order: "descending" };
    if (pagination_key) body.pagination_key = pagination_key;

    const data: any = await retellFetch("/v2/list-calls", body);
    // Retell returns an array directly (not wrapped in a key)
    const calls: any[] = Array.isArray(data) ? data : (data.calls ?? []);

    if (!calls.length) break;

    let hitCutoff = false;
    for (const c of calls) {
      const ts = typeof c.start_timestamp === "number" ? c.start_timestamp : 0;
      if (ts < cutoffMs) { hitCutoff = true; break; }
      all.push(c);
    }

    console.log(`  page ${page}: got ${calls.length} calls (kept ${all.length} total so far)`);

    if (hitCutoff) break;

    // Retell uses the last call_id as a pagination cursor
    pagination_key = calls[calls.length - 1]?.call_id;
    if (!pagination_key) break;

    await sleep(200); // gentle rate-limit
  }
  return all;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Retell Backfill (since Jun 21 2026) ===\n");

  // 1. Fetch all Retell calls since Jun 21
  const retellCalls: any[] = await fetchAllRetellCallsSince(CUTOFF_MS);
  console.log(`\nTotal Retell calls since cutoff: ${retellCalls.length}\n`);

  if (!retellCalls.length) {
    console.log("Nothing to backfill.");
    return;
  }

  // 2. Collect call_ids already in retell_request_logs and call_logs
  const allCallIds = retellCalls.map((c) => c.call_id).filter(Boolean);

  const { data: existingLogRows } = await sb
    .from("retell_request_logs")
    .select("call_id,event_type")
    .in("call_id", allCallIds);
  const existingLogSet = new Set((existingLogRows || []).map((r: any) => `${r.call_id}::${r.event_type}`));

  const { data: existingCallLogRows } = await sb
    .from("call_logs")
    .select("call_id")
    .in("call_id", allCallIds);
  const existingCallLogSet = new Set((existingCallLogRows || []).map((r: any) => r.call_id));

  console.log(`retell_request_logs rows for these call_ids already: ${existingLogRows?.length ?? 0}`);
  console.log(`call_logs rows for these call_ids already: ${existingCallLogRows?.length ?? 0}\n`);

  // counters
  let rlInserted = 0, rlSkipped = 0;
  let clInserted = 0, clSkipped = 0, clNoPatient = 0;

  // 3. Process each call
  for (const c of retellCalls) {
    const callId: string = c.call_id;
    if (!callId) continue;

    const startedAt = c.start_timestamp ? new Date(c.start_timestamp).toISOString() : null;
    const direction: string = c.direction || "outbound";
    const metadata: Record<string, unknown> = c.metadata || {};

    // ── 3a. retell_request_logs ───────────────────────────────────────────────
    // Synthesize one row per lifecycle event that existed for this call.
    // For calls that ended / were analyzed we emit call_ended and call_analyzed.
    // For ongoing/unanswered calls we emit at least call_started.
    const events: string[] = [];
    if (c.call_status === "ended" || c.call_status === "error") {
      events.push("call_started", "call_ended", "call_analyzed");
    } else if (c.call_status === "not_connected") {
      events.push("call_started", "call_ended");
    } else {
      events.push("call_started");
    }

    // Resolve patient_id for the log row
    const metaPid = typeof metadata.patient_id === "string" ? metadata.patient_id : null;

    for (const event of events) {
      const key = `${callId}::${event}`;
      if (existingLogSet.has(key)) { rlSkipped++; continue; }

      const row = {
        call_id: callId,
        event_type: event,
        function_name: null as string | null,
        request_body: { event, call: c } as unknown as Record<string, unknown>,
        metadata: metadata as Record<string, unknown>,
        dynamic_variables: c.retell_llm_dynamic_variables ?? null,
        call_data: c,
        patient_id: metaPid,
      };

      const { error } = await sb.from("retell_request_logs").insert(row);
      if (error) {
        console.error(`  [RL] insert error for ${callId}/${event}:`, error.message);
      } else {
        rlInserted++;
      }
    }

    // ── 3b. call_logs ─────────────────────────────────────────────────────────
    if (existingCallLogSet.has(callId)) { clSkipped++; continue; }

    // Resolve patient
    let patient: Awaited<ReturnType<typeof patientById>> = null;
    if (metaPid) patient = await patientById(metaPid);
    if (!patient) {
      const recipientPhone = direction === "outbound" ? c.to_number : c.from_number;
      if (recipientPhone) patient = await patientByPhone(recipientPhone);
    }

    if (!patient) { clNoPatient++; }

    // Extract call analysis
    const summary: string | null = c.call_analysis?.call_summary ?? null;
    const transcript: string | null = c.transcript ?? null;
    const durationSeconds: number | null =
      c.end_timestamp && c.start_timestamp
        ? Math.round((c.end_timestamp - c.start_timestamp) / 1000)
        : null;

    // Build transcript turns from transcript_object if available
    let transcriptTurns: Array<{ role: string; content: string }> | null = null;
    if (Array.isArray(c.transcript_object) && c.transcript_object.length > 0) {
      transcriptTurns = c.transcript_object.map((t: any) => ({
        role: t.role === "agent" ? "agent" : "patient",
        content: t.content || "",
      }));
    }

    // Service interest from metadata or dynamic variables
    const serviceInterest: string | null =
      (metadata.service_name as string) ??
      (c.retell_llm_dynamic_variables?.service_name as string) ??
      null;

    const patientFullName = patient
      ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim()
      : (metadata.patient_name as string | undefined) ?? "Unknown";

    const clRow = {
      call_id: callId,
      patient_id: patient?.id ?? null,
      deal_id: typeof metadata.deal_id === "string" ? metadata.deal_id : null,
      direction,
      agent_id: c.agent_id ?? null,
      from_number: c.from_number ?? null,
      to_number: c.to_number ?? null,
      call_status: c.call_status ?? null,
      disconnection_reason: c.disconnection_reason ?? null,
      duration_seconds: durationSeconds,
      summary,
      transcript,
      transcript_turns: transcriptTurns,
      service_interest: serviceInterest,
      source: "retell_backfill",
      started_at: startedAt,
    };

    const { error: clErr } = await sb.from("call_logs").insert(clRow);
    if (clErr) {
      console.error(`  [CL] insert error for ${callId}:`, clErr.message);
    } else {
      clInserted++;
      if (patient) {
        console.log(`  ✓ call_log ${callId} → patient ${patientFullName} (${direction}, ${c.call_status})`);
      } else {
        console.log(`  ✓ call_log ${callId} → no patient match (${direction}, ${c.call_status}, to=${c.to_number})`);
      }
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log("\n=== Backfill Complete ===");
  console.log(`retell_request_logs: +${rlInserted} inserted, ${rlSkipped} already existed`);
  console.log(`call_logs:           +${clInserted} inserted, ${clSkipped} already existed, ${clNoPatient} with no patient match`);

  // ── 5. Verify: show newest retell_request_logs ────────────────────────────
  console.log("\n=== Newest 15 retell_request_logs after backfill ===");
  const { data: newest } = await sb
    .from("retell_request_logs")
    .select("created_at,event_type,function_name,call_id,patient_id")
    .order("created_at", { ascending: false })
    .limit(15);
  for (const r of newest || []) {
    const fn = r.function_name ? ` fn=${r.function_name}` : "";
    const pid = r.patient_id ? ` pid=${r.patient_id}` : "";
    console.log(`  ${r.created_at} | ${r.event_type}${fn} | ${r.call_id}${pid}`);
  }

  // ── 6. Verify: newest call_logs ───────────────────────────────────────────
  console.log("\n=== Newest 15 call_logs after backfill ===");
  const { data: newestCl } = await sb
    .from("call_logs")
    .select("created_at,started_at,direction,call_status,source,patient_id,to_number")
    .order("created_at", { ascending: false })
    .limit(15);
  for (const r of newestCl || []) {
    console.log(`  ${r.created_at} | ${r.direction} | ${r.call_status} | src=${r.source} | pid=${r.patient_id ?? "null"} | to=${r.to_number}`);
  }

  // ── 7. Count total retell_request_logs ────────────────────────────────────
  const { count: rlTotal } = await sb
    .from("retell_request_logs")
    .select("*", { count: "exact", head: true });
  console.log(`\nTotal retell_request_logs: ${rlTotal}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
