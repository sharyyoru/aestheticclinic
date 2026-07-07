import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)/);
  if (m) env[m[1]] = m[2].split(/\s+#/)[0].trim().replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const RETELL_KEY = env.RETELL_API_KEY;

const PATIENT_ID = "f78e8d18-d666-4055-869d-bbb42d8627f0";
const CALL_ID = "call_91fc4ed7637cb826d5bb1e27dc2"; // from Retell logs

async function main() {
  // 1. Patient record
  const { data: patient } = await sb.from("patients").select("id,first_name,last_name,phone").eq("id", PATIENT_ID).maybeSingle();
  console.log("Patient:", JSON.stringify(patient));

  // 2. call_logs for this patient
  const { data: callLogs } = await sb.from("call_logs").select("*").eq("patient_id", PATIENT_ID);
  console.log(`\ncall_logs for patient (${callLogs?.length ?? 0} rows):`, JSON.stringify(callLogs, null, 2));

  // 3. call_logs by call_id
  const { data: byCallId } = await sb.from("call_logs").select("*").eq("call_id", CALL_ID);
  console.log(`\ncall_logs for call_id ${CALL_ID} (${byCallId?.length ?? 0} rows):`, JSON.stringify(byCallId, null, 2));

  // 4. retell_request_logs for this patient
  const { data: rlogs } = await sb.from("retell_request_logs").select("call_id,event_type,patient_id,created_at").eq("patient_id", PATIENT_ID).order("created_at", { ascending: false });
  console.log(`\nretell_request_logs for patient (${rlogs?.length ?? 0} rows):`);
  for (const r of rlogs || []) console.log(`  ${r.created_at} | ${r.event_type} | ${r.call_id}`);

  // 5. Fetch the actual Retell call to see metadata
  console.log(`\nFetching Retell API for call ${CALL_ID}...`);
  const res = await fetch(`https://api.retellai.com/v2/get-call/${CALL_ID}`, {
    headers: { Authorization: `Bearer ${RETELL_KEY}` },
  });
  const callData = await res.json();
  console.log("Retell call metadata:", JSON.stringify(callData.metadata));
  console.log("Retell call to_number:", callData.to_number);
  console.log("Retell call from_number:", callData.from_number);
  console.log("Retell call agent_id:", callData.agent_id);
  console.log("Retell call webhook_url:", callData.webhook_url ?? "none");
  console.log("Retell call status:", callData.call_status);

  // 6. Check if there's a call_log with same call_id but different/null patient
  const { data: anyLog } = await sb.from("call_logs").select("*").eq("call_id", CALL_ID);
  console.log(`\nAll call_logs matching call_id (any patient):`, JSON.stringify(anyLog, null, 2));

  // 7. Check if patient phone matches any call_logs
  if (patient?.phone) {
    const tail = patient.phone.replace(/[^\d]/g, "").slice(-9);
    const { data: byPhone } = await sb.from("call_logs").select("call_id,patient_id,to_number,direction,call_status").ilike("to_number", `%${tail}%`);
    console.log(`\ncall_logs matching phone tail ${tail} (${byPhone?.length ?? 0} rows):`, JSON.stringify(byPhone, null, 2));
  }
}

main().catch(console.error);
