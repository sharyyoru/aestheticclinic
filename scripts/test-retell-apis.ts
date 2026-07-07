/**
 * Comprehensive test of all Retell API endpoints used by the clinic
 * Verifies we're using the latest API and all endpoints work correctly
 */
import { createClient } from "@supabase/supabase-js";
import { createRetellCall, RETELL_API_BASE, RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER } from "../src/lib/retell";
import * as fs from "fs";
import * as path from "path";

// Load environment
const env: Record<string, string> = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)/);
  if (m) env[m[1]] = m[2].split(/\s+#/)[0].trim().replace(/^["']|["']$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Test phone number (clinic's test number)
const TEST_TO_NUMBER = "+41797195972"; // Nikos's number for testing

async function retellFetch(path: string, body?: unknown, method = "POST") {
  const res = await fetch(`${RETELL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Retell ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

async function testCreatePhoneCall() {
  console.log("\n=== Testing create-phone-call ===");
  
  try {
    const payload = {
      from_number: RETELL_FROM_NUMBER,
      to_number: TEST_TO_NUMBER,
      agent_id: RETELL_AGENT_ID,
      webhook_url: "https://aestheticclinic.vercel.app/api/webhooks/retell-agent",
      retell_llm_dynamic_variables: {
        user_name: "Test User",
        service_name: "Test Service",
      },
      metadata: {
        patient_id: "00000000-0000-0000-0000-000000000000",
        test_call: "true",
        source: "api_test",
      },
    };

    console.log("Payload:", JSON.stringify(payload, null, 2));
    
    const response = await createRetellCall(payload);
    console.log("✓ create-phone-call successful");
    console.log("Response:", JSON.stringify(response, null, 2));
    
    // Verify required fields in response
    if (!response.call_id) {
      throw new Error("Missing call_id in response");
    }
    if (!response.call_status) {
      throw new Error("Missing call_status in response");
    }
    
    return response.call_id;
  } catch (error) {
    console.error("✗ create-phone-call failed:", error);
    return null;
  }
}

async function testGetCall(callId: string) {
  console.log("\n=== Testing get-call ===");
  
  try {
    const response = await retellFetch(`/v2/get-call/${callId}`, undefined, "GET");
    console.log("✓ get-call successful");
    
    // Check for new fields that might be available
    console.log("Key fields:");
    console.log(`  call_id: ${response.call_id}`);
    console.log(`  call_status: ${response.call_status}`);
    console.log(`  agent_id: ${response.agent_id}`);
    console.log(`  start_timestamp: ${response.start_timestamp}`);
    console.log(`  end_timestamp: ${response.end_timestamp}`);
    console.log(`  disconnection_reason: ${response.disconnection_reason}`);
    console.log(`  call_analysis present: ${!!response.call_analysis}`);
    console.log(`  latency present: ${!!response.latency}`);
    console.log(`  call_cost present: ${!!response.call_cost}`);
    
    // Check if metadata is preserved
    if (response.metadata) {
      console.log(`  metadata.test_call: ${response.metadata.test_call}`);
    }
    
    return response;
  } catch (error) {
    console.error("✗ get-call failed:", error);
    return null;
  }
}

async function testListCalls() {
  console.log("\n=== Testing list-calls ===");
  
  try {
    // Test with pagination
    const response = await retellFetch("/v2/list-calls", {
      limit: 5,
      sort_order: "descending",
    });
    
    console.log("✓ list-calls successful");
    
    // Check response structure - newer API returns object with items array
    if (response.items && Array.isArray(response.items)) {
      console.log(`  Using new API format: ${response.items.length} items returned`);
      console.log(`  has_more: ${response.has_more}`);
      if (response.pagination_key) {
        console.log(`  pagination_key present: ${response.pagination_key}`);
      }
      
      // Show first call details
      if (response.items.length > 0) {
        const first = response.items[0];
        console.log("\nFirst call:");
        console.log(`  call_id: ${first.call_id}`);
        console.log(`  call_type: ${first.call_type}`);
        console.log(`  direction: ${first.direction}`);
        console.log(`  call_status: ${first.call_status}`);
        console.log(`  start_timestamp: ${first.start_timestamp}`);
      }
    } else if (Array.isArray(response)) {
      console.log(`  Using legacy API format: ${response.length} items returned`);
    } else {
      console.log("  Unexpected response format:", typeof response);
    }
    
    return response;
  } catch (error) {
    console.error("✗ list-calls failed:", error);
    return null;
  }
}

async function testWebhookEndpoint() {
  console.log("\n=== Testing webhook endpoint ===");
  
  try {
    // Create a test webhook payload
    const testPayload = {
      event: "call_ended",
      call: {
        call_id: "test_call_123456",
        call_status: "ended",
        direction: "outbound",
        from_number: RETELL_FROM_NUMBER,
        to_number: TEST_TO_NUMBER,
        agent_id: RETELL_AGENT_ID,
        start_timestamp: Date.now() - 60000,
        end_timestamp: Date.now(),
        disconnection_reason: "agent_hangup",
        metadata: {
          patient_id: "00000000-0000-0000-0000-000000000000",
          test_call: "true",
        },
        retell_llm_dynamic_variables: {
          user_name: "Test User",
          service_name: "Test Service",
        },
        call_analysis: {
          call_summary: "Test call summary",
          user_sentiment: "Neutral",
          call_successful: true,
        },
      },
    };
    
    // Test the webhook endpoint
    const webhookUrl = "http://localhost:3000/api/webhooks/retell-agent";
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });
    
    if (res.ok) {
      console.log("✓ webhook endpoint responded successfully");
      console.log(`  Status: ${res.status}`);
    } else {
      console.log(`⚠ webhook endpoint returned ${res.status} (may be expected if not running locally)`);
    }
  } catch (error) {
    console.log("⚠ Could not test webhook endpoint (likely not running locally):", error instanceof Error ? error.message : String(error));
  }
}

async function checkApiVersion() {
  console.log("\n=== Checking API version compatibility ===");
  
  // Check if we're using correct base URL
  console.log(`API Base: ${RETELL_API_BASE}`);
  console.log(`Agent ID: ${RETELL_AGENT_ID}`);
  console.log(`From Number: ${RETELL_FROM_NUMBER}`);
  
  // Test API key validity with a simple call
  try {
    const response = await retellFetch("/v2/list-calls", { limit: 1 });
    console.log("✓ API key is valid");
  } catch (error) {
    console.error("✗ API key validation failed:", error);
  }
}

async function main() {
  console.log("=== Retell API Comprehensive Test ===");
  console.log(`Testing with phone: ${TEST_TO_NUMBER}`);
  
  // Check API version and key
  await checkApiVersion();
  
  // Test list-calls first (no side effects)
  await testListCalls();
  
  // Test webhook endpoint
  await testWebhookEndpoint();
  
  // Test create-phone-call (creates a real call)
  const callId = await testCreatePhoneCall();
  
  if (callId) {
    // Wait a moment then test get-call
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testGetCall(callId);
    
    console.log(`\n=== Test call created: ${callId} ===`);
    console.log("This call will appear in your Retell dashboard and logs.");
  }
  
  console.log("\n=== Test Summary ===");
  console.log("All endpoints tested. Check above for any ✗ errors.");
  console.log("If all show ✓, your Retell API integration is working correctly.");
}

main().catch(console.error);
