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
  const { count: total }  = await sb.from("call_logs").select("*", { count: "exact", head: true }).eq("source", "retell_backfill");
  const { count: withPt } = await sb.from("call_logs").select("*", { count: "exact", head: true }).not("patient_id", "is", null).eq("source", "retell_backfill");
  const { count: noPt }   = await sb.from("call_logs").select("*", { count: "exact", head: true }).is("patient_id", null).eq("source", "retell_backfill");
  const { count: noNum }  = await sb.from("call_logs").select("*", { count: "exact", head: true }).is("to_number", null).eq("source", "retell_backfill");
  console.log(`Backfilled call_logs total: ${total}`);
  console.log(`  with patient:  ${withPt}`);
  console.log(`  no patient:    ${noPt}`);
  console.log(`  no to_number:  ${noNum}`);

  const { data: dirs } = await sb.from("call_logs").select("direction,call_status").eq("source", "retell_backfill");
  const tally: Record<string, number> = {};
  for (const r of dirs || []) { const k = `${r.direction}/${r.call_status}`; tally[k] = (tally[k] || 0) + 1; }
  console.log("\nDirection/Status breakdown:", JSON.stringify(tally, null, 2));

  const { data: nullSamples } = await sb.from("call_logs").select("call_id,from_number,to_number,started_at").is("to_number", null).eq("source", "retell_backfill").limit(5);
  console.log("\nSample rows with null to_number:", JSON.stringify(nullSamples, null, 2));

  const { count: rlTotal } = await sb.from("retell_request_logs").select("*", { count: "exact", head: true });
  const { count: rlAfterJun21 } = await sb.from("retell_request_logs").select("*", { count: "exact", head: true }).gte("created_at", "2026-06-21T00:00:00Z");
  console.log(`\nretell_request_logs total: ${rlTotal}  (after Jun 21: ${rlAfterJun21})`);

  const { data: rlNewest } = await sb.from("retell_request_logs").select("created_at,event_type,call_id,patient_id").order("created_at", { ascending: false }).limit(5);
  console.log("Newest retell_request_logs:");
  for (const r of rlNewest || []) console.log(`  ${r.created_at} | ${r.event_type} | ${r.call_id} | pid=${r.patient_id ?? "null"}`);
}

main().catch(console.error);
