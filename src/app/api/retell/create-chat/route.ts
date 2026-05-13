import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
const CHAT_AGENT_ID = process.env.RETELL_AGENT_ID ?? "agent_49322ed02ae4ea55665d81536c";

export async function POST(req: NextRequest) {
  if (!RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
  }

  let lang = "en";
  try {
    const body = await req.json();
    if (body?.lang === "fr") lang = "fr";
  } catch { /* no body is fine */ }

  const langInstruction = lang === "fr"
    ? "IMPORTANT: Réponds UNIQUEMENT en français pour toute cette conversation. Ne passe jamais à l'anglais."
    : "IMPORTANT: Respond ONLY in English for this entire conversation.";

  const res = await fetch("https://api.retellai.com/v2/create-chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: CHAT_AGENT_ID,
      retell_llm_dynamic_variables: {
        currency: "CHF",
        clinic_phone: "+41 22 732 22 23",
        book_url: "https://aestheticclinic.vercel.app/book-appointment/location",
        language: lang,
        language_instruction: langInstruction,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell create-chat error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
