export type TardocTaxPointInput = {
  tpAl?: number | null;
  tpTl?: number | null;
  tpAlValue?: number | null;
  tpTlValue?: number | null;
};

export type TardocTaxPointCatalog = {
  tpMt?: number | null;
  tpTt?: number | null;
};

export type TardocTaxPointResult = {
  tpAl: number;
  tpTl: number;
  tpAlValue: number;
  tpTlValue: number;
};

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveComponent(value: number | null | undefined, fallback: number | null | undefined): number {
  const direct = finiteNumber(value);
  const catalog = finiteNumber(fallback);
  // A zero stored in older line items can mean the catalog value was not
  // copied yet. Use the catalog when available, but preserve a genuine zero
  // when no catalog fallback exists.
  if (direct !== null && direct !== 0) return direct;
  if (catalog !== null && catalog !== 0) return catalog;
  return direct ?? catalog ?? 0;
}

function resolveValue(value: number | null | undefined): number {
  const resolved = finiteNumber(value);
  return resolved !== null && resolved > 0 ? resolved : 1;
}

export function resolveTardocTaxPoints(
  input: TardocTaxPointInput = {},
  catalog?: TardocTaxPointCatalog,
): TardocTaxPointResult {
  return {
    tpAl: resolveComponent(input.tpAl, catalog?.tpMt),
    tpTl: resolveComponent(input.tpTl, catalog?.tpTt),
    tpAlValue: resolveValue(input.tpAlValue),
    tpTlValue: resolveValue(input.tpTlValue),
  };
}
