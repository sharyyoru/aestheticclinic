import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// GET /api/whatsapp/conversations
// Returns all conversations ordered by last_message_at desc, with patient name
// and window status (open | closed).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select(`
      id,
      patient_id,
      phone_number,
      last_message_at,
      last_message_preview,
      unread_count,
      last_inbound_at,
      window_expires_at,
      patients (
        id,
        first_name,
        last_name,
        phone
      )
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("[GET /api/whatsapp/conversations]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();

  const conversations = (data ?? []).map((row) => {
    const windowExpiresAt = row.window_expires_at ? new Date(row.window_expires_at) : null;
    const windowOpen = windowExpiresAt ? windowExpiresAt > now : false;
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;

    return {
      id:                   row.id,
      patient_id:           row.patient_id,
      phone_number:         row.phone_number,
      last_message_at:      row.last_message_at,
      last_message_preview: row.last_message_preview,
      unread_count:         row.unread_count ?? 0,
      last_inbound_at:      row.last_inbound_at,
      window_expires_at:    row.window_expires_at,
      window_open:          windowOpen,
      patient: patient
        ? {
            id:         (patient as any).id,
            first_name: (patient as any).first_name,
            last_name:  (patient as any).last_name,
            phone:      (patient as any).phone,
          }
        : null,
    };
  });

  return NextResponse.json({ conversations });
}
