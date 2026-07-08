/**
 * Backfill retell_request_logs for calls that were made without webhook URLs
 * This creates synthetic webhook entries from the Retell API data
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

async function fetchCallsWithoutWebhooks() {
  console.log("=== Fetching calls without webhook URLs ===");
  
  const response = await fetch("https://api.retellai.com/v2/list-calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      limit: 200,
      sort_order: "descending"
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch calls: ${response.status} ${text}`);
  }
  
  const data = await response.json();
  const calls = data.items || data;
  
  // Filter for calls without webhook URLs
  const withoutWebhook = calls.filter((call: any) => !call.webhook_url || call.webhook_url === "none" || call.webhook_url === undefined);
  
  console.log(`Found ${withoutWebhook.length} calls without webhook URLs`);
  
  return withoutWebhook;
}

async function backfillRequestLogs(calls: any[]) {
  console.log("\n=== Backfilling retell_request_logs ===");
  
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const call of calls) {
    try {
      // Check if already exists
      const { data: existing } = await sb
        .from("retell_request_logs")
        .select("id")
        .eq("call_id", call.call_id)
        .maybeSingle();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Extract patient_id from metadata
      const patientId = call.metadata?.patient_id || null;
      
      // Create synthetic webhook payload
      const webhookPayload = {
        event: "call_ended",
        call: call
      };
      
      // Insert as retell_request_logs entry
      const { error } = await sb
        .from("retell_request_logs")
        .insert({
          call_id: call.call_id,
          event_type: "call_ended",
          function_name: null,
          request_body: webhookPayload,
          args: null,
          metadata: call.metadata || null,
          dynamic_variables: call.retell_llm_dynamic_variables || null,
          call_data: call,
          response_body: null,
          response_status: 200,
          processing_time_ms: null,
          error_message: null,
          patient_id: patientId,
          created_at: new Date(call.end_timestamp || call.start_timestamp).toISOString()
        });
      
      if (error) {
        console.error(`[RL] insert error for ${call.call_id}:`, error.message);
        errors++;
      } else {
        inserted++;
        console.log(`  ✓ retell_request_log ${call.call_id} (synthetic webhook)`);
      }
    } catch (error) {
      console.error(`Error processing ${call.call_id}:`, error instanceof Error ? error.message : String(error));
      errors++;
    }
  }
  
  console.log(`\n=== Backfill Complete ===`);
  console.log(`retell_request_logs: +${inserted} inserted, ${skipped} already existed, ${errors} errors`);
  
  return { inserted, skipped, errors };
}

async function main() {
  console.log("=== Retell Request Logs Backfill ===\n");
  
  try {
    const calls = await fetchCallsWithoutWebhooks();
    const result = await backfillRequestLogs(calls);
    
    console.log("\n=== Summary ===");
    if (result.inserted > 0) {
      console.log(`✓ Backfilled ${result.inserted} missing retell_request_logs`);
    }
    if (result.skipped > 0) {
      console.log(`- ${result.skipped} entries already existed`);
    }
    if (result.errors > 0) {
      console.log(`- ${result.errors} errors encountered`);
    }
  } catch (error) {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error));
  }
}

main().catch(console.error);
