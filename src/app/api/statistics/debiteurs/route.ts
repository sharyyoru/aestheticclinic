import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type DebiteurRow = {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  reminder_fees: number;
  open_amount: number;
  loss_amount: number;
  status: string;
  reminder_level: number;
  billing_type: string | null;
  health_insurance_law: string | null;
  provider_id: string | null;
  provider_name: string | null;
  provider_zsr: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  patient_email: string | null;
  days_overdue: number;
  invoice_title: string | null;
  paid_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const asOf = url.searchParams.get("asOf"); // optional, defaults to today
    const entityId = url.searchParams.get("entityId") || "";
    const doctorId = url.searchParams.get("doctorId") || "";
    const law = url.searchParams.get("law") || "";
    const billingType = url.searchParams.get("billingType") || "";
    const minLevelStr = url.searchParams.get("minLevel");
    const minLevel = minLevelStr ? Number(minLevelStr) : 0;

    let q = supabaseAdmin
      .from("v_debiteurs")
      .select("*")
      .eq("is_demo", false)
      .eq("is_archived", false)
      .gte("reminder_level", minLevel)
      .order("invoice_date", { ascending: false })
      .limit(5000);

    if (entityId) q = q.eq("provider_id", entityId);
    if (doctorId) q = q.eq("doctor_user_id", doctorId);
    if (law) q = q.eq("health_insurance_law", law);
    if (billingType) q = q.eq("billing_type", billingType);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = (data || []) as DebiteurRow[];

    // If asOf provided, only include invoices issued on or before that date
    if (asOf) {
      rows = rows.filter((r) => r.invoice_date <= asOf);
    }

    // Aggregations
    const totals = rows.reduce(
      (acc, r) => {
        acc.invoiceCount += 1;
        acc.totalAmount += Number(r.total_amount || 0);
        acc.paidAmount += Number(r.paid_amount || 0);
        acc.reminderFees += Number(r.reminder_fees || 0);
        acc.openAmount += Number(r.open_amount || 0);
        acc.lossAmount += Number(r.loss_amount || 0);
        return acc;
      },
      {
        invoiceCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        reminderFees: 0,
        openAmount: 0,
        lossAmount: 0,
      },
    );

    // Per-entity aggregation
    const byEntity = aggregate(rows, (r) => r.provider_id || "(none)", (r) => ({
      key: r.provider_id || "(none)",
      label: r.provider_name || "(no entity)",
    }));

    // Per-doctor aggregation
    const byDoctor = aggregate(
      rows,
      (r) => r.doctor_user_id || r.doctor_name || "(none)",
      (r) => ({
        key: r.doctor_user_id || r.doctor_name || "(none)",
        label: r.doctor_name || "(no doctor)",
      }),
    );

    // Per-patient aggregation
    const byPatient = aggregate(
      rows,
      (r) => r.patient_id,
      (r) => ({
        key: r.patient_id,
        label: `${r.last_name || ""} ${r.first_name || ""}`.trim() || "(no name)",
      }),
    );

    return NextResponse.json({
      rows,
      totals,
      groups: { byEntity, byDoctor, byPatient },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function aggregate(
  rows: DebiteurRow[],
  keyFn: (r: DebiteurRow) => string,
  metaFn: (r: DebiteurRow) => { key: string; label: string },
) {
  const map = new Map<
    string,
    {
      key: string;
      label: string;
      invoiceCount: number;
      totalAmount: number;
      paidAmount: number;
      openAmount: number;
      lossAmount: number;
      reminderFees: number;
    }
  >();
  for (const r of rows) {
    const k = keyFn(r);
    let g = map.get(k);
    if (!g) {
      const meta = metaFn(r);
      g = {
        key: meta.key,
        label: meta.label,
        invoiceCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        openAmount: 0,
        lossAmount: 0,
        reminderFees: 0,
      };
      map.set(k, g);
    }
    g.invoiceCount += 1;
    g.totalAmount += Number(r.total_amount || 0);
    g.paidAmount += Number(r.paid_amount || 0);
    g.openAmount += Number(r.open_amount || 0);
    g.lossAmount += Number(r.loss_amount || 0);
    g.reminderFees += Number(r.reminder_fees || 0);
  }
  return Array.from(map.values()).sort((a, b) => b.openAmount - a.openAmount);
}
