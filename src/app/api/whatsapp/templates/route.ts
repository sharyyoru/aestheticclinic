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

// DELETE /api/whatsapp/templates?id=<uuid>
// Deletes a template from the local DB only (does not touch Twilio).
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("whatsapp_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete whatsapp_template:", error);
      return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error in DELETE /api/whatsapp/templates:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
