/**
 * Diagnose the gap after Jul 4 in retell_request_logs vs Retell API
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

async function retellList(pagination_key?: string) {
  const body: Record<string, unknown> = { limit: 100, sort_order: "descending" };
  if (pagination_key) body.pagination_key = pagination_key;
  const res = await fetch("https://api.retellai.com/v2/list-calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${RETELL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Array.isArray(data) ? data : (data.calls ?? []);
}

async function main() {
  // 1. What's the newest real-time log in retell_request_logs (non-backfill)?
  //    Backfill rows all have created_at around 2026-07-03 20:3x
  //    Real-time rows created AFTER the script ran would be after 2026-07-03T21:00:00Z
  const { data: newestRealtime } = await sb
    .from("retell_request_logs")
    .select("created_at,event_type,call_id,patient_id")
    .gt("created_at", "2026-07-03T21:00:00Z")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("=== retell_request_logs rows created AFTER the backfill script ran (real-time) ===");
  if (!newestRealtime?.length) {
    console.log("  NONE — no real-time rows since Jul 4. The webhook is not firing to this endpoint.");
  } else {
    for (const r of newestRealtime) {
      console.log(`  ${r.created_at} | ${r.event_type} | ${r.call_id}`);
    }
  }

  // 2. Fetch recent calls from Retell API (after Jul 4)
  const JUL4_MS = new Date("2026-07-04T00:00:00Z").getTime();
  const calls: any[] = [];
  let paginationKey: string | undefined;

  console.log("\n=== Fetching Retell API calls after Jul 4 ===");
  for (let page = 0; page < 5; page++) {
    const batch = await retellList(paginationKey);
    if (!batch.length) break;
    let stop = false;
    for (const c of batch) {
      const ts = c.start_timestamp || 0;
      if (ts < JUL4_MS) { stop = true; break; }
      calls.push(c);
    }
    if (stop) break;
    paginationKey = batch[batch.length - 1]?.call_id;
    if (!paginationKey) break;
  }

  console.log(`Retell API calls after Jul 4: ${calls.length}`);
  for (const c of calls.slice(0, 20)) {
    const ts = c.start_timestamp ? new Date(c.start_timestamp).toISOString() : "?";
    console.log(`  ${ts} | ${c.call_id} | dir=${c.direction} | status=${c.call_status} | agent=${c.agent_id}`);
  }

  // 3. Check which of those are already in retell_request_logs
  if (calls.length) {
    const ids = calls.map((c) => c.call_id).filter(Boolean);
    const { data: existing } = await sb
      .from("retell_request_logs")
      .select("call_id,event_type,created_at")
      .in("call_id", ids);
    const existingIds = new Set((existing || []).map((r: any) => r.call_id));
    const missing = calls.filter((c) => !existingIds.has(c.call_id));
    console.log(`\nOf those ${calls.length} Retell calls after Jul 4:`);
    console.log(`  ${existingIds.size} already in retell_request_logs`);
    console.log(`  ${missing.length} MISSING from retell_request_logs`);
    if (missing.length) {
      console.log("Missing call_ids:");
      for (const c of missing) {
        const ts = c.start_timestamp ? new Date(c.start_timestamp).toISOString() : "?";
        console.log(`    ${ts} | ${c.call_id} | dir=${c.direction} | to=${c.to_number} | webhook=${c.webhook_url ?? "none"}`);
      }
    }
  }

  // 4. Check the call_logs gap too
  const { data: clNewest } = await sb
    .from("call_logs")
    .select("created_at,started_at,direction,call_status,source,patient_id,to_number")
    .gt("created_at", "2026-07-03T21:00:00Z")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("\n=== call_logs created AFTER the backfill ===");
  if (!clNewest?.length) {
    console.log("  NONE — no new call_logs entries since Jul 4 backfill.");
  } else {
    for (const r of clNewest) {
      console.log(`  ${r.created_at} | ${r.direction} | ${r.call_status} | src=${r.source} | pid=${r.patient_id ?? "null"} | to=${r.to_number}`);
    }
  }
}

main().catch(console.error);
