import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type ServiceLineRow,
  groupServicesBy,
  totalizeServices,
} from "@/lib/statisticsAggregator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }
    const params = {
      from,
      to,
      entityId: url.searchParams.get("entityId") || "",
      doctorId: url.searchParams.get("doctorId") || "",
      law: url.searchParams.get("law") || "",
      billingType: url.searchParams.get("billingType") || "",
      includeCancelled: url.searchParams.get("includeCancelled") === "true",
    };
    const rows = await fetchInvoicedServices(params);
    return NextResponse.json(buildResponse(rows));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export function buildResponse(rows: ServiceLineRow[]) {
  const totals = totalizeServices(rows);
  const byEntity = groupServicesBy(
    rows,
    (r) => r.provider_id || "(none)",
    (r) => r.provider_name || "(no entity)",
  );
  const byDoctor = groupServicesBy(
    rows,
    (r) => r.doctor_user_id || r.doctor_name || "(none)",
    (r) => r.doctor_name || "(no doctor)",
  );
  const byTariffCode = groupServicesBy(
    rows,
    (r) => String(r.tariff_code ?? "(none)"),
    (r) => `${r.tariff_code ?? "—"} (${r.catalog_name ?? "—"})`,
  );
  const byCatalog = groupServicesBy(
    rows,
    (r) => r.catalog_name || "(none)",
    (r) => r.catalog_name || "(no catalog)",
  );
  return {
    rows,
    totals,
    groups: { byEntity, byDoctor, byTariffCode, byCatalog },
  };
}

export async function fetchInvoicedServices(params: {
  from: string;
  to: string;
  entityId: string;
  doctorId: string;
  law: string;
  billingType: string;
  includeCancelled: boolean;
}): Promise<ServiceLineRow[]> {
  return fetchServiceLines({ ...params, dateField: "invoice_date" });
}

/** Generic page-loop fetcher for v_invoice_lines_enriched. */
export async function fetchServiceLines(params: {
  from: string;
  to: string;
  entityId: string;
  doctorId: string;
  law: string;
  billingType: string;
  includeCancelled?: boolean;
  dateField: "invoice_date" | "paid_at";
  paidStatusOnly?: boolean;
}): Promise<ServiceLineRow[]> {
  const all: ServiceLineRow[] = [];
  const PAGE = 1000;
  let offset = 0;
  const isPaidAt = params.dateField === "paid_at";
  // When filtering by "paid date" we use the effective column so legacy
  // imports (where paid_at is NULL but the invoice is marked paid) still appear.
  const effectiveDateField = isPaidAt ? "paid_date_effective" : "invoice_date";
  while (true) {
    let q = supabaseAdmin
      .from("v_invoice_lines_enriched")
      .select(
        "line_id,invoice_id,invoice_number,invoice_date,paid_at,paid_date_effective,invoice_status,health_insurance_law,billing_type,provider_id,provider_name,doctor_user_id,doctor_name,patient_id,code,line_name,quantity,unit_price,total_price,vat_rate,vat_rate_value,vat_amount,tariff_code,catalog_name,catalog_nature,line_paid_amount,invoice_total_amount,is_demo,is_archived",
      )
      .eq("is_demo", false)
      .eq("is_archived", false)
      .gte(
        effectiveDateField,
        isPaidAt ? `${params.from}T00:00:00Z` : params.from,
      )
      .lte(
        effectiveDateField,
        isPaidAt ? `${params.to}T23:59:59Z` : params.to,
      )
      .order(effectiveDateField, { ascending: false })
      .order("line_id", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (params.paidStatusOnly) {
      q = q.in("invoice_status", ["PAID", "PARTIAL_PAID", "OVERPAID"]);
    } else if (!params.includeCancelled) {
      q = q.neq("invoice_status", "CANCELLED");
    }
    if (params.entityId) q = q.eq("provider_id", params.entityId);
    if (params.doctorId) q = q.eq("doctor_user_id", params.doctorId);
    if (params.law) q = q.eq("health_insurance_law", params.law);
    if (params.billingType) q = q.eq("billing_type", params.billingType);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as ServiceLineRow[]));
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 200000) break;
  }
  return all;
}
