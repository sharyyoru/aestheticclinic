import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type InvoiceRow,
  type ServiceLineRow,
  groupInvoicesBy,
  totalizeInvoices,
  groupServicesBy,
  totalizeServices,
} from "@/lib/statisticsAggregator";

// =====================================================================
// Invoice fetchers
// =====================================================================

export async function fetchSentInvoices(params: {
  from: string;
  to: string;
  entityId: string;
  doctorId: string;
  law: string;
  billingType: string;
  includeCancelled: boolean;
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
      .gte("invoice_date", params.from)
      .lte("invoice_date", params.to)
      .order("invoice_date", { ascending: false })
      .order("invoice_id", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (!params.includeCancelled) q = q.neq("status", "CANCELLED");
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

export async function fetchPaidInvoices(params: {
  from: string;
  to: string;
  entityId: string;
  doctorId: string;
  law: string;
  billingType: string;
}): Promise<InvoiceRow[]> {
  const PAID_STATUSES = ["PAID", "PARTIAL_PAID", "OVERPAID"];
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

export function buildSentInvoicesResponse(rows: InvoiceRow[]) {
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
  const byStatus = groupInvoicesBy(
    rows,
    (r) => r.status,
    (r) => r.status,
  );
  return { rows, totals, groups: { byEntity, byDoctor, byStatus } };
}

export function buildPaidInvoicesResponse(rows: InvoiceRow[]) {
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
  return { rows, totals, groups: { byEntity, byDoctor, byPaymentMethod } };
}

// =====================================================================
// Service-line fetchers
// =====================================================================

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

export function buildServicesResponse(rows: ServiceLineRow[]) {
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
