// Shared aggregation helpers for the Statistics reports.
// Keeps the API routes thin: they fetch rows from the v_* views and call these.

export type InvoiceRow = {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  email_sent_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  invoice_title: string | null;
  amount_excl_vat: number;
  vat_amount_total: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  billing_type: string | null;
  health_insurance_law: string | null;
  cancellation_flag: string;
  parent_invoice_id: string | null;
  provider_id: string | null;
  provider_name: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  patient_id: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  vat_free_amount: number;
  vat_reduced_taxable: number;
  vat_reduced_amount: number;
  vat_reduced_rate: number | null;
  vat_full_taxable: number;
  vat_full_amount: number;
  vat_full_rate: number | null;
};

export type ServiceLineRow = {
  line_id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  paid_at: string | null;
  invoice_status: string;
  health_insurance_law: string | null;
  billing_type: string | null;
  provider_id: string | null;
  provider_name: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  patient_id: string;
  code: string | null;
  line_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_rate: string | null;
  vat_rate_value: number | null;
  vat_amount: number;
  tariff_code: number | null;
  catalog_name: string | null;
  catalog_nature: string | null;
  line_paid_amount: number;
  invoice_total_amount: number;
};

export type InvoiceTotals = {
  invoiceCount: number;
  amountExclVat: number;
  totalAmount: number;
  paidAmount: number;
  vatFree: number;
  vatReducedTaxable: number;
  vatReducedAmount: number;
  vatFullTaxable: number;
  vatFullAmount: number;
};

export type Group = {
  key: string;
  label: string;
  invoiceCount: number;
  amountExclVat: number;
  totalAmount: number;
  paidAmount: number;
  vatFree: number;
  vatReducedTaxable: number;
  vatReducedAmount: number;
  vatFullTaxable: number;
  vatFullAmount: number;
};

export function totalizeInvoices(rows: InvoiceRow[]): InvoiceTotals {
  const t: InvoiceTotals = {
    invoiceCount: 0,
    amountExclVat: 0,
    totalAmount: 0,
    paidAmount: 0,
    vatFree: 0,
    vatReducedTaxable: 0,
    vatReducedAmount: 0,
    vatFullTaxable: 0,
    vatFullAmount: 0,
  };
  for (const r of rows) {
    t.invoiceCount += 1;
    t.amountExclVat += Number(r.amount_excl_vat || 0);
    t.totalAmount += Number(r.total_amount || 0);
    t.paidAmount += Number(r.paid_amount || 0);
    t.vatFree += Number(r.vat_free_amount || 0);
    t.vatReducedTaxable += Number(r.vat_reduced_taxable || 0);
    t.vatReducedAmount += Number(r.vat_reduced_amount || 0);
    t.vatFullTaxable += Number(r.vat_full_taxable || 0);
    t.vatFullAmount += Number(r.vat_full_amount || 0);
  }
  return t;
}

export function groupInvoicesBy(
  rows: InvoiceRow[],
  keyFn: (r: InvoiceRow) => string,
  labelFn: (r: InvoiceRow) => string,
): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const k = keyFn(r);
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        label: labelFn(r),
        invoiceCount: 0,
        amountExclVat: 0,
        totalAmount: 0,
        paidAmount: 0,
        vatFree: 0,
        vatReducedTaxable: 0,
        vatReducedAmount: 0,
        vatFullTaxable: 0,
        vatFullAmount: 0,
      };
      map.set(k, g);
    }
    g.invoiceCount += 1;
    g.amountExclVat += Number(r.amount_excl_vat || 0);
    g.totalAmount += Number(r.total_amount || 0);
    g.paidAmount += Number(r.paid_amount || 0);
    g.vatFree += Number(r.vat_free_amount || 0);
    g.vatReducedTaxable += Number(r.vat_reduced_taxable || 0);
    g.vatReducedAmount += Number(r.vat_reduced_amount || 0);
    g.vatFullTaxable += Number(r.vat_full_taxable || 0);
    g.vatFullAmount += Number(r.vat_full_amount || 0);
  }
  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

// ── Service line aggregation ──────────────────────────────────────────
export type ServiceTotals = {
  lineCount: number;
  invoiceCount: number;
  totalPrice: number;
  paidPrice: number;
  vatAmount: number;
};

export type ServiceGroup = {
  key: string;
  label: string;
  lineCount: number;
  invoiceCount: number;
  totalPrice: number;
  paidPrice: number;
  vatAmount: number;
};

export function totalizeServices(rows: ServiceLineRow[]): ServiceTotals {
  const t: ServiceTotals = {
    lineCount: 0,
    invoiceCount: 0,
    totalPrice: 0,
    paidPrice: 0,
    vatAmount: 0,
  };
  const invoices = new Set<string>();
  for (const r of rows) {
    t.lineCount += 1;
    invoices.add(r.invoice_id);
    t.totalPrice += Number(r.total_price || 0);
    t.paidPrice += Number(r.line_paid_amount || 0);
    t.vatAmount += Number(r.vat_amount || 0);
  }
  t.invoiceCount = invoices.size;
  return t;
}

export function groupServicesBy(
  rows: ServiceLineRow[],
  keyFn: (r: ServiceLineRow) => string,
  labelFn: (r: ServiceLineRow) => string,
): ServiceGroup[] {
  const map = new Map<string, ServiceGroup & { _invoices: Set<string> }>();
  for (const r of rows) {
    const k = keyFn(r);
    let g = map.get(k);
    if (!g) {
      g = {
        key: k,
        label: labelFn(r),
        lineCount: 0,
        invoiceCount: 0,
        totalPrice: 0,
        paidPrice: 0,
        vatAmount: 0,
        _invoices: new Set(),
      };
      map.set(k, g);
    }
    g.lineCount += 1;
    g._invoices.add(r.invoice_id);
    g.totalPrice += Number(r.total_price || 0);
    g.paidPrice += Number(r.line_paid_amount || 0);
    g.vatAmount += Number(r.vat_amount || 0);
  }
  return Array.from(map.values())
    .map((g) => {
      const { _invoices, ...rest } = g;
      return { ...rest, invoiceCount: _invoices.size };
    })
    .sort((a, b) => b.totalPrice - a.totalPrice);
}
