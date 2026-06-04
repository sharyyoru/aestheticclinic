import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// GET /api/whatsapp/conversations/[id]/messages
// Returns messages for a conversation, oldest-first, limited to 100.
// [id] is the whatsapp_conversations.id (UUID).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  // Verify conversation exists
  const { data: conv, error: convError } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("id, patient_id, phone_number, window_expires_at")
    .eq("id", id)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Fetch messages — match by patient_id or phone number
  const { data: messages, error: msgError } = await supabaseAdmin
    .from("whatsapp_messages")
    .select(
      "id, body, direction, status, sent_at, created_at, media_url, template_id, message_sid, delivered_at, read_at, error_message, is_demo, scheduled_at",
    )
    .eq("patient_id", conv.patient_id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  const now = new Date();
  const windowExpiresAt = conv.window_expires_at ? new Date(conv.window_expires_at) : null;
  const windowOpen = windowExpiresAt ? windowExpiresAt > now : false;

  return NextResponse.json({
    messages: (messages ?? []).map((m) => ({
      id:            m.id,
      body:          m.body,
      fromMe:        m.direction === "outbound",
      direction:     m.direction,
      status:        m.status,
      timestamp:     m.sent_at ?? m.created_at,
      sent_at:       m.sent_at,
      created_at:    m.created_at,
      media_url:     m.media_url,
      template_id:   m.template_id,
      message_sid:   m.message_sid,
      delivered_at:  m.delivered_at,
      read_at:       m.read_at,
      error_message: m.error_message,
      is_demo:       m.is_demo,
      scheduled_at:  m.scheduled_at,
    })),
    window_open:       windowOpen,
    window_expires_at: conv.window_expires_at,
  });
}
