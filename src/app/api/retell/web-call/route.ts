import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";

// Voice agents by language for online/web calls (different from phone call agents)
const VOICE_AGENTS = {
  en: "agent_f5cc331b4b4c944efb6cd29d0a",
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

  // First message ensures agent always starts with proper introduction
  const firstMessage = lang === "fr"
    ? "Merci de vous connecter avec moi. Je suis Alice, votre assistante digitale à la Clinique Esthétique. Comment puis-je vous aider aujourd'hui?"
    : "Thank you for connecting with me. I'm Alice, your digital assistant at Aesthetics Clinic. How may I assist you today?";

  const res = await fetch("https://api.retellai.com/v2/create-web-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      // Dynamic variables available to agent during conversation
      retell_llm_dynamic_variables: {
        currency: "CHF",
        clinic_phone: "+41 22 732 22 23",
        book_url: "https://aestheticclinic.vercel.app/book-appointment/location",
        language: lang === "fr" ? "French" : "English",
        first_message: firstMessage,
        call_type: "online_conversation",
      },
      metadata: {
        conversation_type: "online_call",
        language: lang,
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
