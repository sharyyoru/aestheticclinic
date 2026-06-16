import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Retell API configuration
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

// Main agent for outbound calls: the language-switcher ("Outbound Flow")
// agent that routes the patient to the English or French branch itself.
// This is ALWAYS used for outbound calls — no env override, no per-call
// override — so we can never accidentally fall back to an old agent.
const MAIN_AGENT_ID = "agent_023fdedfe7faf0fae56e51b65c";
const RETELL_AGENTS = {
  english: MAIN_AGENT_ID,
  french: MAIN_AGENT_ID,
} as const;

// Webhook URL for Retell to call when AI triggers functions (send_sms, etc.)
// CRITICAL: Without this, the AI cannot send SMS or perform other actions
const RETELL_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/retell/webhook`
  : "https://aestheticclinic.vercel.app/api/retell/webhook";

export const runtime = "nodejs";

/**
 * POST /api/workflows/trigger-retell-call
 * 
 * Triggers a Retell AI outbound call to a patient.
 * This can be called from workflows or other system components.
 */
export async function POST(request: NextRequest) {
  try {
    if (!RETELL_API_KEY) {
      return NextResponse.json(
        { error: "Retell API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      patient_id,
      phone_number,
      dynamic_variables,
      metadata,
    } = body;

    // Always use the main language-switcher agent for outbound calls.
    // Any agent_id passed in the request body is intentionally ignored so the
    // new agent is always forced.
    const resolvedAgentId = MAIN_AGENT_ID;

    // Validate required fields
    if (!phone_number) {
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient details if patient_id is provided
    let patient: {
      id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    } | null = null;

    if (patient_id) {
      const { data } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, phone")
        .eq("id", patient_id)
        .single();
      patient = data;
    }

    // Prepare the outbound call payload
    const callPayload: {
      from_number: string;
      to_number: string;
      agent_id: string;
      webhook_url: string;
      retell_llm_dynamic_variables?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    } = {
      from_number: RETELL_FROM_NUMBER || "+41799029555", // Default Switzerland number
      to_number: phone_number,
      agent_id: resolvedAgentId,
      // CRITICAL: webhook_url tells Retell where to send function calls (send_sms, etc.)
      webhook_url: RETELL_WEBHOOK_URL,
    };

    // Add dynamic variables for the AI conversation
    const vars: Record<string, unknown> = {
      ...dynamic_variables,
    };

    if (patient) {
      vars.customer_name = `${patient.first_name || ""} ${patient.last_name || ""}`.trim();
      vars.first_name = patient.first_name || "";
      vars.last_name = patient.last_name || "";
      vars.email = patient.email || "";
      vars.phone = patient.phone || phone_number;
      vars.patient_id = patient.id;
    }

    if (Object.keys(vars).length > 0) {
      callPayload.retell_llm_dynamic_variables = vars;
    }

    // Add metadata for tracking AND for booking/SMS functions to use
    // CRITICAL: These fields are used by the webhook for booking appointments
    callPayload.metadata = {
      ...metadata,
      source: "workflow",
      patient_id: patient?.id || null,
      patient_first_name: patient?.first_name || null,
      patient_last_name: patient?.last_name || null,
      patient_name: patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() : null,
      patient_email: patient?.email || null, // CRITICAL: Used for booking confirmation emails
      patient_phone: patient?.phone || phone_number, // CRITICAL: Used for booking
      triggered_at: new Date().toISOString(),
    };

    // Make the call to Retell API
    const retellResponse = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callPayload),
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error("[Retell Workflow] API error:", retellResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to initiate Retell call", details: errorText },
        { status: 500 }
      );
    }

    const callData = await retellResponse.json();

    // Log the call initiation
    console.log("[Retell Workflow] Call initiated:", {
      call_id: callData.call_id,
      patient_id: patient?.id,
      to_number: phone_number,
    });

    return NextResponse.json({
      success: true,
      call: {
        call_id: callData.call_id,
        agent_id: callData.agent_id,
        to_number: callData.to_number,
        from_number: callData.from_number,
        status: callData.status,
        start_timestamp: callData.start_timestamp,
      },
      message: "Retell AI call initiated successfully",
    });

  } catch (error) {
    console.error("[Retell Workflow] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger Retell call", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/trigger-retell-call
 * 
 * Returns configuration info for the Retell integration
 */
export async function GET() {
  return NextResponse.json({
    configured: !!RETELL_API_KEY,
    default_agent_id: MAIN_AGENT_ID,
    from_number: RETELL_FROM_NUMBER || null,
    available_agents: {
      english: RETELL_AGENTS.english,
      french: RETELL_AGENTS.french,
    },
    endpoints: {
      initiate_call: "/api/workflows/trigger-retell-call (POST)",
    },
    usage: {
      method: "POST",
      body: {
        patient_id: "string (optional) - Patient ID from database",
        phone_number: "string (required) - Phone number to call",
        dynamic_variables: "object (optional) - Variables for AI conversation",
        metadata: "object (optional) - Additional metadata for tracking",
        note: "The outbound agent is always the main language-switcher agent; agent_id/agent_language are ignored.",
      },
    },
  });
}
