/**
 * GET /api/email-reports
 *
 * Server-side paginated email reports API.
 * Query params: page, per_page, direction, status, source, search, date_from, date_to
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "25", 10)));
    const direction = url.searchParams.get("direction") || "all";
    const status = url.searchParams.get("status") || "all";
    const source = url.searchParams.get("source") || "all";
    const search = (url.searchParams.get("search") || "").trim();
    const dateFrom = url.searchParams.get("date_from") || "";
    const dateTo = url.searchParams.get("date_to") || "";

    // Build the query for emails (without body for performance)
    let query = supabaseAdmin
      .from("emails")
      .select(
        "id, patient_id, deal_id, to_address, from_address, subject, status, direction, source, sent_at, read_at, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (direction !== "all") {
      query = query.eq("direction", direction);
    }

    if (status === "read") {
      query = query.not("read_at", "is", null);
    } else if (status !== "all") {
      query = query.eq("status", status);
    }

    if (source !== "all") {
      query = query.eq("source", source);
    }

    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte("created_at", toDate.toISOString());
    }

    if (search) {
      // Search across subject, to_address, from_address
      query = query.or(
        `subject.ilike.%${search}%,to_address.ilike.%${search}%,from_address.ilike.%${search}%`
      );
    }

    // Pagination
    const offset = (page - 1) * perPage;
    query = query.range(offset, offset + perPage - 1);

    const { data: emails, count, error } = await query;

    if (error) {
      console.error("[email-reports] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch stats separately (lightweight count queries)
    const [
      { count: totalCount },
      { count: sentCount },
      { count: failedCount },
      { count: readCount },
      { count: outboundCount },
      { count: inboundCount },
      { count: automationCount },
      { count: manualCount },
    ] = await Promise.all([
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).not("read_at", "is", null),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).eq("direction", "outbound"),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).eq("direction", "inbound"),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).eq("source", "automation"),
      supabaseAdmin.from("emails").select("id", { count: "exact", head: true }).or("source.eq.manual,source.is.null"),
    ]);

    // Get patient info for displayed emails
    const patientIds = [...new Set((emails || []).map((e: any) => e.patient_id).filter(Boolean))];
    let patients: Record<string, { first_name: string; last_name: string; email: string | null }> = {};

    if (patientIds.length > 0) {
      const { data: patientData } = await supabaseAdmin
        .from("patients")
        .select("id, first_name, last_name, email")
        .in("id", patientIds);

      if (patientData) {
        for (const p of patientData) {
          patients[p.id] = { first_name: p.first_name, last_name: p.last_name, email: p.email };
        }
      }
    }

    return NextResponse.json({
      emails: emails || [],
      patients,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
      stats: {
        total: totalCount || 0,
        sent: sentCount || 0,
        failed: failedCount || 0,
        read: readCount || 0,
        outbound: outboundCount || 0,
        inbound: inboundCount || 0,
        automation: automationCount || 0,
        manual: manualCount || 0,
      },
    });
  } catch (err: any) {
    console.error("[email-reports] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
