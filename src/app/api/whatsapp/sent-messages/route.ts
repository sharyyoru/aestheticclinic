import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// GET /api/whatsapp/sent-messages
// Fetches outbound WhatsApp messages with their delivery status
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const patientId = url.searchParams.get("patient_id") || null;
    
    let query = supabaseAdmin
      .from("whatsapp_messages")
      .select(`
        id,
        patient_id,
        to_number,
        from_number,
        body,
        status,
        direction,
        message_sid,
        sent_at,
        created_at,
        delivered_at,
        read_at,
        error_message,
        template_id,
        metadata,
        patients:patient_id (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (patientId) {
      query = query.eq("patient_id", patientId);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Error fetching sent messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch sent messages" },
        { status: 500 }
      );
    }
    
    // Format the response
    const messages = (data || []).map((msg: any) => ({
      id: msg.id,
      patient_id: msg.patient_id,
      to_number: msg.to_number,
      from_number: msg.from_number,
      body: msg.body,
      status: msg.status,
      message_sid: msg.message_sid,
      sent_at: msg.sent_at,
      created_at: msg.created_at,
      delivered_at: msg.delivered_at,
      read_at: msg.read_at,
      error_message: msg.error_message,
      template_id: msg.template_id,
      is_template: msg.body?.startsWith("[Template:") || !!msg.metadata?.content_sid,
      patient: msg.patients ? {
        id: msg.patients.id,
        first_name: msg.patients.first_name,
        last_name: msg.patients.last_name,
        phone: msg.patients.phone,
      } : null,
    }));
    
    return NextResponse.json({ messages, count: count ?? messages.length });
  } catch (error) {
    console.error("Unexpected error in /api/whatsapp/sent-messages:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching sent messages" },
      { status: 500 }
    );
  }
}
