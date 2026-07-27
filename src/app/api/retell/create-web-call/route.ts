import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER ?? "";

// Voice agents by language
const VOICE_AGENTS = {
  en: "agent_c753d21834b3e1f19f8536b3dc",
  fr: "agent_cede618e4c574cb4e481461be7",
};

// Webhook URL for Retell call lifecycle events (call_started/ended/analyzed).
// MUST be /api/webhooks/retell-agent — that is the only endpoint that records
// the call into `call_logs`.
const RETELL_WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/retell-agent`
  : "https://aestheticclinic.vercel.app/api/webhooks/retell-agent";

export async function POST(req: NextRequest) {
  if (!RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
  }

  if (!RETELL_FROM_NUMBER) {
    console.error("[Retell create-web-call] RETELL_FROM_NUMBER not configured");
    return NextResponse.json({ error: "RETELL_FROM_NUMBER not configured" }, { status: 500 });
  }

  let lang: "en" | "fr" = "en";
  let toNumber = "";

  try {
    const body = await req.json();
    if (body?.lang === "fr") lang = "fr";
    toNumber = body?.phone_number ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!toNumber || toNumber.length < 8) {
    return NextResponse.json({ error: "Valid phone number required" }, { status: 400 });
  }

  // Normalize phone number: ensure it starts with +
  const normalizedNumber = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;

  const agentId = VOICE_AGENTS[lang];

  const payload = {
    from_number: RETELL_FROM_NUMBER,
    to_number: normalizedNumber,
    override_agent_id: agentId,
    override_agent_version: "latest_published",
    agent_override: {
      agent: {
        webhook_url: RETELL_WEBHOOK_URL,
        webhook_events: ["call_started", "call_ended", "call_analyzed"],
        webhook_timeout_ms: 10000,
      },
    },
    retell_llm_dynamic_variables: {
      currency: "CHF",
      clinic_phone: "+41 22 732 22 23",
      book_url: "https://aestheticclinic.vercel.app/book-appointment/location",
      language: lang === "fr" ? "French" : "English",
      customer_phone: normalizedNumber,
    },
  };

  console.log("[Retell] create-phone-call payload:", JSON.stringify(payload, null, 2));

  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell create-phone-call error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  console.log("[Retell] create-phone-call response:", JSON.stringify(data, null, 2));
  return NextResponse.json(data);
}
