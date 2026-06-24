/**
 * Backfill / reconcile the structured call_logs table from retell_request_logs
 * (the authoritative record of every Retell webhook event, including the in-call
 * `send_whatsapp` function). This is far more complete than the old approach of
 * scraping patients.notes:
 *   - resolves the patient by explicit patient_id OR by phone match
 *     (to_number for outbound, from_number for inbound) — most rows have no
 *     patient_id, so phone matching is essential.
 *   - records whatsapp_sent_at when a `send_whatsapp` call exists for the call_id.
 *
 * Note: retell_request_logs is pruned after ~30 days, so historical call_logs
 * rows (originally backfilled from notes) are preserved; this only inserts new
 * calls and enriches existing ones (patient_id / whatsapp_sent_at / recording).
 *
 * Idempotent. Run: npx tsx scripts/backfill-call-logs.ts          (dry run)
 *                  npx tsx scripts/backfill-call-logs.ts --write   (apply)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseTranscriptTurns } from "../src/lib/callLog";

for (const l of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const WRITE = process.argv.includes("--write");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type CallData = Record<string, unknown>;

type Agg = {
  callId: string;
  patientId: string | null;
  direction: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  agentId: string | null;
  callStatus: string | null;
  disconnectionReason: string | null;
  startTs: number | null;
  endTs: number | null;
  durationMs: number | null;
  transcript: string | null;
  transcriptObject: unknown;
  summary: string | null;
  serviceInterest: string | null;
  waSentAt: string | null;
  waRecipient: string | null;
  earliestRow: string;
  conf: "pid" | "recipient" | "wa" | "none";
};

async function ensureColumn() {
  const { error } = await supabase.rpc("exec_sql", {
    sql: "ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz;",
  });
  if (error) console.warn(`[!] could not auto-add whatsapp_sent_at via exec_sql (${error.message}). Apply the migration manually if writes fail.`);
  else console.log("ensured call_logs.whatsapp_sent_at column exists");
}

async function main() {
  if (WRITE) await ensureColumn();

  // 1. Pull every retell log (paginate to be safe).
  const logs: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("retell_request_logs")
      .select("call_id, event_type, function_name, created_at, args, dynamic_variables, call_data, patient_id")
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) { console.error("retell_request_logs query error:", error.message); process.exit(1); }
    logs.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.log(`retell_request_logs rows: ${logs.length}`);

  // 2. Patient phone-tail map.
  const patients: { id: string; phone: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("patients").select("id, phone").not("phone", "is", null).range(from, from + 999);
    patients.push(...((data as { id: string; phone: string }[]) || []));
    if (!data || data.length < 1000) break;
  }
  // Index by last-9 digits, but keep ALL candidates so we can disambiguate
  // country-code collisions (e.g. +33 7 81 66 49 01 vs Swiss 0 78 166 49 01
  // both end in 781664901) by longest full-suffix match.
  const digitsOnly = (s?: string | null) => (s || "").replace(/[^\d]/g, "");
  const byTail9 = new Map<string, string[]>();
  const digitsById = new Map<string, string>();
  for (const p of patients) {
    const d = digitsOnly(p.phone);
    const tl = d.slice(-9);
    if (tl.length < 8) continue;
    digitsById.set(p.id, d);
    const arr = byTail9.get(tl) || [];
    arr.push(p.id);
    byTail9.set(tl, arr);
  }
  console.log(`patients with phone: ${patients.length} (distinct tails: ${byTail9.size})`);

  // 3. Group rows into per-call aggregates.
  const calls = new Map<string, Agg>();
  for (const r of logs) {
    const callId = r.call_id as string;
    if (!callId) continue;
    const cd = (r.call_data || {}) as CallData;
    const dv = (r.dynamic_variables || {}) as CallData;
    const args = (r.args || {}) as CallData;
    const createdAt = r.created_at as string;

    let a = calls.get(callId);
    if (!a) {
      a = {
        callId, patientId: null, direction: null, fromNumber: null, toNumber: null,
        agentId: null, callStatus: null, disconnectionReason: null, startTs: null, endTs: null,
        durationMs: null, transcript: null, transcriptObject: null, summary: null,
        serviceInterest: null, waSentAt: null, waRecipient: null, earliestRow: createdAt, conf: "none",
      };
      calls.set(callId, a);
    }
    if (createdAt < a.earliestRow) a.earliestRow = createdAt;
    if (r.patient_id && !a.patientId) a.patientId = r.patient_id as string;
    if (cd.direction) a.direction = cd.direction as string;
    if (cd.to_number) a.toNumber = cd.to_number as string;
    if (cd.from_number) a.fromNumber = cd.from_number as string;
    if (cd.agent_id) a.agentId = cd.agent_id as string;
    if (cd.call_status) a.callStatus = cd.call_status as string;
    if (cd.disconnection_reason) a.disconnectionReason = cd.disconnection_reason as string;
    if (typeof cd.start_timestamp === "number") a.startTs = cd.start_timestamp as number;
    if (typeof cd.end_timestamp === "number") a.endTs = cd.end_timestamp as number;
    if (typeof cd.duration_ms === "number") a.durationMs = cd.duration_ms as number;
    const tx = cd.transcript as string | undefined;
    if (tx && (!a.transcript || tx.length > a.transcript.length)) { a.transcript = tx; a.transcriptObject = cd.transcript_object; }
    const analysis = (cd.call_analysis || {}) as CallData;
    if (analysis.call_summary) a.summary = analysis.call_summary as string;
    if (dv.service_name && !a.serviceInterest) a.serviceInterest = dv.service_name as string;

    if (r.function_name === "send_whatsapp") {
      if (!a.waSentAt || createdAt < a.waSentAt) a.waSentAt = createdAt;
      a.waRecipient = (args.phone_number as string) || (cd.to_number as string) || a.waRecipient;
    }
  }
  console.log(`distinct calls: ${calls.size}`);

  // 4. Resolve patient + build rows.
  const matchPhone = (num?: string | null) => {
    const cd = digitsOnly(num);
    const tl = cd.slice(-9);
    if (tl.length < 8) return null;
    const candidates = byTail9.get(tl);
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    // Disambiguate by longest shared suffix with the full call number.
    let best: string | null = null;
    let bestLen = 0;
    for (const id of candidates) {
      const pd = digitsById.get(id) || "";
      let k = 0;
      while (k < pd.length && k < cd.length && pd[pd.length - 1 - k] === cd[cd.length - 1 - k]) k++;
      if (k > bestLen) { bestLen = k; best = id; }
    }
    return best;
  };
  let resolvedByPid = 0, resolvedByPhone = 0, unresolved = 0, withWa = 0;
  for (const a of calls.values()) {
    if (a.patientId) { resolvedByPid++; a.conf = "pid"; }
    else {
      // Match by the RECIPIENT only. For outbound the from_number is always the
      // clinic's caller-ID, so never match on it (it would wrongly bucket every
      // outbound call onto the clinic-number "caller" patient).
      const recipient = a.direction === "inbound" ? a.fromNumber : a.toNumber;
      const byRecipient = matchPhone(recipient);
      if (byRecipient) { a.patientId = byRecipient; a.conf = "recipient"; }
      else {
        const byWa = matchPhone(a.waRecipient);
        if (byWa) { a.patientId = byWa; a.conf = "wa"; }
      }
      if (a.patientId) resolvedByPhone++; else unresolved++;
    }
    if (a.waSentAt) withWa++;
  }
  console.log(`resolved by patient_id: ${resolvedByPid} | by phone: ${resolvedByPhone} | unresolved: ${unresolved}`);
  console.log(`calls with send_whatsapp: ${withWa}`);

  // 5. Existing call_logs (id + current values) keyed by call_id.
  const existing = new Map<string, { id: string; patient_id: string | null; whatsapp_sent_at: string | null; recording_url: string | null; summary: string | null; source: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("call_logs")
      .select("id, call_id, patient_id, whatsapp_sent_at, recording_url, summary, source")
      .range(from, from + 999);
    if (error) { console.error("call_logs query error (migration applied?):", error.message); process.exit(1); }
    for (const r of data || []) if (r.call_id) existing.set(r.call_id as string, r as never);
    if (!data || data.length < 1000) break;
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

  for (const a of calls.values()) {
    if (!a.patientId) continue; // can't attach to a patient → skip (visible in /agents only)
    const startedAt = a.startTs ? new Date(a.startTs).toISOString() : a.earliestRow;
    const durationSeconds = a.startTs && a.endTs ? Math.round((a.endTs - a.startTs) / 1000)
      : a.durationMs ? Math.round(a.durationMs / 1000) : null;
    const turns = parseTranscriptTurns({ transcript_object: a.transcriptObject as never, transcript: a.transcript || undefined });

    const ex = existing.get(a.callId);
    const highConf = a.conf === "pid" || a.conf === "recipient" || a.conf === "wa";
    if (ex) {
      const patch: Record<string, unknown> = {};
      // retell_request_logs is the ground truth for who was actually called, so
      // a confident recipient match overrides a prior (notes-based) mis-match.
      if (a.patientId && highConf && ex.patient_id !== a.patientId) {
        patch.patient_id = a.patientId;
      }
      if (!ex.whatsapp_sent_at && a.waSentAt) patch.whatsapp_sent_at = a.waSentAt;
      if (!ex.summary && a.summary) patch.summary = a.summary;
      if (Object.keys(patch).length > 0) toUpdate.push({ id: ex.id, patch });
    } else {
      toInsert.push({
        call_id: a.callId,
        patient_id: a.patientId,
        direction: a.direction || "outbound",
        agent_id: a.agentId,
        from_number: a.fromNumber,
        to_number: a.toNumber,
        call_status: a.callStatus,
        disconnection_reason: a.disconnectionReason,
        duration_seconds: durationSeconds,
        summary: a.summary,
        transcript: a.transcript,
        transcript_turns: turns.length > 0 ? turns : null,
        service_interest: a.serviceInterest,
        whatsapp_sent_at: a.waSentAt,
        source: "retell_logs",
        started_at: startedAt,
      });
    }
  }

  console.log(`\nto insert: ${toInsert.length} | to update: ${toUpdate.length}`);
  if (!WRITE) {
    console.log("\nDRY RUN — re-run with --write. Sample insert:");
    console.log(JSON.stringify(toInsert[0], null, 2));
    return;
  }

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error } = await supabase.from("call_logs").insert(chunk);
    if (error) console.error(`insert chunk ${i}:`, error.message);
    else inserted += chunk.length;
  }
  let updated = 0;
  for (const u of toUpdate) {
    const { error } = await supabase.from("call_logs").update(u.patch).eq("id", u.id);
    if (error) console.error(`update ${u.id}:`, error.message);
    else updated++;
  }
  console.log(`inserted: ${inserted} | updated: ${updated}`);

  // ── Pass 2: global attribution reconcile ────────────────────────────────
  // Re-match EVERY call_log (incl. historical notes-based rows) by its own
  // stored recipient number — to_number for outbound, from_number for inbound.
  // This corrects mis-bucketing where outbound calls were attributed to the
  // patient whose notes happened to hold the transcript (often the clinic's
  // own caller-ID number). The from_number of an outbound call is never used.
  const allLogs: { id: string; direction: string | null; to_number: string | null; from_number: string | null; patient_id: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("call_logs")
      .select("id, direction, to_number, from_number, patient_id")
      .range(from, from + 999);
    allLogs.push(...((data as typeof allLogs) || []));
    if (!data || data.length < 1000) break;
  }
  const fixes: { id: string; patient_id: string }[] = [];
  for (const r of allLogs) {
    const recipient = r.direction === "inbound" ? r.from_number : r.to_number;
    const m = matchPhone(recipient);
    if (m && m !== r.patient_id) fixes.push({ id: r.id, patient_id: m });
  }
  console.log(`\npass 2 reconcile: ${allLogs.length} logs scanned, ${fixes.length} attribution fixes`);
  if (WRITE) {
    let fixed = 0;
    for (const f of fixes) {
      const { error } = await supabase.from("call_logs").update({ patient_id: f.patient_id }).eq("id", f.id);
      if (error) console.error(`pass2 fix ${f.id}:`, error.message);
      else fixed++;
    }
    console.log(`pass 2 applied: ${fixed}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
