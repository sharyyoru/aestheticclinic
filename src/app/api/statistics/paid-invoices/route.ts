import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type InvoiceRow,
  groupInvoicesBy,
  totalizeInvoices,
} from "@/lib/statisticsAggregator";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["PAID", "PARTIAL_PAID", "OVERPAID"];

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const entityId = url.searchParams.get("entityId") || "";
    const doctorId = url.searchParams.get("doctorId") || "";
    const law = url.searchParams.get("law") || "";
    const billingType = url.searchParams.get("billingType") || "";

    if (!from || !to) {
      return NextResponse.json(
        { error: "Missing 'from' or 'to'" },
        { status: 400 },
      );
    }

    const rows = await fetchPaidInvoices({
      from,
      to,
      entityId,
      doctorId,
      law,
      billingType,
    });
    const totals = totalizeInvoices(rows);
    const byEntity = groupInvoicesBy(
      rows,
      (r) => r.provider_id || "(none)",
      (r) => r.provider_name || "(no entity)",
    );
    const byDoctor = groupInvoicesBy(
      rows,
      (r) => r.doctor_user_id || r.doctor_name || "(none)",
      (r) => r.doctor_name || "(no doctor)",
    );
    const byPaymentMethod = groupInvoicesBy(
      rows,
      (r) => r.payment_method || "(none)",
      (r) => r.payment_method || "(unknown)",
    );

    return NextResponse.json({
      rows,
      totals,
      groups: { byEntity, byDoctor, byPaymentMethod },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function fetchPaidInvoices(params: {
  from: string;
  to: string;
  entityId: string;
  doctorId: string;
  law: string;
  billingType: string;
}): Promise<InvoiceRow[]> {
  const all: InvoiceRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    let q = supabaseAdmin
      .from("v_invoices_enriched")
      .select("*")
      .eq("is_demo", false)
      .eq("is_archived", false)
      .gte("paid_date_effective", `${params.from}T00:00:00Z`)
      .lte("paid_date_effective", `${params.to}T23:59:59Z`)
      .in("status", PAID_STATUSES)
      .order("paid_date_effective", { ascending: false })
      .order("invoice_id", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (params.entityId) q = q.eq("provider_id", params.entityId);
    if (params.doctorId) q = q.eq("doctor_user_id", params.doctorId);
    if (params.law) q = q.eq("health_insurance_law", params.law);
    if (params.billingType) q = q.eq("billing_type", params.billingType);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as InvoiceRow[]));
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 50000) break;
  }
  return all;
}
