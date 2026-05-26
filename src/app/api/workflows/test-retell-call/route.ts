import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

const RETELL_AGENTS = {
  english: "agent_f5cc331b4b4c944efb6cd29d0a",
  french: "agent_16738cdb79c26e811fc1cffcc6",
} as const;

/**
 * POST /api/workflows/test-retell-call
 * 
 * Test endpoint to verify Retell API integration
 * Body: { phone_number: string, agent_language?: "english" | "french" }
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
    const { phone_number, agent_language = "english" } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 }
      );
    }

    const agentId = RETELL_AGENTS[agent_language as keyof typeof RETELL_AGENTS] || RETELL_AGENTS.english;

    const callPayload = {
      from_number: RETELL_FROM_NUMBER || "+41799029555",
      to_number: phone_number,
      agent_id: agentId,
      retell_llm_dynamic_variables: {
        user_name: "Test User",
        service_name: "Test Service",
        call_purpose: "Test call from workflow system",
      },
      metadata: {
        source: "test",
        triggered_at: new Date().toISOString(),
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
 * Returns test configuration
 */
export async function GET() {
  return NextResponse.json({
    configured: !!RETELL_API_KEY,
    from_number: RETELL_FROM_NUMBER || "+41799029555",
    agents: RETELL_AGENTS,
    usage: {
      method: "POST",
      body: {
        phone_number: "string (required) - Phone number to call in E.164 format",
        agent_language: "string (optional) - 'english' or 'french', default: 'english'",
      },
      example: {
        phone_number: "+41791234567",
        agent_language: "english",
      },
    },
  });
}
