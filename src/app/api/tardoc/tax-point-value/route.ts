import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, authErrorResponse } from "@/lib/serverAuth";
import { resolveTariffPointValue, type TariffPointValueRow } from "@/lib/tariffPointValues";
import { CANTON_TAX_POINT_VALUES, type SwissCanton } from "@/lib/tardoc";

export const runtime = "nodejs";

/**
 * GET /api/tardoc/tax-point-value
 *   ?canton=GE&insurerGln=...&insurerGroup=...&lawType=KVG&tariffType=007&on=2026-11-06
 *
 * Resolves the tariff point value (Taxpunktwert / valeur du point tarifaire)
 * for an invoice line. Replaces the canton-only hardcoded constant that forced
 * billing staff to retype the value by hand for every insurer on a different
 * negotiated rate (and caused insurer rejections 59109 / eK6.T001).
 *
 * Falls back to the legacy canton constant when no row matches, so pricing is
 * unchanged until real contract rates are entered.
 *
 * Staff-only: this is internal billing configuration.
 */
export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { searchParams } = new URL(request.url);
  const canton = (searchParams.get("canton") || "").toUpperCase();
  if (!canton) {
    return NextResponse.json({ error: "canton is required" }, { status: 400 });
  }

  const tariffType = searchParams.get("tariffType") || "007";
  const insurerGln = searchParams.get("insurerGln");
  const insurerGroup = searchParams.get("insurerGroup");
  const lawType = searchParams.get("lawType");
  const on = searchParams.get("on") || undefined;
  const fallback = CANTON_TAX_POINT_VALUES[canton as SwissCanton] ?? 0.96;

  try {
    const { data, error } = await supabaseAdmin
      .from("tariff_point_values")
      .select("insurer_gln, insurer_group, canton, law_type, tariff_type, value, valid_from, valid_to")
      .eq("canton", canton)
      .eq("tariff_type", tariffType);

    if (error) {
      // Never fail an invoice over a config lookup — and never fail because
      // the migration has not been applied yet (Vercel deploys before
      // migrations run). Fall back to the constant and flag it.
      console.error("[tax-point-value] lookup failed:", error.message);
      return NextResponse.json({ value: fallback, source: "fallback", degraded: true });
    }

    const resolution = resolveTariffPointValue(
      (data ?? []) as TariffPointValueRow[],
      { canton, tariffType, insurerGln, insurerGroup, lawType, on },
      fallback,
    );

    return NextResponse.json({
      value: resolution.value,
      source: resolution.source,
      matched: resolution.matched,
    });
  } catch (err) {
    console.error("[tax-point-value] error:", err);
    return NextResponse.json({ value: fallback, source: "fallback", degraded: true });
  }
}
