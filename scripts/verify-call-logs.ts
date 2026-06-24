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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: total } = await supabase.from("call_logs").select("*", { count: "exact", head: true });
  const { count: withTurns } = await supabase.from("call_logs").select("*", { count: "exact", head: true }).not("transcript_turns", "is", null);
  const { count: withAssignee } = await supabase.from("call_logs").select("*", { count: "exact", head: true }).not("assigned_user_name", "is", null);
  console.log(`call_logs total=${total} withTranscriptTurns=${withTurns} withAssignee=${withAssignee}`);

  // Patient with the most call logs (good for testing the tab).
  const { data } = await supabase.from("call_logs").select("patient_id").not("patient_id", "is", null).limit(2000);
  const counts: Record<string, number> = {};
  for (const r of data || []) counts[r.patient_id as string] = (counts[r.patient_id as string] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("\nTop patients by call count (open /patients/<id>?m_tab=crm&crm_sub=call_logs):");
  for (const [pid, n] of top) console.log(`  ${pid}  (${n} calls)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
