import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER ?? "+41225394313";

// Voice agents by language
const VOICE_AGENTS = {
  en: "agent_c753d21834b3e1f19f8536b3dc",
  fr: "agent_cede618e4c574cb4e481461be7",
};

export async function POST(req: NextRequest) {
  if (!RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
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

  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_number: RETELL_FROM_NUMBER,
      to_number: normalizedNumber,
      agent_id: agentId,
      retell_llm_dynamic_variables: {
        currency: "CHF",
        clinic_phone: "+41 22 732 22 23",
        book_url: "https://aestheticclinic.vercel.app/book-appointment/location",
        language: lang === "fr" ? "French" : "English",
        customer_phone: normalizedNumber,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell create-phone-call error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
