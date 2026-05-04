import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Cache the result in Node.js module scope — survives across requests within the
// same server instance. Invalidated after CACHE_TTL_MS.
const CACHE_TTL_MS = 60_000; // 60 seconds
let cachedAt = 0;
let cachedPayload: string | null = null;

// ---------------------------------------------------------------------------
// Count total rows quickly (uses Supabase count=exact via HEAD)
// ---------------------------------------------------------------------------
async function countRows(table: string, filters?: (q: any) => any): Promise<number> {
  let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  if (filters) q = filters(q);
  const { count } = await q;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Fetch a table in parallel pages of PAGE_SIZE rows
// ---------------------------------------------------------------------------
async function fetchAllParallel<T>(
  table: string,
  selectFields: string,
  PAGE: number,
  totalCount: number,
  extraFilters?: (q: any) => any,
): Promise<T[]> {
  const offsets: number[] = [];
  for (let o = 0; o < totalCount; o += PAGE) offsets.push(o);
  if (offsets.length === 0) return [];

  const chunks = await Promise.all(
    offsets.map((offset) => {
      let q = supabaseAdmin
        .from(table)
        .select(selectFields)
        .range(offset, offset + PAGE - 1);
      if (extraFilters) q = extraFilters(q);
      return q;
    }),
  );

  const all: T[] = [];
  for (const { data, error } of chunks) {
    if (error) console.error(`fetchAllParallel(${table}) error:`, error.message);
    if (data) all.push(...(data as T[]));
  }
  return all;
}

// ---------------------------------------------------------------------------
// Classify a line item into an item type (server-side, not sent to client)
// ---------------------------------------------------------------------------
function classifyItemType(item: any): "service" | "tardoc" | "insurance" | "material" {
  if (item.service_id) return "service";
  if (item.tardoc_code) return "tardoc";
  if (item.code) return "insurance";
  return "material";
}

// ---------------------------------------------------------------------------
// Normalise raw invoice rows into the shape the client expects
// ---------------------------------------------------------------------------
function normalizeInvoices(invoiceRows: any[], itemsByInvoice: Map<string, any[]>) {
  return invoiceRows.map((row: any) => {
    const pat = row.patients as { first_name?: string; last_name?: string } | null;
    const patientName =
      [pat?.first_name, pat?.last_name].filter(Boolean).join(" ") || "Unknown patient";

    const amount = Number(row.total_amount) || 0;
    const isPaid = row.status === "PAID" || row.status === "OVERPAID";

    const ownerLabel =
      row.provider_name || row.doctor_name || row.created_by_name || "Unassigned";
    const ownerKey = row.provider_id || row.doctor_user_id || ownerLabel;

    const doctorKey = row.doctor_user_id || row.doctor_name || "unknown";
    const doctorLabel =
      row.doctor_name || (doctorKey === "unknown" ? "Unassigned" : doctorKey);

    const statusLabel = row.is_complimentary
      ? "Complimentary"
      : isPaid
      ? "Paid"
      : row.status === "PARTIAL_PAID"
      ? "Partial"
      : row.status === "CANCELLED"
      ? "Cancelled"
      : "Unpaid";

    const items = itemsByInvoice.get(row.id as string) ?? [];
    const serviceNames = [
      ...new Set(
        items.map((i: any) => i.name as string | null).filter(Boolean) as string[],
      ),
    ];
    const itemTypes = [...new Set(items.map(classifyItemType))];

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
      itemTypes,
    };
  });
}

// ---------------------------------------------------------------------------
// Build and cache the full payload
// ---------------------------------------------------------------------------
async function buildPayload(): Promise<string> {
  const now = Date.now();
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) return cachedPayload;

  const INVOICE_PAGE = 1000;
  const LINE_PAGE    = 2000;

  // ---- 1. Count both tables in parallel (2 cheap HEAD requests) ----
  const [invoiceCount, lineCount] = await Promise.all([
    countRows("invoices", (q) =>
      q.eq("is_archived", false).is("parent_invoice_id", null),
    ),
    countRows("invoice_line_items"),
  ]);

  // ---- 2. Fetch all pages in parallel ----
  const invoiceFields = `id, invoice_number, invoice_date, patient_id,
    doctor_user_id, doctor_name, provider_id, provider_name, payment_method,
    total_amount, paid_amount, status, is_complimentary, created_by_name,
    is_archived, patients!invoices_patient_id_fkey(first_name, last_name)`;

  // Only fetch columns needed for classification — no catalog_nature, tariff_code
  const lineFields = `invoice_id, name, service_id, quantity, total_price,
    tardoc_code, code`;

  const [invoiceRows, lineItemRows] = await Promise.all([
    fetchAllParallel<any>(
      "invoices", invoiceFields, INVOICE_PAGE, invoiceCount,
      (q) => q.eq("is_archived", false).is("parent_invoice_id", null)
               .order("invoice_date", { ascending: false }),
    ),
    fetchAllParallel<any>("invoice_line_items", lineFields, LINE_PAGE, lineCount),
  ]);

  // ---- 3. Index line items ----
  const itemsByInvoice = new Map<string, any[]>();
  for (const item of lineItemRows) {
    const id = item.invoice_id as string;
    if (!itemsByInvoice.has(id)) itemsByInvoice.set(id, []);
    itemsByInvoice.get(id)!.push(item);
  }

  const invoiceStatusById = new Map<string, string>();
  for (const row of invoiceRows) {
    invoiceStatusById.set(row.id as string, row.status as string);
  }

  // ---- 4. Normalize ----
  const normalized = normalizeInvoices(invoiceRows, itemsByInvoice);

  // ---- 5. Pre-aggregate service summary ----
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
      entry = { serviceName: key, invoiceCount: 0, quantity: 0,
                totalRevenue: 0, paidRevenue: 0, invoiceIds: new Set() };
    }
    if (!entry.invoiceIds.has(invId)) {
      entry.invoiceIds.add(invId);
      entry.invoiceCount += 1;
    }
    entry.quantity += Number(item.quantity) || 1;
    const lineTotal = Number(item.total_price) || 0;
    entry.totalRevenue += lineTotal;
    if (["PAID", "OVERPAID"].includes(invoiceStatusById.get(invId) ?? "")) {
      entry.paidRevenue += lineTotal;
    }
    serviceMap.set(key, entry);
  }
  const serviceSummary = Array.from(serviceMap.values())
    .map(({ invoiceIds: _, ...rest }) => rest)
    .sort((a, b) => b.invoiceCount - a.invoiceCount);

  // ---- 6. Lite line items for client-side breakdown ----
  const lineItemsLite = lineItemRows.map((item: any) => ({
    invoice_id: item.invoice_id as string,
    name: (item.name ?? null) as string | null,
    service_id: (item.service_id ?? null) as string | null,
    quantity: Number(item.quantity) || 1,
    total_price: Number(item.total_price) || 0,
    item_type: classifyItemType(item),
  }));

  const payload = JSON.stringify({
    invoices: normalized,
    serviceSummary,
    lineItems: lineItemsLite,
    counts: { invoices: normalized.length, lineItems: lineItemRows.length },
  });

  cachedAt = Date.now();
  cachedPayload = payload;
  return payload;
}

// ---------------------------------------------------------------------------
// GET /api/financials/summary
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const payload = await buildPayload();
    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Browser & CDN cache for 30 s; stale-while-revalidate for 30 s more
        "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
      },
    });
  } catch (err: any) {
    console.error("financials/summary error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
