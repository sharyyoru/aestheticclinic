import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// GET /api/whatsapp/templates
// Returns all WhatsApp templates from the DB.
// Optional query param: ?status=approved  (filter by status)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // e.g. "approved"

    let query = supabaseAdmin
      .from("whatsapp_templates")
      .select("id, name, category, language, body, variables, twilio_content_sid, status, created_at, updated_at")
      .order("name", { ascending: true });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch whatsapp_templates:", error);
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    console.error("Unexpected error in GET /api/whatsapp/templates:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
