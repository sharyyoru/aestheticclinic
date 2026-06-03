import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = "nodejs";

/**
 * GET /api/retell/logs
 * 
 * Fetch Retell webhook request logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const functionFilter = searchParams.get("function") || null;
    const eventFilter = searchParams.get("event") || null;
    const callIdFilter = searchParams.get("call_id") || null;
    const search = searchParams.get("search") || null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from("retell_request_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (functionFilter && functionFilter !== "all") {
      query = query.eq("function_name", functionFilter);
    }
    if (eventFilter && eventFilter !== "all") {
      query = query.eq("event_type", eventFilter);
    }
    if (callIdFilter) {
      query = query.ilike("call_id", `%${callIdFilter}%`);
    }
    if (search) {
      // Search in request_body JSONB field
      query = query.or(`call_id.ilike.%${search}%,function_name.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[Retell Logs] Error fetching logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("[Retell Logs] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/retell/logs
 * 
 * Delete old logs (older than specified days)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysOld = parseInt(searchParams.get("days") || "30");
    const logId = searchParams.get("id");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (logId) {
      // Delete specific log
      const { error } = await supabase
        .from("retell_request_logs")
        .delete()
        .eq("id", logId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "Log deleted" });
    }

    // Delete logs older than X days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error, count } = await supabase
      .from("retell_request_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${count || 0} logs older than ${daysOld} days`,
    });
  } catch (error) {
    console.error("[Retell Logs] Delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
