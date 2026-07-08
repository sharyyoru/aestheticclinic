/**
 * Check for any missing logs after the recent fixes
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment
const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)/);
  if (m) env[m[1]] = m[2].split(/\s+#/)[0].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const RETELL_API_KEY = env.RETELL_API_KEY;

async function fetchRecentRetellCalls() {
  console.log("=== Fetching recent calls from Retell API ===");
  
  const response = await fetch("https://api.retellai.com/v2/list-calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      limit: 100,
      sort_order: "descending"
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch calls: ${response.status} ${text}`);
  }
  
  const data = await response.json();
  const calls = data.items || data; // Handle both new and legacy format
  
  console.log(`Found ${calls.length} recent calls from Retell API`);
  
  // Filter for calls after July 4 (when we fixed the issue)
  const afterJuly4 = calls.filter((call: any) => {
    const start = new Date(call.start_timestamp);
    return start > new Date("2026-07-04T00:00:00Z");
  });
  
  console.log(`Calls after July 4: ${afterJuly4.length}`);
  
  return afterJuly4;
}

async function checkMissingLogs(calls: any[]) {
  console.log("\n=== Checking for missing logs ===");
  
  const missingInRequestLogs = [];
  const missingInCallLogs = [];
  
  for (const call of calls) {
    // Check retell_request_logs
    const { data: reqLog } = await sb
      .from("retell_request_logs")
      .select("call_id, event_type, created_at")
      .eq("call_id", call.call_id)
      .maybeSingle();
    
    if (!reqLog) {
      missingInRequestLogs.push(call);
    }
    
    // Check call_logs
    const { data: callLog } = await sb
      .from("call_logs")
      .select("call_id, created_at, patient_id")
      .eq("call_id", call.call_id)
      .maybeSingle();
    
    if (!callLog) {
      missingInCallLogs.push(call);
    }
  }
  
  console.log(`\nMissing from retell_request_logs: ${missingInRequestLogs.length}`);
  if (missingInRequestLogs.length > 0) {
    console.log("First 5 missing:");
    for (let i = 0; i < Math.min(5, missingInRequestLogs.length); i++) {
      const call = missingInRequestLogs[i];
      console.log(`  ${call.call_id} | ${new Date(call.start_timestamp).toISOString()} | ${call.to_number}`);
    }
  }
  
  console.log(`\nMissing from call_logs: ${missingInCallLogs.length}`);
  if (missingInCallLogs.length > 0) {
    console.log("First 5 missing:");
    for (let i = 0; i < Math.min(5, missingInCallLogs.length); i++) {
      const call = missingInCallLogs[i];
      console.log(`  ${call.call_id} | ${new Date(call.start_timestamp).toISOString()} | ${call.to_number}`);
    }
  }
  
  return { missingInRequestLogs, missingInCallLogs };
}

async function checkWebhookUrls(calls: any[]) {
  console.log("\n=== Checking webhook URLs in recent calls ===");
  
  const withoutWebhook = calls.filter((call: any) => !call.webhook_url || call.webhook_url === "none");
  
  console.log(`Calls without webhook_url: ${withoutWebhook.length}`);
  if (withoutWebhook.length > 0) {
    console.log("These calls won't send lifecycle events:");
    for (let i = 0; i < Math.min(5, withoutWebhook.length); i++) {
      const call = withoutWebhook[i];
      console.log(`  ${call.call_id} | ${new Date(call.start_timestamp).toISOString()} | webhook_url=${call.webhook_url}`);
    }
  }
  
  const withCorrectWebhook = calls.filter((call: any) => 
    call.webhook_url && call.webhook_url.includes("/api/webhooks/retell-agent")
  );
  console.log(`Calls with correct webhook: ${withCorrectWebhook.length}`);
  
  const withWrongWebhook = calls.filter((call: any) => 
    call.webhook_url && !call.webhook_url.includes("/api/webhooks/retell-agent") && call.webhook_url !== "none"
  );
  console.log(`Calls with wrong webhook: ${withWrongWebhook.length}`);
}

async function main() {
  console.log("=== Checking for Missing Retell Logs ===\n");
  
  try {
    const calls = await fetchRecentRetellCalls();
    await checkWebhookUrls(calls);
    const { missingInRequestLogs, missingInCallLogs } = await checkMissingLogs(calls);
    
    console.log("\n=== Summary ===");
    if (missingInRequestLogs.length === 0 && missingInCallLogs.length === 0) {
      console.log("✓ All recent calls are properly logged");
    } else {
      console.log("⚠ Some calls are missing from logs");
      if (missingInRequestLogs.length > 0) {
        console.log(`  - ${missingInRequestLogs.length} missing from retell_request_logs`);
      }
      if (missingInCallLogs.length > 0) {
        console.log(`  - ${missingInCallLogs.length} missing from call_logs`);
      }
      console.log("\nConsider running backfill script to fill these gaps.");
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
  }
}

main().catch(console.error);
