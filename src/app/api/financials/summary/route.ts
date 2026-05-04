import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Fetch all invoices (top-level only) with patient + provider info via joins
// ---------------------------------------------------------------------------
async function fetchAllInvoices() {
  const PAGE = 1000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select(
        `id,
         invoice_number,
         invoice_date,
         patient_id,
         doctor_user_id,
         doctor_name,
         provider_id,
         provider_name,
         payment_method,
         total_amount,
         paid_amount,
         status,
         is_complimentary,
         created_by_name,
         is_archived,
         patients!invoices_patient_id_fkey(first_name, last_name)`,
      )
      .eq("is_archived", false)
      .is("parent_invoice_id", null)
      .order("invoice_date", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error("fetchAllInvoices error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 200000) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Fetch all invoice line items with service_id included
// ---------------------------------------------------------------------------
async function fetchAllLineItems() {
  const PAGE = 2000;
  let offset = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("invoice_line_items")
      .select(
        `id,
         invoice_id,
         name,
         service_id,
         quantity,
         total_price,
         catalog_nature,
         tariff_code,
         tardoc_code,
         code,
         uncovered_benefit`,
      )
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error("fetchAllLineItems error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 500000) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Classify a line item into an item type
// ---------------------------------------------------------------------------
function classifyItemType(item: any): "service" | "tardoc" | "insurance" | "material" {
  if (item.service_id) return "service";
  if (item.tardoc_code) return "tardoc";
  if (item.code && item.uncovered_benefit === false) return "insurance";
  if (item.code) return "insurance";
  return "material";
}

// ---------------------------------------------------------------------------
// GET /api/financials/summary
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const [invoiceRows, lineItemRows] = await Promise.all([
      fetchAllInvoices(),
      fetchAllLineItems(),
    ]);

    // index line items by invoice_id
    const itemsByInvoice = new Map<string, any[]>();
    for (const item of lineItemRows) {
      const id = item.invoice_id as string;
      if (!itemsByInvoice.has(id)) itemsByInvoice.set(id, []);
      itemsByInvoice.get(id)!.push(item);
    }

    // index invoice status by invoice_id for line-item paid revenue calc
    const invoiceStatusById = new Map<string, string>();
    for (const row of invoiceRows) {
      invoiceStatusById.set(row.id as string, row.status as string);
    }

    // Normalize invoices
    const normalized = invoiceRows.map((row: any) => {
      const pat = row.patients as { first_name?: string; last_name?: string } | null;
      const patientName =
        [pat?.first_name, pat?.last_name].filter(Boolean).join(" ") ||
        "Unknown patient";

      const amount = Number(row.total_amount) || 0;
      const isPaid = row.status === "PAID" || row.status === "OVERPAID";

      const ownerLabel =
        row.provider_name || row.doctor_name || row.created_by_name || "Unassigned";
      const ownerKey = row.provider_id || row.doctor_user_id || ownerLabel;

      const doctorKey = row.doctor_user_id || row.doctor_name || "unknown";
      const doctorLabel = row.doctor_name || (doctorKey === "unknown" ? "Unassigned" : doctorKey);

      const statusLabel = row.is_complimentary
        ? "Complimentary"
        : isPaid
        ? "Paid"
        : row.status === "PARTIAL_PAID"
        ? "Partial"
        : row.status === "CANCELLED"
        ? "Cancelled"
        : "Unpaid";

      const items = itemsByInvoice.get(row.id as string) || [];
      const serviceNames = [...new Set(
        items.map((i: any) => (i.name as string | null)).filter(Boolean) as string[]
      )];

      const itemTypes = new Set<string>();
      for (const item of items) {
        itemTypes.add(classifyItemType(item));
      }

      return {
        id: row.id as string,
        invoice_number: (row.invoice_number ?? "") as string,
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

    // Pre-aggregate global service summary (for unfiltered view)
    type ServiceEntry = {
      serviceName: string;
      invoiceCount: number;
      quantity: number;
      totalRevenue: number;
      paidRevenue: number;
      invoiceIds: Set<string>;
    };
    const serviceMap = new Map<string, ServiceEntry>();

    for (const item of lineItemRows) {
      const invId = item.invoice_id as string;
      const key = (item.name as string | null) || "Unknown";
      let entry = serviceMap.get(key);
      if (!entry) {
        entry = {
          serviceName: key,
          invoiceCount: 0,
          quantity: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          invoiceIds: new Set(),
        };
      }
      if (!entry.invoiceIds.has(invId)) {
        entry.invoiceIds.add(invId);
        entry.invoiceCount += 1;
      }
      entry.quantity += Number(item.quantity) || 1;
      const lineTotal = Number(item.total_price) || 0;
      entry.totalRevenue += lineTotal;
      const invStatus = invoiceStatusById.get(invId) ?? "";
      if (invStatus === "PAID" || invStatus === "OVERPAID") {
        entry.paidRevenue += lineTotal;
      }
      serviceMap.set(key, entry);
    }

    const serviceSummary = Array.from(serviceMap.values())
      .map(({ invoiceIds: _, ...rest }) => rest)
      .sort((a, b) => b.invoiceCount - a.invoiceCount);

    // Also return raw line items for client-side filtered service breakdown
    // (lightweight: only the fields needed)
    const lineItemsLite = lineItemRows.map((item: any) => ({
      invoice_id: item.invoice_id as string,
      name: (item.name ?? null) as string | null,
      service_id: (item.service_id ?? null) as string | null,
      quantity: Number(item.quantity) || 1,
      total_price: Number(item.total_price) || 0,
      item_type: classifyItemType(item),
    }));

    return NextResponse.json({
      invoices: normalized,
      serviceSummary,
      lineItems: lineItemsLite,
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
