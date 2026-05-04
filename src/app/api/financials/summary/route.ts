import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Fetch all rows from v_invoices_enriched in one pass (paginated server-side)
async function fetchAllInvoices() {
  const PAGE = 1000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("v_invoices_enriched")
      .select(
        "invoice_id,invoice_number,invoice_date,patient_id,patient_first_name,patient_last_name,doctor_user_id,doctor_name,provider_id,provider_name,payment_method,total_amount,paid_amount,status,is_complimentary,created_by_name,is_archived",
      )
      .eq("is_archived", false)
      .is("parent_invoice_id", null)
      .order("invoice_date", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 100000) break;
  }
  return all;
}

// Fetch all line items from v_invoice_lines_enriched in one pass
async function fetchAllLineItems() {
  const PAGE = 2000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("v_invoice_lines_enriched")
      .select(
        "line_id,invoice_id,line_name,quantity,total_price,catalog_nature,tariff_code,code,invoice_status,is_archived",
      )
      .eq("is_archived", false)
      .order("line_id", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 500000) break;
  }
  return all;
}

export async function GET(_req: NextRequest) {
  try {
    // Fetch invoices and line items in PARALLEL
    const [invoiceRows, lineItemRows] = await Promise.all([
      fetchAllInvoices(),
      fetchAllLineItems(),
    ]);

    // Build a map of invoice_id -> line items
    const itemsByInvoice = new Map<string, any[]>();
    for (const item of lineItemRows) {
      const id = item.invoice_id as string;
      if (!itemsByInvoice.has(id)) itemsByInvoice.set(id, []);
      itemsByInvoice.get(id)!.push(item);
    }

    // Normalize invoices
    const normalized = invoiceRows.map((row: any) => {
      const patientName =
        [row.patient_first_name, row.patient_last_name]
          .filter(Boolean)
          .join(" ") || "Unknown patient";

      const amount = Number(row.total_amount) || 0;
      const isPaid = row.status === "PAID" || row.status === "OVERPAID";

      const ownerLabel =
        row.provider_name ||
        row.doctor_name ||
        row.created_by_name ||
        "Unassigned";

      const ownerKey =
        row.provider_id || row.doctor_user_id || ownerLabel;

      const doctorKey = row.doctor_user_id || row.doctor_name || "unknown";
      const doctorLabel = row.doctor_name || "Unassigned";

      const statusLabel = row.is_complimentary
        ? "Complimentary"
        : isPaid
        ? "Paid"
        : row.status === "PARTIAL_PAID"
        ? "Partial"
        : row.status === "CANCELLED"
        ? "Cancelled"
        : "Unpaid";

      const items = itemsByInvoice.get(row.invoice_id) || [];
      const serviceNames = items.map((i: any) => i.line_name as string).filter(Boolean);

      // Determine item types present
      const itemTypes = new Set<string>();
      for (const item of items) {
        if (item.code && item.catalog_nature === "TARIFF_CATALOG" && item.tariff_code) {
          itemTypes.add("tardoc");
        } else if (item.code) {
          itemTypes.add("insurance");
        } else if (item.line_name) {
          itemTypes.add("service");
        } else {
          itemTypes.add("material");
        }
      }

      return {
        id: row.invoice_id as string,
        invoice_number: row.invoice_number as string,
        invoice_date: (row.invoice_date as string | null)?.substring(0, 10) ?? null,
        patient_id: row.patient_id as string | null,
        patientName,
        doctor_user_id: row.doctor_user_id as string | null,
        doctor_name: row.doctor_name as string | null,
        doctorKey,
        doctorLabel,
        provider_id: row.provider_id as string | null,
        ownerKey,
        ownerLabel,
        payment_method: row.payment_method as string | null,
        amount,
        isPaid,
        is_complimentary: Boolean(row.is_complimentary),
        status: row.status as string,
        statusLabel,
        serviceNames,
        itemTypes: Array.from(itemTypes),
      };
    });

    // Pre-aggregate service summary
    const serviceMap = new Map<string, {
      serviceName: string;
      invoiceCount: number;
      quantity: number;
      totalRevenue: number;
      paidRevenue: number;
    }>();

    for (const item of lineItemRows) {
      const key = (item.line_name as string) || "Unknown";
      let entry = serviceMap.get(key);
      if (!entry) {
        entry = { serviceName: key, invoiceCount: 0, quantity: 0, totalRevenue: 0, paidRevenue: 0 };
      }
      entry.invoiceCount += 1;
      entry.quantity += Number(item.quantity) || 1;
      const lineTotal = Number(item.total_price) || 0;
      entry.totalRevenue += lineTotal;
      const isPaidInv =
        item.invoice_status === "PAID" || item.invoice_status === "OVERPAID";
      if (isPaidInv) entry.paidRevenue += lineTotal;
      serviceMap.set(key, entry);
    }

    const serviceSummary = Array.from(serviceMap.values()).sort(
      (a, b) => b.invoiceCount - a.invoiceCount,
    );

    return NextResponse.json({
      invoices: normalized,
      serviceSummary,
      counts: {
        invoices: normalized.length,
        lineItems: lineItemRows.length,
      },
    });
  } catch (err: any) {
    console.error("financials/summary error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
