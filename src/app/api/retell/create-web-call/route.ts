import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";

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
  try {
    const body = await req.json();
    if (body?.lang === "fr") lang = "fr";
  } catch { /* no body is fine */ }

  const agentId = VOICE_AGENTS[lang];

  const res = await fetch("https://api.retellai.com/v2/create-web-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      retell_llm_dynamic_variables: {
        currency: "CHF",
        clinic_phone: "+41 22 732 22 23",
        book_url: "https://aestheticclinic.vercel.app/book-appointment/location",
        language: lang === "fr" ? "French" : "English",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell create-web-call error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
