import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/retell";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Retell API configuration
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

// Clinic outbound AI call agents by language. The workflow can request a
// language via `agent_language`; if none is provided the English agent is used.
const OUTBOUND_AGENTS = {
  english: "agent_eae6c598f3b68c71c9e1ae6aad",
  french: "agent_b347fa0d08519c114af295671d",
} as const;

// Webhook URL for Retell call lifecycle events (call_started/ended/analyzed).
// MUST be the /api/webhooks/retell-agent endpoint — that is the only endpoint
// that records the call into the `call_logs` table shown on the patient CRM
// "Call Logs" tab. Pointing this at /api/retell/webhook (the in-call function
// handler) means the call is NEVER recorded, which is why workflow-triggered
// outbound calls previously showed no call logs. In-call functions are wired
// separately via the agent's tool URLs and are unaffected by this.
const RETELL_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/retell-agent`
  : "https://aestheticclinic.vercel.app/api/webhooks/retell-agent";

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

    if (!RETELL_FROM_NUMBER) {
      console.error("[Retell Workflow] RETELL_FROM_NUMBER not configured");
      return NextResponse.json(
        { error: "RETELL_FROM_NUMBER not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      patient_id,
      phone_number,
      agent_language,
      dynamic_variables,
      metadata,
    } = body;

    // Resolve outbound agent by requested language. A specific `agent_id` in
    // metadata is intentionally ignored so only the clinic's EN/FR agents run.
    const lang =
      typeof agent_language === "string"
        ? agent_language.toLowerCase()
        : "english";
    const resolvedAgentId =
      OUTBOUND_AGENTS[lang as keyof typeof OUTBOUND_AGENTS] ||
      OUTBOUND_AGENTS.english;

    // Validate required fields
    if (!phone_number) {
      return NextResponse.json(
        { error: "phone_number is required" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone_number);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      return NextResponse.json(
        { error: "Invalid phone_number" },
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
      const { data, error: patientError } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, phone")
        .eq("id", patient_id)
        .maybeSingle();
      if (patientError) {
        console.error("[trigger-retell-call] Patient lookup error:", patientError);
        return NextResponse.json(
          { error: "Failed to look up patient", details: patientError.message },
          { status: 500 }
        );
      }
      patient = data;
    }

    // Build dynamic variables (Retell requires string values only)
    const vars: Record<string, string> = {};
    if (dynamic_variables && typeof dynamic_variables === "object") {
      for (const [key, value] of Object.entries(dynamic_variables)) {
        if (value !== undefined && value !== null) {
          vars[key] = String(value);
        }
      }
    }

    if (patient) {
      vars.customer_name = `${patient.first_name || ""} ${patient.last_name || ""}`.trim();
      if (patient.first_name) vars.first_name = patient.first_name;
      if (patient.last_name) vars.last_name = patient.last_name;
      if (patient.email) vars.email = patient.email;
      vars.phone = patient.phone ? patient.phone : normalizedPhone;
      if (patient.id) vars.patient_id = patient.id;
    }

    // Add metadata for tracking AND for booking/SMS functions to use
    // CRITICAL: These fields are used by the webhook for booking appointments
    const callMetadata: Record<string, string> = {
      source: "workflow",
      agent_language: lang,
      patient_id: patient?.id || "",
      patient_first_name: patient?.first_name || "",
      patient_last_name: patient?.last_name || "",
      patient_name: patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() : "",
      patient_email: patient?.email || "",
      patient_phone: patient?.phone || normalizedPhone,
      triggered_at: new Date().toISOString(),
    };
    if (metadata && typeof metadata === "object") {
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined && value !== null) {
          callMetadata[key] = String(value);
        }
      }
    }

    // Retell v2 create-phone-call expects override_agent_id and places the
    // webhook configuration inside agent_override.agent. Passing agent_id or
    // webhook_url at the top level is silently ignored by the current API.
    const callPayload = {
      from_number: RETELL_FROM_NUMBER,
      to_number: normalizedPhone,
      override_agent_id: resolvedAgentId,
      override_agent_version: "latest_published",
      agent_override: {
        agent: {
          // CRITICAL: webhook_url tells Retell where to send call lifecycle events
          webhook_url: RETELL_WEBHOOK_URL,
          webhook_events: ["call_started", "call_ended", "call_analyzed"],
          webhook_timeout_ms: 10000,
        },
      },
      retell_llm_dynamic_variables: vars,
      metadata: callMetadata,
    };

    // Make the call to Retell API
    console.log("[Retell] create-phone-call payload:", JSON.stringify(callPayload, null, 2));
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
    console.log("[Retell] create-phone-call response:", JSON.stringify(callData, null, 2));

    // Log the call initiation
    console.log("[Retell Workflow] Call initiated:", {
      call_id: callData.call_id,
      patient_id: patient?.id,
      to_number: normalizedPhone,
      raw_number: phone_number,
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
    default_agent_id: OUTBOUND_AGENTS.english,
    from_number: RETELL_FROM_NUMBER || null,
    available_agents: {
      english: OUTBOUND_AGENTS.english,
      french: OUTBOUND_AGENTS.french,
    },
    endpoints: {
      initiate_call: "/api/workflows/trigger-retell-call (POST)",
    },
    usage: {
      method: "POST",
      body: {
        patient_id: "string (optional) - Patient ID from database",
        phone_number: "string (required) - Phone number to call",
        agent_language: "string (optional) - 'english' | 'french' (defaults to english)",
        dynamic_variables: "object (optional) - Variables for AI conversation",
        metadata: "object (optional) - Additional metadata for tracking",
        note: "A specific agent_id in metadata is ignored; only the configured EN/FR outbound agents are used.",
      },
    },
  });
}
