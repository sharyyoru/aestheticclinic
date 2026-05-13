import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";

export async function POST(req: NextRequest) {
  if (!RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json() as { chat_id: string; content: string };

  if (!body.chat_id || !body.content) {
    return NextResponse.json({ error: "chat_id and content are required" }, { status: 400 });
  }

  const res = await fetch("https://api.retellai.com/v2/create-chat-completion", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: body.chat_id,
      content: body.content,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell chat-completion error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
