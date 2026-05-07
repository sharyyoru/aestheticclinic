/**
 * Fill missing TARDOC ref_codes on past invoice_line_items rows using the
 * live tardocValidatorServer100 catalog.
 *
 * Algorithm (verbatim from tardocvalidator100.chm):
 *
 *   1. ISearch::SearchCode → exact record. If `MasterCode` non-empty, that
 *      IS the ref_code. Per chm:ISearch::MasterCode — "The parent code of
 *      the service code, if the service code is a slave. Otherwise empty."
 *
 *   2. Otherwise walk the same invoice's prior TARDOC lines (by sort_order)
 *      most-recent-first. For each prior code, ISearch::SearchAdditionalService.
 *      If our code appears in the result list → ref_code =
 *      AdditionalServiceReferenceCode of that result row.
 *
 *   3. Otherwise leave NULL (standalone main service).
 *
 * The script is dry-run by default. Add --apply to write changes.
 *
 * Only updates rows where ref_code IS NULL or '' (never overwrites an
 * existing user-set value).
 *
 * Usage:
 *   npx tsx scripts/fill-missing-tardoc-refcodes.ts            # dry run, all invoices
 *   npx tsx scripts/fill-missing-tardoc-refcodes.ts --apply    # apply
 *   npx tsx scripts/fill-missing-tardoc-refcodes.ts --invoice=1002883            # one invoice (number)
 *   npx tsx scripts/fill-missing-tardoc-refcodes.ts --invoice=1002883 --apply
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env (mirrors fix-invalid-tardoc-refcodes.ts)
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const argv = process.argv.slice(2);
const applyMode = argv.includes("--apply");
const invoiceArg = argv.find((a) => a.startsWith("--invoice="));
const onlyInvoiceNumber = invoiceArg ? invoiceArg.split("=")[1] : null;

const SUMEX_BASE_URL =
  process.env.SUMEX_TARDOC_URL ||
  "http://34.100.230.253:8080/tardocValidatorServer100";

// ---------------------------------------------------------------------------
// Sumex low-level helpers (mirrors src/lib/sumexTardoc.ts)
// ---------------------------------------------------------------------------
async function getProperty<T>(iface: string, prop: string, handle: number): Promise<T> {
  const url = `${SUMEX_BASE_URL}/${iface}/Get${prop}?p${iface}=${handle}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${iface}/Get${prop} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
async function callMethod<T>(iface: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = `${SUMEX_BASE_URL}/${iface}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`POST ${iface}/${method} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return parsed as T;
}

let cachedValidatorHandle: number | null = null;
async function getValidator(): Promise<number> {
  if (cachedValidatorHandle) return cachedValidatorHandle;
  const factoryRes = await fetch(`${SUMEX_BASE_URL}/ITardocValidator/GetCreateTardocValidator`, { cache: "no-store" });
  if (!factoryRes.ok) throw new Error("Failed to create TardocValidator");
  const factoryData = (await factoryRes.json()) as { pITardocValidator: number };
  const handle = factoryData.pITardocValidator;
  const openRes = await callMethod<{ pbStatus: boolean }>("ITardocValidator", "Open", {
    pITardocValidator: handle,
    eLanguage: 2,
  });
  if (!openRes.pbStatus) throw new Error("Failed to open TardocValidator");
  cachedValidatorHandle = handle;
  return handle;
}

async function createSearch(): Promise<number> {
  const validator = await getValidator();
  const data = await getProperty<Record<string, number>>("ITardocValidator", "CreateSearch", validator);
  if (!("pISearch" in data)) throw new Error("Missing pISearch in CreateSearch response");
  return data.pISearch;
}

type ServiceRow = {
  code: string;
  name: string;
  masterCode: string;
  additionalServiceReferenceCode: string;
};

function mapRow(raw: Record<string, unknown>): ServiceRow {
  return {
    code: (raw.pbstrCode as string) ?? "",
    name: (raw.pbstrName255 as string) ?? "",
    masterCode: (raw.pbstrMasterCode as string) ?? "",
    additionalServiceReferenceCode: (raw.pbstrAdditionalServiceReferenceCode as string) ?? "",
  };
}

async function searchByCodeRows(code: string): Promise<ServiceRow[]> {
  const sh = await createSearch();
  await callMethod("ISearch", "SearchCode", { pISearch: sh, bstrCode: code, eOnlyMainServices: 0 });
  const cnt = await callMethod<{ pbStatus: boolean; plSize: number }>("ISearch", "GetRecordCount", { pISearch: sh });
  const n = cnt.plSize ?? 0;
  if (n === 0) return [];
  const raw = await callMethod<Array<Record<string, unknown>>>("ISearch", "GetServices", {
    pISearch: sh, lStartRecordID: 0, lNumberOfRecords: Math.min(n, 100),
  });
  return Array.isArray(raw) ? raw.filter((r) => r.pbStatus).map(mapRow) : [];
}

async function searchAdditionalRows(baseCode: string): Promise<ServiceRow[]> {
  const sh = await createSearch();
  await callMethod("ISearch", "SearchAdditionalService", { pISearch: sh, bstrCode: baseCode });
  const cnt = await callMethod<{ pbStatus: boolean; plSize: number }>("ISearch", "GetRecordCount", { pISearch: sh });
  const n = cnt.plSize ?? 0;
  if (n === 0) return [];
  const raw = await callMethod<Array<Record<string, unknown>>>("ISearch", "GetServices", {
    pISearch: sh, lStartRecordID: 0, lNumberOfRecords: Math.min(n, 500),
  });
  return Array.isArray(raw) ? raw.filter((r) => r.pbStatus).map(mapRow) : [];
}

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------
const exactCache = new Map<string, ServiceRow | null>();
async function lookupExact(code: string): Promise<ServiceRow | null> {
  if (exactCache.has(code)) return exactCache.get(code) ?? null;
  try {
    const rows = await searchByCodeRows(code);
    const exact = rows.find((r) => r.code === code) ?? null;
    exactCache.set(code, exact);
    return exact;
  } catch (err) {
    console.error(`  catalog lookup failed for ${code}:`, err);
    exactCache.set(code, null);
    return null;
  }
}

const additionalsCache = new Map<string, Map<string, string>>();
async function getAdditionals(baseCode: string): Promise<Map<string, string>> {
  const c = additionalsCache.get(baseCode);
  if (c) return c;
  const m = new Map<string, string>();
  try {
    const rows = await searchAdditionalRows(baseCode);
    for (const r of rows) m.set(r.code, r.additionalServiceReferenceCode || baseCode);
  } catch (err) {
    console.error(`  SearchAdditionalService failed for ${baseCode}:`, err);
  }
  additionalsCache.set(baseCode, m);
  return m;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
type Line = {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  sort_order: number;
  code: string;
  ref_code: string | null;
};

async function main() {
  console.log(
    `\n=== Fill missing TARDOC ref_codes (${applyMode ? "APPLY" : "DRY RUN"}${onlyInvoiceNumber ? `, invoice=${onlyInvoiceNumber}` : ""}) ===\n`,
  );
  console.log(`Sumex URL: ${SUMEX_BASE_URL}`);

  // 1. Pull TARDOC lines, optionally filtered to one invoice.
  let invoiceFilterIds: string[] | null = null;
  if (onlyInvoiceNumber) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("invoice_number", onlyInvoiceNumber)
      .limit(1);
    if (!inv || inv.length === 0) {
      console.error(`Invoice ${onlyInvoiceNumber} not found.`);
      return;
    }
    invoiceFilterIds = inv.map((r) => r.id);
  }

  let q = supabase
    .from("invoice_line_items")
    .select("id, invoice_id, sort_order, code, tardoc_code, ref_code, tariff_code, invoices!inner(invoice_number)")
    .eq("tariff_code", 7)
    .order("invoice_id")
    .order("sort_order", { ascending: true });
  if (invoiceFilterIds) q = q.in("invoice_id", invoiceFilterIds);

  const { data: rows, error } = await q;
  if (error) {
    console.error("Fetch failed:", error);
    return;
  }
  const allLines: Line[] = (rows || []).map((r: any) => ({
    id: r.id,
    invoice_id: r.invoice_id,
    invoice_number: r.invoices?.invoice_number ?? null,
    sort_order: r.sort_order ?? 0,
    code: (r.code || r.tardoc_code || "").trim(),
    ref_code: r.ref_code ?? null,
  })).filter((l) => l.code);

  // Group by invoice (preserving sort order).
  const byInvoice = new Map<string, Line[]>();
  for (const l of allLines) {
    const arr = byInvoice.get(l.invoice_id) ?? [];
    arr.push(l);
    byInvoice.set(l.invoice_id, arr);
  }
  for (const arr of byInvoice.values()) arr.sort((a, b) => a.sort_order - b.sort_order);

  console.log(
    `Invoices to process: ${byInvoice.size}, total TARDOC lines: ${allLines.length}\n`,
  );

  type Update = {
    line: Line;
    suggestedRef: string;
    source: "masterCode" | "additionalService";
    baseCode?: string;
  };
  const updates: Update[] = [];
  let standaloneCount = 0;
  let unknownCount = 0;
  let alreadySetCount = 0;

  // 2. For each invoice, in sort_order, decide what to fill.
  for (const [invoiceId, lines] of byInvoice) {
    const invNum = lines[0].invoice_number ?? invoiceId;
    process.stdout.write(`Invoice ${invNum} (${lines.length} TARDOC lines):\n`);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];

      if (l.ref_code && l.ref_code.trim() !== "") {
        alreadySetCount++;
        process.stdout.write(`  [${i + 1}] ${l.code}  ref=${l.ref_code} (kept)\n`);
        continue;
      }

      const exact = await lookupExact(l.code);
      if (!exact) {
        unknownCount++;
        process.stdout.write(`  [${i + 1}] ${l.code}  UNKNOWN (catalog lookup failed)\n`);
        continue;
      }

      // Step 1: MasterCode
      if (exact.masterCode && exact.masterCode.trim() !== "") {
        updates.push({ line: l, suggestedRef: exact.masterCode, source: "masterCode" });
        process.stdout.write(`  [${i + 1}] ${l.code}  → ${exact.masterCode}  [master]\n`);
        continue;
      }

      // Step 2: SearchAdditionalService over priors (most recent first)
      let matched: { ref: string; base: string } | null = null;
      for (let j = i - 1; j >= 0 && !matched; j--) {
        const prior = lines[j].code;
        if (!prior || prior === l.code) continue;
        const map = await getAdditionals(prior);
        if (map.has(l.code)) matched = { ref: map.get(l.code) || prior, base: prior };
      }
      if (matched) {
        updates.push({
          line: l, suggestedRef: matched.ref,
          source: "additionalService", baseCode: matched.base,
        });
        process.stdout.write(`  [${i + 1}] ${l.code}  → ${matched.ref}  [add-on of ${matched.base}]\n`);
        continue;
      }

      // Step 3: standalone
      standaloneCount++;
      process.stdout.write(`  [${i + 1}] ${l.code}  (standalone — no ref)\n`);
    }
  }

  // 3. Summary
  console.log(`\n=== Summary ===`);
  console.log(`  Already set (kept):     ${alreadySetCount}`);
  console.log(`  Will fill (master):     ${updates.filter((u) => u.source === "masterCode").length}`);
  console.log(`  Will fill (add-on):     ${updates.filter((u) => u.source === "additionalService").length}`);
  console.log(`  Standalone (no change): ${standaloneCount}`);
  console.log(`  Unknown / lookup fail:  ${unknownCount}`);

  if (!applyMode) {
    console.log(`\nDry run. Re-run with --apply to write ${updates.length} ref_code values.`);
    return;
  }

  // 4. Apply
  console.log(`\n=== Applying ${updates.length} updates ===`);
  let ok = 0, fail = 0;
  for (const u of updates) {
    const { error: updErr } = await supabase
      .from("invoice_line_items")
      .update({ ref_code: u.suggestedRef })
      .eq("id", u.line.id);
    if (updErr) {
      fail++;
      console.error(`  ✗ ${u.line.invoice_number}/${u.line.code}: ${updErr.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
