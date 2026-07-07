/**
 * Fix call_logs rows where patient_id was resolved by phone lookup but the
 * Retell call metadata contains the correct patient_id.
 *
 * Strategy: for every call_log that has a call_id also present in
 * retell_request_logs (or fetchable from Retell API), if the metadata
 * patient_id differs from the stored patient_id, update the row.
 *
 * We fetch the call data from the Retell API for any call_log whose
 * patient_id doesn't match what the Retell metadata says.
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
const RETELL_KEY = env.RETELL_API_KEY;

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function retellGetCall(callId: string) {
  const res = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
    headers: { Authorization: `Bearer ${RETELL_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  // Fetch all call_logs that have a call_id (all of them effectively)
  // We'll process in batches
  const { data: allLogs } = await sb
    .from("call_logs")
    .select("id,call_id,patient_id,to_number,direction")
    .not("call_id", "is", null)
    .order("created_at", { ascending: false });

  console.log(`Total call_logs to check: ${allLogs?.length ?? 0}`);

  let fixed = 0;
  let checked = 0;
  let noMeta = 0;
  let alreadyCorrect = 0;

  for (const log of allLogs || []) {
    checked++;
    if (checked % 50 === 0) console.log(`  Checked ${checked}/${allLogs?.length}...`);

    const callData = await retellGetCall(log.call_id);
    await sleep(50); // gentle rate limit

    if (!callData) { noMeta++; continue; }

    const metaPatientId = callData.metadata?.patient_id;
    if (!metaPatientId) { noMeta++; continue; }

    if (metaPatientId === log.patient_id) { alreadyCorrect++; continue; }

    // Metadata says a different patient_id — verify that patient exists
    const { data: correctPatient } = await sb
      .from("patients")
      .select("id,first_name,last_name")
      .eq("id", metaPatientId)
      .maybeSingle();

    if (!correctPatient) {
      console.log(`  SKIP ${log.call_id}: metadata patient_id ${metaPatientId} not found in patients table`);
      noMeta++;
      continue;
    }

    // Update the call_log to the correct patient
    const { error } = await sb
      .from("call_logs")
      .update({ patient_id: metaPatientId })
      .eq("id", log.id);

    if (error) {
      console.error(`  ERROR updating ${log.call_id}:`, error.message);
    } else {
      fixed++;
      console.log(`  FIXED ${log.call_id}: ${log.patient_id ?? "null"} → ${metaPatientId} (${correctPatient.first_name} ${correctPatient.last_name})`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Checked: ${checked}, Fixed: ${fixed}, Already correct: ${alreadyCorrect}, No metadata: ${noMeta}`);
}

main().catch(console.error);
