/**
 * Compare enrolled patients in the "Request for Information" workflow
 * against call_logs to find any that never received a call attempt.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)/);
  if (m) env[m[1]] = m[2].split(/\s+#/)[0].trim().replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Find the "Request for Information" workflow
  const { data: workflows } = await sb
    .from("workflows")
    .select("id, name")
    .ilike("name", "%request for information%");
  console.log("Workflows found:", JSON.stringify(workflows));

  if (!workflows?.length) {
    console.log("No matching workflow found — trying to list all workflows:");
    const { data: all } = await sb.from("workflows").select("id, name").limit(20);
    console.log(JSON.stringify(all, null, 2));
    return;
  }

  const workflowId = workflows[0].id;
  console.log(`\nUsing workflow: "${workflows[0].name}" (${workflowId})`);

  // 2. Get all enrolled patients
  const { data: enrollments, count: enrollCount } = await sb
    .from("workflow_enrollments")
    .select("patient_id, status, enrolled_at, patients(id, first_name, last_name, phone)", { count: "exact" })
    .eq("workflow_id", workflowId);

  console.log(`\nTotal enrollments: ${enrollCount}`);

  const enrolledPatientIds = (enrollments || []).map((e: any) => e.patient_id).filter(Boolean);
  const enrolledUnique = [...new Set(enrolledPatientIds)];
  console.log(`Unique enrolled patients: ${enrolledUnique.length}`);

  // 3. Get all call_logs for enrolled patients
  const { data: callLogRows } = await sb
    .from("call_logs")
    .select("patient_id, call_id, direction, call_status, started_at")
    .in("patient_id", enrolledUnique)
    .eq("direction", "outbound");

  const patientsWithCalls = new Set((callLogRows || []).map((r: any) => r.patient_id));
  console.log(`Enrolled patients with at least 1 outbound call log: ${patientsWithCalls.size}`);

  // 4. Find enrolled patients with NO call log at all
  const missing = (enrollments || []).filter((e: any) => !patientsWithCalls.has(e.patient_id));
  console.log(`\nEnrolled patients with ZERO outbound call logs: ${missing.length}`);

  if (missing.length) {
    console.log("\nMissing patients:");
    for (const e of missing) {
      const p = (e as any).patients;
      const name = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "unknown";
      console.log(`  - ${name} | patient_id=${e.patient_id} | enrolled=${e.enrolled_at} | status=${e.status}`);
    }
  }

  // 5. Status breakdown of enrollments
  const statusTally: Record<string, number> = {};
  for (const e of enrollments || []) {
    const s = (e as any).status || "unknown";
    statusTally[s] = (statusTally[s] || 0) + 1;
  }
  console.log("\nEnrollment status breakdown:", JSON.stringify(statusTally, null, 2));

  // 6. Call attempt count per enrolled patient
  const callCountByPatient: Record<string, number> = {};
  for (const r of callLogRows || []) {
    callCountByPatient[r.patient_id] = (callCountByPatient[r.patient_id] || 0) + 1;
  }
  const callCounts = Object.values(callCountByPatient) as number[];
  if (callCounts.length) {
    const avg = (callCounts.reduce((a, b) => a + b, 0) / callCounts.length).toFixed(1);
    const max = Math.max(...callCounts);
    console.log(`\nAmong patients with calls — avg attempts: ${avg}, max: ${max}`);
  }

  // 7. Check retell_scheduled_calls for patients missing call logs
  if (missing.length) {
    const missingIds = missing.map((e: any) => e.patient_id).filter(Boolean);
    const { data: scheduled } = await sb
      .from("retell_scheduled_calls")
      .select("patient_id, status, scheduled_for, dispatched_at, retell_call_id")
      .in("patient_id", missingIds);
    console.log(`\nretell_scheduled_calls for missing patients (${scheduled?.length ?? 0} rows):`);
    for (const s of scheduled || []) {
      console.log(`  pid=${s.patient_id} | status=${s.status} | scheduled=${s.scheduled_for} | dispatched=${s.dispatched_at} | retell_id=${s.retell_call_id}`);
    }
  }
}

main().catch(console.error);
