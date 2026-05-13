import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
const VOICE_AGENT_ID = "agent_49322ed02ae4ea55665d81536c";
const RETELL_BASE = "https://api.retellai.com";

// Cache the chat agent ID in module scope (persists across requests in same serverless instance)
let cachedChatAgentId: string | null = process.env.RETELL_CHAT_AGENT_ID ?? null;

async function getOrCreateChatAgent(): Promise<string> {
  if (cachedChatAgentId) return cachedChatAgentId;

  // 1. Fetch the voice agent to get its LLM ID
  const agentRes = await fetch(`${RETELL_BASE}/v2/get-agent/${VOICE_AGENT_ID}`, {
    headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
  });
  if (!agentRes.ok) {
    const t = await agentRes.text().catch(() => "");
    throw new Error(`Failed to fetch voice agent: ${agentRes.status} ${t}`);
  }
  const agent = await agentRes.json();
  const llmId: string = agent?.response_engine?.llm_id ?? agent?.llm_websocket_url ?? null;
  if (!llmId) throw new Error("Could not extract llm_id from voice agent");

  // 2. Create a chat agent using the same LLM
  const createRes = await fetch(`${RETELL_BASE}/v2/create-chat-agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      response_engine: { type: "retell-llm", llm_id: llmId },
      agent_name: "Aliice-Chat",
      language: "en-US",
    }),
  });
  if (!createRes.ok) {
    const t = await createRes.text().catch(() => "");
    throw new Error(`Failed to create chat agent: ${createRes.status} ${t}`);
  }
  const chatAgent = await createRes.json();
  cachedChatAgentId = chatAgent.agent_id as string;
  console.log("Created Retell chat agent:", cachedChatAgentId);
  return cachedChatAgentId!;
}

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

  let chatAgentId: string;
  try {
    chatAgentId = await getOrCreateChatAgent();
  } catch (e: unknown) {
    console.error("getOrCreateChatAgent failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const res = await fetch(`${RETELL_BASE}/v2/create-chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: chatAgentId,
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
