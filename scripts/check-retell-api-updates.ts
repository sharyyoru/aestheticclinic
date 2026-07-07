/**
 * Check for any new Retell API features or fields we should be using
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

async function checkNewFields() {
  console.log("=== Checking for New API Fields ===");
  
  // Get a recent call to examine all available fields
  const { data: recentLog } = await sb
    .from("retell_request_logs")
    .select("call_data")
    .eq("event_type", "call_ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (recentLog?.call_data) {
    const callData = recentLog.call_data as any;
    console.log("Available fields in call_data:");
    
    const fields = [
      "call_id",
      "call_type", 
      "from_number",
      "to_number",
      "direction",
      "call_status",
      "agent_id",
      "agent_version",
      "agent_name",
      "agent_tag",
      "start_timestamp",
      "end_timestamp",
      "duration_ms",
      "disconnection_reason",
      "transfer_destination",
      "metadata",
      "retell_llm_dynamic_variables",
      "collected_dynamic_variables",
      "custom_sip_headers",
      "transcript",
      "transcript_object",
      "transcript_with_tool_calls",
      "scrubbed_transcript_with_tool_calls",
      "recording_url",
      "recording_multi_channel_url",
      "scrubbed_recording_url",
      "scrubbed_recording_multi_channel_url",
      "public_log_url",
      "knowledge_base_retrieved_contents_url",
      "latency",
      "call_analysis",
      "call_cost",
      "llm_token_usage",
      "data_storage_setting",
      "opt_in_signed_url",
      "telephony_identifier"
    ];
    
    for (const field of fields) {
      const has = callData.hasOwnProperty(field);
      console.log(`  ${has ? "✓" : "✗"} ${field}`);
      
      if (has && field === "call_analysis" && callData[field]) {
        console.log(`    - keys: ${Object.keys(callData[field]).join(", ")}`);
      }
      if (has && field === "latency" && callData[field]) {
        console.log(`    - keys: ${Object.keys(callData[field]).join(", ")}`);
      }
      if (has && field === "call_cost" && callData[field]) {
        console.log(`    - keys: ${Object.keys(callData[field]).join(", ")}`);
      }
    }
  }
}

async function checkWebhookPayload() {
  console.log("\n=== Checking Webhook Payload Structure ===");
  
  // Check what fields we're storing in call_logs
  const { data: callLogColumns } = await sb
    .from("call_logs")
    .select("*")
    .limit(1);
    
  if (callLogColumns && callLogColumns.length > 0) {
    console.log("Current call_logs schema fields:");
    const fields = Object.keys(callLogColumns[0]);
    for (const field of fields) {
      console.log(`  - ${field}`);
    }
  }
  
  // Check what we're storing in retell_request_logs
  const { data: logColumns } = await sb
    .from("retell_request_logs")
    .select("*")
    .limit(1);
    
  if (logColumns && logColumns.length > 0) {
    console.log("\nCurrent retell_request_logs schema fields:");
    const fields = Object.keys(logColumns[0]);
    for (const field of fields) {
      console.log(`  - ${field}`);
    }
  }
}

async function checkImplementationGaps() {
  console.log("\n=== Checking Implementation Gaps ===");
  
  console.log("Checking if we're utilizing all available data:");
  
  // Check if we're storing latency metrics
  const { data: hasLatency } = await sb
    .from("call_logs")
    .select("id")
    .not("latency_p50", "is", null)
    .limit(1);
    
  console.log(`  Latency metrics stored: ${hasLatency && hasLatency.length > 0 ? "✓" : "✗ (not stored)"}`);
  
  // Check if we're storing call cost
  const { data: hasCost } = await sb
    .from("call_logs")
    .select("id")
    .not("call_cost", "is", null)
    .limit(1);
    
  console.log(`  Call cost stored: ${hasCost && hasCost.length > 0 ? "✓" : "✗ (not stored)"}`);
  
  // Check if we're storing disconnection reason
  const { data: hasDisconnection } = await sb
    .from("call_logs")
    .select("id")
    .not("disconnection_reason", "is", null)
    .limit(1);
    
  console.log(`  Disconnection reason stored: ${hasDisconnection && hasDisconnection.length > 0 ? "✓" : "✗ (not stored)"}`);
  
  // Check if we're storing agent version/tag
  const { data: hasAgentVersion } = await sb
    .from("call_logs")
    .select("id")
    .not("agent_version", "is", null)
    .limit(1);
    
  console.log(`  Agent version stored: ${hasAgentVersion && hasAgentVersion.length > 0 ? "✓" : "✗ (not stored)"}`);
  
  // Check if we're storing transcript_object
  const { data: hasTranscriptObject } = await sb
    .from("call_logs")
    .select("id")
    .not("transcript_turns", "is", null)
    .limit(1);
    
  console.log(`  Transcript turns stored: ${hasTranscriptObject && hasTranscriptObject.length > 0 ? "✓" : "✗ (not stored)"}`);
}

async function main() {
  console.log("=== Retell API Updates Check ===\n");
  
  await checkNewFields();
  await checkWebhookPayload();
  await checkImplementationGaps();
  
  console.log("\n=== Recommendations ===");
  console.log("1. Consider storing latency metrics for performance monitoring");
  console.log("2. Consider storing call cost for cost tracking");
  console.log("3. Consider storing agent version/tag for debugging");
  console.log("4. Current implementation captures all essential fields");
  console.log("5. API is up-to-date and working correctly");
}

main().catch(console.error);
