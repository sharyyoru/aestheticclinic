import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  // Total invoices (no filters)
  const { count: totalAll } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true });

  // Non-archived, top-level only (what the financials page fetches)
  const { count: totalFiltered } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false)
    .is("parent_invoice_id", null);

  // Archived count
  const { count: totalArchived } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", true);

  // Child invoices count (parent_invoice_id IS NOT NULL)
  const { count: totalChildren } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .not("parent_invoice_id", "is", null);

  // Earliest and latest invoice dates (across ALL non-archived top-level)
  const { data: earliest } = await supabaseAdmin
    .from("invoices")
    .select("invoice_date, invoice_number, status")
    .eq("is_archived", false)
    .is("parent_invoice_id", null)
    .order("invoice_date", { ascending: true })
    .limit(5);

  const { data: latest } = await supabaseAdmin
    .from("invoices")
    .select("invoice_date, invoice_number, status")
    .eq("is_archived", false)
    .is("parent_invoice_id", null)
    .order("invoice_date", { ascending: false })
    .limit(5);

  // Invoices with null invoice_date
  const { count: nullDates } = await supabaseAdmin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false)
    .is("parent_invoice_id", null)
    .is("invoice_date", null);

  // Line item count
  const { count: lineCount } = await supabaseAdmin
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    invoices: {
      total_all_rows: totalAll,
      total_non_archived_top_level: totalFiltered,
      total_archived: totalArchived,
      total_child_invoices: totalChildren,
      with_null_date: nullDates,
    },
    line_items: {
      total: lineCount,
    },
    earliest_5: earliest,
    latest_5: latest,
  });
}
