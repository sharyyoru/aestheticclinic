/**
 * Verifies the call -> WhatsApp -> booking funnel the Call Logs tab renders,
 * using the authoritative fields: call_logs.whatsapp_sent_at (set from the
 * Retell send_whatsapp function by exact call_id) and the patient's bookings.
 * A call converts only when it has whatsapp_sent_at AND a booking was created
 * within a week after the call.
 *
 * Pass a patient id as argv[2] to inspect a single patient.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const WEEK = 7 * 24 * 60 * 60 * 1000;
const ms = (x?: string | null) => (x ? new Date(x).getTime() : NaN);

async function inspectPatient(pid: string) {
  const { data: logs } = await s
    .from("call_logs")
    .select("call_id, direction, started_at, created_at, whatsapp_sent_at, to_number")
    .eq("patient_id", pid)
    .order("started_at", { ascending: true });
  const { data: appts } = await s.from("appointments").select("created_at, start_time").eq("patient_id", pid);
  console.log(`\n=== patient ${pid}: ${logs?.length || 0} calls, ${appts?.length || 0} appointments ===`);
  for (const c of logs || []) {
    const ct = ms((c.started_at as string) || (c.created_at as string));
    const converted = c.whatsapp_sent_at && (appts || []).some((a) => { const at = ms(a.created_at as string); return at >= ct && at - ct <= WEEK; });
    console.log(`  ${c.started_at || c.created_at}  ${c.direction}  to=${c.to_number}  wa=${c.whatsapp_sent_at ? "YES" : "-"}  converted=${converted ? "YES" : "-"}`);
  }
}

async function main() {
  const target = process.argv[2];
  if (target) { await inspectPatient(target); return; }

  const { data: logs } = await s
    .from("call_logs")
    .select("patient_id, direction, started_at, created_at, whatsapp_sent_at")
    .not("patient_id", "is", null)
    .limit(5000);
  const byPatient = new Map<string, { ct: number; wa: number | null }[]>();
  let totalWaCalls = 0;
  for (const r of logs || []) {
    const ct = ms((r.started_at as string) || (r.created_at as string));
    const wa = r.whatsapp_sent_at ? ms(r.whatsapp_sent_at as string) : null;
    if (wa) totalWaCalls++;
    const arr = byPatient.get(r.patient_id as string) || [];
    arr.push({ ct, wa });
    byPatient.set(r.patient_id as string, arr);
  }

  let convertingCalls = 0, convertedPatients = 0;
  for (const [pid, calls] of byPatient) {
    if (!calls.some((c) => c.wa)) continue;
    const { data: appts } = await s.from("appointments").select("created_at").eq("patient_id", pid);
    const apptTimes = (appts || []).map((a) => ms(a.created_at as string)).filter((n) => !Number.isNaN(n));
    let any = false;
    for (const c of calls) {
      if (!c.wa) continue;
      if (apptTimes.some((t) => t >= c.ct && t - c.ct <= WEEK)) { convertingCalls++; any = true; }
    }
    if (any) convertedPatients++;
  }

  console.log(`call_logs total: ${logs?.length}`);
  console.log(`calls with whatsapp_sent_at: ${totalWaCalls}`);
  console.log(`converting calls (WhatsApp + booking within 1 week): ${convertingCalls}`);
  console.log(`patients converted: ${convertedPatients}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
