/**
 * Audit how inbound Retell calls are logged and which agent IDs arrive.
 * Run: npx tsx scripts/retell-inbound-audit.ts
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

const TARGET_AGENT = "agent_30cd44b6ef5a0bcb96ead51c96";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function extractAgentId(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/"agent_id":\s*"([^"]+)"/);
  return m?.[1] ?? null;
}
function extractDirection(notes: string | null): string {
  if (!notes) return "unknown";
  const m = notes.match(/"direction":\s*"([^"]+)"/) || notes.match(/Direction:\s*(\w+)/);
  return m?.[1] ?? "unknown";
}

async function main() {
  console.log("=== Retell inbound logging audit ===");
  console.log(`Target agent: ${TARGET_AGENT}\n`);

  // 1. The retell-calls PAGE reads patients where source = 'Retell AI Agent'.
  const { data: patients, error: pErr } = await supabase
    .from("patients")
    .select("id, source, notes, created_at")
    .eq("source", "Retell AI Agent")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (pErr) { console.error("patients error:", pErr.message); }

  const rows = patients || [];
  console.log(`[A] patients with source='Retell AI Agent' (what the page shows): ${rows.length}`);
  const byAgent: Record<string, number> = {};
  const byDir: Record<string, number> = {};
  let targetCount = 0;
  for (const r of rows) {
    const a = extractAgentId(r.notes) || "(none)";
    byAgent[a] = (byAgent[a] || 0) + 1;
    const d = extractDirection(r.notes);
    byDir[d] = (byDir[d] || 0) + 1;
    if (a === TARGET_AGENT) targetCount++;
  }
  console.log("    by agent_id (from notes):");
  for (const [a, n] of Object.entries(byAgent).sort((x, y) => y[1] - x[1])) {
    console.log(`      ${a.padEnd(40)} ${n}${a === TARGET_AGENT ? "  <== TARGET" : ""}`);
  }
  console.log("    by direction:");
  for (const [d, n] of Object.entries(byDir).sort((x, y) => y[1] - x[1])) {
    console.log(`      ${d.padEnd(12)} ${n}`);
  }
  console.log(`    target agent leads on page: ${targetCount}\n`);

  // 2. retell_call_logs (the /api/webhooks/retell endpoint) - check agent in raw_payload.
  const { data: callLogs, error: clErr } = await supabase
    .from("retell_call_logs")
    .select("retell_call_id, event_type, call_status, raw_payload, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (clErr) console.log(`[B] retell_call_logs: ERROR ${clErr.message}`);
  else {
    const cl = callLogs || [];
    const agents: Record<string, number> = {};
    let tgt = 0;
    for (const r of cl) {
      const a = ((r.raw_payload as any)?.call?.agent_id as string) || "(none)";
      agents[a] = (agents[a] || 0) + 1;
      if (a === TARGET_AGENT) tgt++;
    }
    console.log(`[B] retell_call_logs rows: ${cl.length}; target agent: ${tgt}`);
    for (const [a, n] of Object.entries(agents).sort((x, y) => y[1] - x[1])) {
      console.log(`      ${a.padEnd(40)} ${n}${a === TARGET_AGENT ? "  <== TARGET" : ""}`);
    }
    console.log();
  }

  // 3. retell_request_logs (the /api/retell/webhook endpoint) - check agent in call_data.
  const { data: reqLogs, error: rlErr } = await supabase
    .from("retell_request_logs")
    .select("call_id, event_type, call_data, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (rlErr) console.log(`[C] retell_request_logs: ERROR ${rlErr.message}`);
  else {
    const rl = reqLogs || [];
    const agents: Record<string, number> = {};
    let tgt = 0;
    for (const r of rl) {
      const a = ((r.call_data as any)?.agent_id as string) || "(none)";
      agents[a] = (agents[a] || 0) + 1;
      if (a === TARGET_AGENT) tgt++;
    }
    console.log(`[C] retell_request_logs rows: ${rl.length}; target agent: ${tgt}`);
    for (const [a, n] of Object.entries(agents).sort((x, y) => y[1] - x[1])) {
      console.log(`      ${a.padEnd(40)} ${n}${a === TARGET_AGENT ? "  <== TARGET" : ""}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
