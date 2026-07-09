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

// =====================================================================
// Agenda patients payments fetcher
// =====================================================================

export type AgendaPaymentRow = {
  payment_id: string;
  payment_date: string;
  payment_method: string | null;
  amount: number;
  invoice_number: string;
  invoice_date: string;
  invoice_total: number;
  invoice_paid: number;
  invoice_status: string;
  patient_id: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  notes: string | null;
};

export type AgendaGroup = {
  key: string;
  label: string;
  patientCount: number;
  invoiceCount: number;
  totalPaid: number;
  totalBilled: number;
  email?: string;
  phone?: string;
};

export type AgendaPaymentsTotals = {
  patientCount: number;
  invoiceCount: number;
  totalPaid: number;
  totalBilled: number;
};

export type AgendaPatientsPaymentsResult = {
  rows: AgendaPaymentRow[];
  totals: AgendaPaymentsTotals;
  groups: {
    byMonth: AgendaGroup[];
    byPaymentMethod: AgendaGroup[];
    byPatient: AgendaGroup[];
  };
};

/**
 * Patients who had at least one appointment in the given agenda (location)
 * and how much they paid during [from, to].
 *
 * "Agenda" corresponds to the `location` column in `appointments` —
 * this is how both new and legacy (migrated) appointments identify the clinic.
 */
export async function fetchAgendaPatientsPayments(params: {
  from: string;
  to: string;
  agenda: string; // value of appointments.location, e.g. "Montreux"
}): Promise<AgendaPatientsPaymentsResult> {
  const { from, to, agenda } = params;

  // Step 1: collect patient IDs who ever had an appointment in this agenda
  let apptQuery = supabaseAdmin
    .from("appointments")
    .select("patient_id")
    .not("patient_id", "is", null);
  if (agenda) apptQuery = apptQuery.eq("location", agenda);

  const { data: apptRows, error: apptErr } = await apptQuery;
  if (apptErr) throw new Error(apptErr.message);

  const patientIds = [...new Set((apptRows ?? []).map((r: { patient_id: string }) => r.patient_id))];

  const empty: AgendaPatientsPaymentsResult = {
    rows: [],
    totals: { patientCount: 0, invoiceCount: 0, totalPaid: 0, totalBilled: 0 },
    groups: { byMonth: [], byPaymentMethod: [], byPatient: [] },
  };
  if (patientIds.length === 0) return empty;

  // Step 2: fetch granular payment rows from invoice_payments (most accurate)
  const { data: pmtRows, error: pmtErr } = await supabaseAdmin
    .from("invoice_payments")
    .select(`
      id,
      amount,
      payment_date,
      payment_method,
      notes,
      invoices!inner(
        patient_id,
        invoice_number,
        invoice_date,
        total_amount,
        paid_amount,
        payment_method,
        status,
        patients!inner(
          first_name,
          last_name,
          email,
          phone
        )
      )
    `)
    .in("invoices.patient_id", patientIds)
    .gte("payment_date", from)
    .lte("payment_date", to)
    .order("payment_date", { ascending: false });
  if (pmtErr) throw new Error(pmtErr.message);

  // Step 3: if no invoice_payments rows, fall back to the invoices view
  //   (invoices paid in range, one row per invoice)
  let paymentData: Array<{
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string | null;
    notes: string | null;
    inv: {
      patient_id: string;
      invoice_number: string;
      invoice_date: string;
      total_amount: number;
      paid_amount: number;
      payment_method: string | null;
      status: string;
      patient_first_name: string | null;
      patient_last_name: string | null;
      patient_email: string | null;
      patient_phone: string | null;
    };
  }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((pmtRows ?? []).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentData = (pmtRows as any[]).map((p: any) => {
      // Supabase returns nested !inner joins as arrays; take first element
      const inv = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
      const pt = Array.isArray(inv?.patients) ? inv.patients[0] : inv?.patients;
      return {
        id: p.id as string,
        amount: p.amount as number,
        payment_date: p.payment_date as string,
        payment_method: p.payment_method as string | null,
        notes: p.notes as string | null,
        inv: {
          patient_id: inv?.patient_id as string,
          invoice_number: inv?.invoice_number as string,
          invoice_date: inv?.invoice_date as string,
          total_amount: (inv?.total_amount ?? 0) as number,
          paid_amount: (inv?.paid_amount ?? 0) as number,
          payment_method: inv?.payment_method as string | null,
          status: inv?.status as string,
          patient_first_name: (pt?.first_name ?? null) as string | null,
          patient_last_name: (pt?.last_name ?? null) as string | null,
          patient_email: (pt?.email ?? null) as string | null,
          patient_phone: (pt?.phone ?? null) as string | null,
        },
      };
    });
  } else {
    // fallback: v_invoices_enriched (paid in range)
    const { data: invRows, error: invErr } = await supabaseAdmin
      .from("v_invoices_enriched")
      .select(`
        invoice_id,
        invoice_number,
        invoice_date,
        paid_date_effective,
        paid_at,
        payment_method,
        total_amount,
        paid_amount,
        status,
        patient_id,
        patient_first_name,
        patient_last_name,
        patients!inner(email, phone)
      `)
      .in("patient_id", patientIds)
      .eq("is_demo", false)
      .eq("is_archived", false)
      .gte("paid_date_effective", `${from}T00:00:00Z`)
      .lte("paid_date_effective", `${to}T23:59:59Z`)
      .in("status", ["PAID", "PARTIAL_PAID", "OVERPAID"])
      .order("paid_date_effective", { ascending: false });
    if (invErr) throw new Error(invErr.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentData = (invRows as any[]).map((inv: any) => {
      const pt = Array.isArray(inv.patients) ? inv.patients[0] : inv.patients;
      return {
        id: inv.invoice_id as string,
        amount: (inv.paid_amount ?? 0) as number,
        payment_date: ((inv.paid_date_effective ?? inv.paid_at ?? "") as string).slice(0, 10),
        payment_method: inv.payment_method as string | null,
        notes: null as string | null,
        inv: {
          patient_id: inv.patient_id as string,
          invoice_number: inv.invoice_number as string,
          invoice_date: inv.invoice_date as string,
          total_amount: (inv.total_amount ?? 0) as number,
          paid_amount: (inv.paid_amount ?? 0) as number,
          payment_method: inv.payment_method as string | null,
          status: inv.status as string,
          patient_first_name: inv.patient_first_name as string | null,
          patient_last_name: inv.patient_last_name as string | null,
          patient_email: (pt?.email ?? null) as string | null,
          patient_phone: (pt?.phone ?? null) as string | null,
        },
      };
    });
  }

  // Step 4: aggregate
  const byMonth: Record<string, AgendaGroup> = {};
  const byMethod: Record<string, AgendaGroup> = {};
  const byPatient: Record<string, AgendaGroup> = {};
  const uniquePatients = new Set<string>();
  const uniqueInvoices = new Set<string>();
  let totalPaid = 0;
  let totalBilled = 0;

  for (const p of paymentData) {
    const month = p.payment_date.slice(0, 7) || "Unknown";
    const method = p.payment_method || "Unknown";
    const pid = p.inv.patient_id;
    const name = `${p.inv.patient_last_name ?? ""} ${p.inv.patient_first_name ?? ""}`.trim() || "Unknown";

    totalPaid += p.amount;
    totalBilled += p.inv.total_amount;
    uniquePatients.add(pid);
    uniqueInvoices.add(p.inv.invoice_number);

    if (!byMonth[month]) byMonth[month] = { key: month, label: month, patientCount: 0, invoiceCount: 0, totalPaid: 0, totalBilled: 0 };
    byMonth[month].invoiceCount++;
    byMonth[month].totalPaid += p.amount;
    byMonth[month].totalBilled += p.inv.total_amount;

    if (!byMethod[method]) byMethod[method] = { key: method, label: method, patientCount: 0, invoiceCount: 0, totalPaid: 0, totalBilled: 0 };
    byMethod[method].invoiceCount++;
    byMethod[method].totalPaid += p.amount;
    byMethod[method].totalBilled += p.inv.total_amount;

    if (!byPatient[pid]) {
      byPatient[pid] = { key: pid, label: name, patientCount: 1, invoiceCount: 0, totalPaid: 0, totalBilled: 0, email: p.inv.patient_email ?? undefined, phone: p.inv.patient_phone ?? undefined };
    }
    byPatient[pid].invoiceCount++;
    byPatient[pid].totalPaid += p.amount;
    byPatient[pid].totalBilled += p.inv.total_amount;
  }

  // fill per-group patient counts
  for (const g of Object.values(byMonth)) {
    const s = new Set(paymentData.filter(p => p.payment_date.slice(0, 7) === g.key).map(p => p.inv.patient_id));
    g.patientCount = s.size;
  }
  for (const g of Object.values(byMethod)) {
    const s = new Set(paymentData.filter(p => (p.payment_method ?? "Unknown") === g.key).map(p => p.inv.patient_id));
    g.patientCount = s.size;
  }

  const rows: AgendaPaymentRow[] = paymentData.map((p) => ({
    payment_id: p.id,
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    amount: p.amount,
    invoice_number: p.inv.invoice_number,
    invoice_date: p.inv.invoice_date,
    invoice_total: p.inv.total_amount,
    invoice_paid: p.inv.paid_amount,
    invoice_status: p.inv.status,
    patient_id: p.inv.patient_id,
    patient_first_name: p.inv.patient_first_name,
    patient_last_name: p.inv.patient_last_name,
    patient_email: p.inv.patient_email,
    patient_phone: p.inv.patient_phone,
    notes: p.notes,
  }));

  return {
    rows,
    totals: {
      patientCount: uniquePatients.size,
      invoiceCount: uniqueInvoices.size,
      totalPaid,
      totalBilled,
    },
    groups: {
      byMonth: Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)),
      byPaymentMethod: Object.values(byMethod).sort((a, b) => b.totalPaid - a.totalPaid),
      byPatient: Object.values(byPatient).sort((a, b) => b.totalPaid - a.totalPaid),
    },
  };
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
