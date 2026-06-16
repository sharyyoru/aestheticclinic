import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// CORS preflight handler for public embed access
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Chat agents by language (separate agents with language-specific prompts)
const CHAT_AGENTS = {
  en: "agent_49322ed02ae4ea55665d81536c",
  fr: "agent_a51872ec8ad4ab730a41c8ad38",
};

export async function POST(req: NextRequest) {
  if (!RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
  }

  let lang: "en" | "fr" = "en";
  let sourceUrl = "";
  let sourceReferrer = "";
  let serviceContext = "";
  try {
    const body = await req.json();
    if (body?.lang === "fr") lang = "fr";
    sourceUrl = body?.source_url || "";
    sourceReferrer = body?.source_referrer || "";
    // Optional context about the specific service/page the visitor is asking about.
    serviceContext = (body?.service_context || "").toString().slice(0, 500);
  } catch { /* no body is fine */ }

  const agentId = CHAT_AGENTS[lang];

  const res = await fetch("https://api.retellai.com/create-chat", {
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
        // Background context injected for the agent (used, not read aloud).
        service_context: serviceContext || "General enquiry",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell create-chat error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}: ${text}` }, { status: 502 });
  }

  const data = await res.json();

  // Log the conversation to our database
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userAgent = req.headers.get("user-agent") || "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "";

    const { data: convData, error } = await supabase
      .from("chat_conversations")
      .insert({
        retell_chat_id: data.chat_id,
        conversation_type: "chat",
        language: lang,
        status: "active",
        source_url: sourceUrl,
        source_referrer: sourceReferrer,
        user_agent: userAgent,
        ip_address: ip,
        messages: Array.isArray(data.message_with_tool_calls) 
          ? data.message_with_tool_calls.map((m: { role: string; content: string; created_timestamp: number }) => ({
              role: m.role,
              content: m.content,
              timestamp: m.created_timestamp,
            }))
          : [],
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to log chat conversation:", error);
    } else {
      // Include our conversation ID in the response
      data.conversation_id = convData?.id;
    }
  } catch (e) {
    console.error("Error logging chat:", e);
  }

  return NextResponse.json(data);
}
