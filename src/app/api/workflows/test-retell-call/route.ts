import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

// Clinic outbound AI call agents by language.
const OUTBOUND_AGENTS = {
  english: "agent_eae6c598f3b68c71c9e1ae6aad",
  french: "agent_b347fa0d08519c114af295671d",
} as const;

// Webhook URL for Retell call lifecycle events (call_started/ended/analyzed).
// MUST be /api/webhooks/retell-agent so the call is recorded into `call_logs`
// (the patient CRM "Call Logs" tab). In-call functions use the agent's own
// tool URLs and are unaffected.
const RETELL_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/retell-agent`
  : "https://aestheticclinic.vercel.app/api/webhooks/retell-agent";

/**
 * POST /api/workflows/test-retell-call
 * 
 * Test endpoint to verify Retell API integration
 * Body: { 
 *   phone_number: string, 
 *   agent_language?: "english" | "french",
 *   user_name?: string,
 *   service_name?: string,
 *   call_purpose?: string,
 *   patient_id?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!RETELL_API_KEY) {
      return NextResponse.json(
        { error: "RETELL_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { 
      phone_number, 
      agent_language = "english",
      user_name,
      service_name,
      call_purpose,
      patient_id,
    } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 }
      );
    }

    // Normalize phone number to E.164 format
    let normalizedPhone = phone_number.replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "+41" + normalizedPhone.slice(1);
      } else {
        normalizedPhone = "+" + normalizedPhone;
      }
    }

    const agentId = OUTBOUND_AGENTS[agent_language as keyof typeof OUTBOUND_AGENTS] || OUTBOUND_AGENTS.english;

    // Build dynamic variables - use provided values or leave empty for AI to ask
    // Per Retell best practices: if empty, AI will ask for the info during the call
    const dynamicVariables: Record<string, string> = {};
    
    // CRITICAL: Always include patient_id if provided for booking association
    if (patient_id) {
      dynamicVariables.patient_id = patient_id;
    }
    
    // Only set user_name if provided and not empty
    if (user_name && user_name.trim()) {
      dynamicVariables.user_name = user_name.trim();
      dynamicVariables.first_name = user_name.trim().split(' ')[0]; // Also set first_name
    }
    // If not provided, AI will ask "May I know who I'm speaking with?"
    
    // Only set service_name if provided and not empty
    if (service_name && service_name.trim()) {
      dynamicVariables.service_name = service_name.trim();
    }
    // If not provided, AI will ask "Which treatment or service were you interested in?"
    
    // Include phone for webhook reference
    dynamicVariables.phone = normalizedPhone;
    
    // Always include call_purpose for context
    dynamicVariables.call_purpose = call_purpose || "follow-up on inquiry";

    const callPayload = {
      from_number: RETELL_FROM_NUMBER || "+41799029555",
      to_number: normalizedPhone,
      override_agent_id: agentId,
      override_agent_version: "latest_published",
      agent_override: {
        agent: {
          webhook_url: RETELL_WEBHOOK_URL,
          webhook_events: ["call_started", "call_ended", "call_analyzed"],
          webhook_timeout_ms: 10000,
        },
      },
      retell_llm_dynamic_variables: dynamicVariables,
      metadata: {
        source: "test",
        patient_id: patient_id || "",
        patient_phone: normalizedPhone,
        patient_name: user_name || "",
        agent_language,
        triggered_at: new Date().toISOString(),
        user_name_provided: String(!!user_name),
        service_name_provided: String(!!service_name),
      },
    };

    console.log("[Test Retell] Initiating test call:", JSON.stringify(callPayload));

    const retellResponse = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callPayload),
    });

    const responseText = await retellResponse.text();
    console.log("[Test Retell] Response status:", retellResponse.status);
    console.log("[Test Retell] Response body:", responseText);

    if (!retellResponse.ok) {
      return NextResponse.json({
        success: false,
        error: `Retell API error: ${retellResponse.status}`,
        details: responseText,
      }, { status: 400 });
    }

    const callData = JSON.parse(responseText);
    return NextResponse.json({
      success: true,
      call_id: callData.call_id,
      agent_id: agentId,
      agent_language,
      to_number: phone_number,
      message: "Test call initiated successfully",
    });

  } catch (error) {
    console.error("[Test Retell] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * GET /api/workflows/test-retell-call
 * 
 * Returns test configuration and agent version info
 */
export async function GET() {
  // Fetch agent info to get current version
  let agentInfo = null;
  if (RETELL_API_KEY) {
    try {
      const agentResponse = await fetch(`https://api.retellai.com/get-agent/${OUTBOUND_AGENTS.english}`, {
        headers: {
          "Authorization": `Bearer ${RETELL_API_KEY}`,
        },
      });
      if (agentResponse.ok) {
        const data = await agentResponse.json();
        agentInfo = {
          agent_id: data.agent_id,
          agent_name: data.agent_name,
          version: data.version,
          last_modification_timestamp: data.last_modification_timestamp,
        };
      }
    } catch (e) {
      console.error("[Test Retell] Failed to fetch agent info:", e);
    }
  }

  return NextResponse.json({
    configured: !!RETELL_API_KEY,
    from_number: RETELL_FROM_NUMBER || "+41799029555",
    webhook_url: RETELL_WEBHOOK_URL,
    agents: OUTBOUND_AGENTS,
    agent_info: agentInfo,
    usage: {
      method: "POST",
      body: {
        phone_number: "string (required) - Phone number to call in E.164 format",
        agent_language: "string (optional) - 'english' or 'french', default: 'english'",
        user_name: "string (optional) - Patient name. If empty, AI will ask during call",
        service_name: "string (optional) - Service of interest. If empty, AI will ask during call",
        call_purpose: "string (optional) - Context for the call, default: 'follow-up on inquiry'",
      },
      example: {
        phone_number: "+41791234567",
        agent_language: "english",
        user_name: "John Smith",
        service_name: "Botox",
      },
      notes: [
        "If user_name is empty, AI will say: 'May I know who I'm speaking with?'",
        "If service_name is empty, AI will say: 'Which treatment or service were you interested in?'",
        "The webhook_url is called when AI triggers functions like send_sms",
      ],
    },
  });
}
