import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/sms/logs
 * 
 * Fetch SMS logs with pagination and filtering
 * Query params: page, limit, source, patient_id, search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const source = searchParams.get("source") || "";
    const patientLinked = searchParams.get("patient_linked") || "";
    const search = searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from("sms_logs")
      .select(`
        id,
        patient_id,
        to_number,
        from_number,
        message,
        message_type,
        source,
        twilio_sid,
        status,
        metadata,
        created_at,
        patient:patients!sms_logs_patient_id_fkey (
          id,
          first_name,
          last_name,
          email,
          mobile,
          avatar_url
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (source) {
      query = query.eq("source", source);
    }

    if (patientLinked === "true") {
      query = query.not("patient_id", "is", null);
    } else if (patientLinked === "false") {
      query = query.is("patient_id", null);
    }

    if (search) {
      query = query.or(`to_number.ilike.%${search}%,message.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("[SMS Logs] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch SMS logs", details: error.message },
        { status: 500 }
      );
    }

    const totalPages = count ? Math.ceil(count / limit) : 1;

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      page,
      totalPages,
      limit,
    });

  } catch (error) {
    console.error("[SMS Logs] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sms/logs
 * 
 * Manually log an SMS (for testing or manual entries)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patient_id, to_number, message, message_type, source } = body;

    if (!to_number || !message) {
      return NextResponse.json(
        { error: "to_number and message are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("sms_logs")
      .insert({
        patient_id: patient_id || null,
        to_number,
        message,
        message_type: message_type || "general",
        source: source || "manual",
        status: "logged",
        metadata: { manual_entry: true },
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to log SMS", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, log: data });

  } catch (error) {
    console.error("[SMS Logs] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
