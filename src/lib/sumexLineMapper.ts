// ============================================================================
// Single source of truth for mapping `invoice_line_items` rows to Sumex1
// service inputs (`InvoiceServiceInput`).
//
// Used by:
//   - /api/medidata/send-invoice  (insurance XML + PDF)
//   - /api/invoices/generate-pdf  (patient invoice / receipt PDF)
//   - /api/sumex/check-xml        (pre-send validation preview)
//
// Before this module existed each route had its own slightly different
// mapping, which caused the insurance invoice to diverge from the patient
// invoice (missing body side, re-priced charge-free lines, drifting totals).
//
// Key rules (from the Sumex CHM docs — tardocValidator100, acfValidator100,
// generalInvoiceRequestManager500):
//   - `side` is forwarded for ALL tariffs. TARDOC codes flagged "par côté"
//     are refused by insurers without it.
//   - A deliberately charge-free line (stored total_price === 0) is expressed
//     with external scaling factor 0. Unlike unit/amount fields, external
//     factors are NOT auto-expanded by the Sumex validator, so the line can
//     never be silently re-priced from the catalog.
//   - Tax point components (tp_al/tp_tl) stored as 0 are authoritative and
//     must not be resurrected from a catalog.
//   - The CHF amount Sumex prints for TARDOC is
//       round(qty × tp_al × tp_al_value × extMT) + round(qty × tp_tl × tp_tl_value × extTT)
//     `computeExpectedLineAmount` mirrors that formula so callers can
//     reconcile against the stored patient-file totals before generating.
// ============================================================================

import { deriveTariffType } from "./tariffType";
import { resolveTardocTaxPoints, type TardocTaxPointCatalog } from "./tardocTaxPoints";
import { YesNo, SideType, type InvoiceServiceInput } from "./sumexInvoice";

/** Shape of an `invoice_line_items` row (subset used for Sumex mapping). */
export type SumexLineItemRow = {
  code?: string | null;
  name?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  tariff_code?: number | string | null;
  tariff_type?: string | null;
  catalog_name?: string | null;
  external_factor_mt?: number | null;
  external_factor_tt?: number | null;
  side_type?: number | null;
  session_number?: number | null;
  ref_code?: string | null;
  date_begin?: string | null;
  provider_gln?: string | null;
  responsible_gln?: string | null;
  tp_al?: number | null;
  tp_tl?: number | null;
  tp_al_value?: number | null;
  tp_tl_value?: number | null;
};

export type SumexLineMapperContext = {
  /** Billing-entity GLN used when the line has no valid 13-digit GLN. */
  fallbackProviderGln: string;
  /** Treatment/invoice date used when the line has no date_begin. */
  fallbackTreatmentDate: string;
  /** Force eIgnoreValidate=Yes for every line (e.g. PDF regeneration). */
  skipValidation?: boolean;
  /**
   * Optional TARDOC catalog tax points, keyed by code. Only consulted when a
   * component was never stored (null) — a stored 0 is preserved.
   */
  tardocCatalog?: Record<string, TardocTaxPointCatalog>;
};

const isValidGln = (g: string | null | undefined): g is string =>
  g != null && /^\d{13}$/.test(g);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The CHF amount Sumex will print for this line, mirroring
 * `buildInvoiceRequest`'s AddService/AddServiceEx computations.
 */
export function computeExpectedLineAmount(
  item: SumexLineItemRow,
  ctx?: Pick<SumexLineMapperContext, "tardocCatalog">,
): number {
  const svc = mapLineItemToSumexService(item, {
    fallbackProviderGln: "0000000000000",
    fallbackTreatmentDate: "1970-01-01",
    skipValidation: true,
    tardocCatalog: ctx?.tardocCatalog,
  });
  const tariffType = svc.tariffType;
  const qty = svc.quantity;
  if (tariffType === "007") {
    const amountMT = round2(qty * (svc.unit ?? 0) * (svc.unitFactor ?? 1) * (svc.externalFactor ?? 1));
    const amountTT = round2(qty * (svc.unitTT ?? 0) * (svc.unitFactorTT ?? 1) * (svc.externalFactorTT ?? 1));
    return round2(amountMT + amountTT);
  }
  // TARMED (001, legacy) and simple tariffs (005, 402, 406, 590, TMA, ...):
  // the stored CHF amount is authoritative and passed through as-is.
  return round2(svc.amount ?? 0);
}

/** Map one `invoice_line_items` row to a Sumex service input. */
export function mapLineItemToSumexService(
  item: SumexLineItemRow,
  ctx: SumexLineMapperContext,
): InvoiceServiceInput {
  const tariffType = deriveTariffType(item);
  const isTardoc = tariffType === "007";
  const isTarmed = tariffType === "001";
  const isAcf = tariffType === "005";
  const isTma = tariffType === "TMA";

  const svcGln = isValidGln(item.provider_gln) ? item.provider_gln : ctx.fallbackProviderGln;
  const svcRespGln = isValidGln(item.responsible_gln) ? item.responsible_gln : svcGln;

  const quantity = item.quantity || 1;
  const storedTotal = Number(item.total_price) || 0;
  // A stored zero total is a deliberate charge-free line (e.g. TARDOC codes
  // accompanying a surgery flat rate, TMA gesture codes).
  const chargeFree = isTma || storedTotal === 0;

  // Tax points — a stored 0 is preserved; catalog only fills true nulls.
  const catalog = isTardoc && item.code ? ctx.tardocCatalog?.[item.code] : undefined;
  const tp = resolveTardocTaxPoints(
    {
      tpAl: item.tp_al,
      tpTl: item.tp_tl,
      tpAlValue: item.tp_al_value,
      tpTlValue: item.tp_tl_value,
    },
    catalog,
  );

  let unit: number;
  let unitFactor: number;
  let unitTT: number | undefined;
  let unitFactorTT: number | undefined;
  let amount: number;

  if (isTarmed) {
    // TARMED (001, legacy invoices): tp_al holds tax points but total_price
    // holds the authoritative CHF amount — never recompute from tax points
    // (legacy rows lack the tax point value, so tp_al×qty would be wrong).
    unit = item.unit_price || (quantity ? round2(storedTotal / quantity) : 0);
    unitFactor = 1;
    unitTT = undefined;
    unitFactorTT = undefined;
    amount = storedTotal;
  } else if (isTardoc) {
    unit = tp.tpAl;
    unitFactor = tp.tpAlValue;
    unitTT = tp.tpTl;
    unitFactorTT = tp.tpTlValue;
    amount = storedTotal;
  } else if (isAcf) {
    // ACF 005: single (MT) component priced from tax points when available.
    unit = item.tp_al && item.tp_al > 0 ? item.tp_al : (item.unit_price || 0);
    unitFactor = item.tp_al_value && item.tp_al_value > 0 ? item.tp_al_value : 1;
    unitTT = undefined;
    unitFactorTT = undefined;
    amount = storedTotal;
  } else {
    // Other tariffs (402 drugs, 406 material, 590 custom, TMA, ...): CHF.
    unit = item.unit_price || 0;
    unitFactor = 1;
    unitTT = undefined;
    unitFactorTT = undefined;
    amount = storedTotal;
  }

  // Charge-free lines: external factor 0 forces amount 0 in Sumex and is
  // immune to validator auto-expansion (per CHM: "can even take a zero value
  // to supply a charge free service").
  const externalFactor = chargeFree ? 0 : (item.external_factor_mt ?? 1);
  const externalFactorTT = chargeFree ? 0 : (item.external_factor_tt ?? 1);

  return {
    tariffType,
    code: item.code || "",
    referenceCode: item.ref_code || "",
    quantity,
    sessionNumber: item.session_number ?? 1,
    dateBegin: item.date_begin || ctx.fallbackTreatmentDate,
    providerGln: svcGln,
    responsibleGln: svcRespGln,
    // Body side is forwarded for ALL tariffs (insurers refuse side-dependent
    // TARDOC codes without it). 0=none, 1=left, 2=right, 3=both.
    side: (item.side_type ?? 0) as SideType,
    serviceName: item.name || "",
    unit,
    unitFactor,
    unitTT,
    unitFactorTT,
    externalFactor,
    externalFactorTT,
    amount: chargeFree ? 0 : amount,
    vatRate: 0,
    // ACF 005 lines are already grouped/validated by the standalone
    // acfValidator; the invoice manager's internal grouper would require a
    // TMA session setup we don't use. TMA gesture lines are charge-free
    // reference lines and are likewise not re-validated.
    ignoreValidate: (isAcf || isTma || ctx.skipValidation) ? YesNo.Yes : YesNo.No,
  };
}

export type LineReconciliationMismatch = {
  code: string;
  name: string;
  storedTotal: number;
  expectedTotal: number;
  difference: number;
};

export type InvoiceReconciliationResult = {
  ok: boolean;
  expectedInvoiceTotal: number;
  storedInvoiceTotal: number;
  totalDifference: number;
  lineMismatches: LineReconciliationMismatch[];
};

const LINE_TOLERANCE = 0.05;
const TOTAL_TOLERANCE = 0.05;

/**
 * Verify that what Sumex will print matches the stored patient-file amounts.
 * Callers must refuse to send/print when `ok` is false — this is the guard
 * that keeps the insurance invoice identical to the patient invoice.
 */
export function reconcileInvoiceLines(
  items: SumexLineItemRow[],
  storedInvoiceTotal: number,
  ctx?: Pick<SumexLineMapperContext, "tardocCatalog">,
): InvoiceReconciliationResult {
  const lineMismatches: LineReconciliationMismatch[] = [];
  let expectedInvoiceTotal = 0;

  for (const item of items) {
    const expected = computeExpectedLineAmount(item, ctx);
    const stored = round2(Number(item.total_price) || 0);
    expectedInvoiceTotal = round2(expectedInvoiceTotal + expected);
    if (Math.abs(expected - stored) > LINE_TOLERANCE) {
      lineMismatches.push({
        code: item.code || "",
        name: item.name || "",
        storedTotal: stored,
        expectedTotal: expected,
        difference: round2(expected - stored),
      });
    }
  }

  const storedTotal = round2(Number(storedInvoiceTotal) || 0);
  const totalDifference = round2(expectedInvoiceTotal - storedTotal);

  return {
    ok: lineMismatches.length === 0 && Math.abs(totalDifference) <= TOTAL_TOLERANCE,
    expectedInvoiceTotal,
    storedInvoiceTotal: storedTotal,
    totalDifference,
    lineMismatches,
  };
}
