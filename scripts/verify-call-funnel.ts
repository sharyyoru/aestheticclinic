/**
 * Verifies the call -> WhatsApp -> booking attribution the Call Logs tab does,
 * but server-side across ALL patients, so we can confirm it lights up and find
 * concrete example patients to inspect.
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
const SIX_H = 6 * 60 * 60 * 1000;

async function main() {
  const { data: logs } = await s
    .from("call_logs")
    .select("id, patient_id, direction, started_at, created_at")
    .not("patient_id", "is", null)
    .limit(5000);
  const byPatient = new Map<string, { at: number; dir: string }[]>();
  for (const r of logs || []) {
    const at = new Date((r.started_at as string) || (r.created_at as string)).getTime();
    const arr = byPatient.get(r.patient_id as string) || [];
    arr.push({ at, dir: (r.direction as string) || "inbound" });
    byPatient.set(r.patient_id as string, arr);
  }

  let patientsWithWa = 0, patientsConverted = 0, callsConverted = 0;
  const examples: string[] = [];

  for (const [pid, calls] of byPatient) {
    calls.sort((a, b) => a.at - b.at);
    const [{ data: wa }, { data: appt }] = await Promise.all([
      s.from("whatsapp_messages").select("sent_at, created_at, direction").eq("patient_id", pid),
      s.from("appointments").select("created_at, start_time").eq("patient_id", pid),
    ]);
    const waTimes = (wa || [])
      .filter((m) => !m.direction || m.direction === "outbound")
      .map((m) => new Date((m.sent_at as string) || (m.created_at as string)).getTime())
      .filter((n) => !Number.isNaN(n));
    const apptTimes = (appt || [])
      .map((a) => new Date(a.created_at as string).getTime())
      .filter((n) => !Number.isNaN(n));

    const firstCall = calls[0].at;
    const waHit = waTimes.some((t) => calls.some((c) => t >= c.at && t - c.at <= SIX_H));
    const conv = apptTimes.filter((t) => t >= firstCall);
    if (waHit) patientsWithWa++;
    if (conv.length > 0) { patientsConverted++; callsConverted += conv.length; }
    if ((waHit || conv.length > 0) && examples.length < 10) {
      examples.push(`  ${pid}  calls=${calls.length} wa=${waHit ? "Y" : "-"} bookingsAfterCall=${conv.length}`);
    }
  }

  console.log(`patients with calls: ${byPatient.size}`);
  console.log(`patients with WhatsApp sent after a call: ${patientsWithWa}`);
  console.log(`patients with a booking after a call (converted): ${patientsConverted}`);
  console.log(`total bookings attributed to calls: ${callsConverted}`);
  console.log(`\nExamples (open /patients/<id>?m_tab=crm&crm_sub=call_logs):`);
  console.log(examples.join("\n") || "  (none)");
}

main().catch((e) => { console.error(e); process.exit(1); });
