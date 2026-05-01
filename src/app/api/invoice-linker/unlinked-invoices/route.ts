import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoice-linker/unlinked-invoices
 *
 * Returns invoices that do not yet have a consultation_id set.
 * Filters out demo, archived, and the `ralf@mutant.ae` test account.
 *
 * Query params:
 *   q        - free-text search over invoice_number, patient name, title
 *   year     - 4-digit year filter on invoice_date (optional)
 *   limit    - default 200, max 500
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const year = url.searchParams.get("year") || "";
    const limitRaw = parseInt(url.searchParams.get("limit") || "200", 10);
    const limit = Math.min(Math.max(limitRaw, 1), 500);

    let query = supabaseAdmin
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, total_amount, status, title, created_by_name, created_at, patient_id, doctor_name, provider_name, patients!inner(id, first_name, last_name, dob)",
      )
      .eq("is_demo", false)
      .eq("is_archived", false)
      .is("consultation_id", null)
      // exclude Ralf test account
      .not("created_by_name", "ilike", "%ralf@mutant.ae%")
      .order("invoice_date", { ascending: false })
      .order("invoice_number", { ascending: false })
      .limit(limit);

    if (year && /^\d{4}$/.test(year)) {
      query = query
        .gte("invoice_date", `${year}-01-01`)
        .lte("invoice_date", `${year}-12-31`);
    }

    if (q) {
      // search across invoice_number / title
      // Patient-name search is done client-side on the paginated slice for simplicity
      query = query.or(
        `invoice_number.ilike.%${q}%,title.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []).map((r: any) => ({
      invoice_id: r.id,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date,
      total_amount: r.total_amount,
      status: r.status,
      title: r.title,
      created_by_name: r.created_by_name,
      created_at: r.created_at,
      patient_id: r.patient_id,
      patient_first_name: r.patients?.first_name ?? null,
      patient_last_name: r.patients?.last_name ?? null,
      patient_dob: r.patients?.dob ?? null,
      doctor_name: r.doctor_name,
      provider_name: r.provider_name,
    }));

    return NextResponse.json({ rows, total: rows.length, limit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
