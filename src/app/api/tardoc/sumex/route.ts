import { NextRequest, NextResponse } from "next/server";
import {
  getChapters,
  getSections,
  getServiceGroups,
  searchByCode,
  searchByChapter,
  searchByServiceGroup,
  getSessionInfo,
  invalidateSession,
  calculatePrice,
  type SumexLanguage,
  type TardocServiceRecord,
} from "@/lib/sumexTardoc";
import { CANTON_TAX_POINT_VALUES, DEFAULT_CANTON, TARDOC_TARIFF_ITEMS, type SwissCanton } from "@/lib/tardoc";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/tardoc/sumex
 *
 * Live TARDOC catalog from Sumex1 Validator API.
 *
 * Query params:
 *   action:     "chapters" | "sections" | "serviceGroups" | "searchCode" | "searchChapter" | "searchServiceGroup" | "info" | "refresh"
 *   code:       TARDOC code for searchCode (e.g. "AA.00")
 *   chapter:    Chapter code for searchChapter (e.g. "TA.10")
 *   group:      Service group code for searchServiceGroup
 *   mainOnly:   "1" to return only main services (default "0")
 *   lang:       "1"=DE, "2"=FR (default), "3"=IT
 *   canton:     Swiss canton code for price calc (default "GE")
 *   parent:     Parent code for chapters (default "" = root)
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const action = sp.get("action") || "chapters";
    const lang = (Number(sp.get("lang")) || 2) as SumexLanguage;
    const canton = (sp.get("canton") || DEFAULT_CANTON) as SwissCanton;
    const taxPointValue = CANTON_TAX_POINT_VALUES[canton] ?? CANTON_TAX_POINT_VALUES[DEFAULT_CANTON];

    switch (action) {
      // ----------------------------------------------------------------
      // Catalog: browse chapters
      // ----------------------------------------------------------------
      case "chapters": {
        const parent = sp.get("parent") || "";
        const chapters = await getChapters(parent, lang);
        return NextResponse.json({ success: true, data: chapters });
      }

      // ----------------------------------------------------------------
      // Catalog: sections
      // ----------------------------------------------------------------
      case "sections": {
        const sections = await getSections(lang);
        return NextResponse.json({ success: true, data: sections });
      }

      // ----------------------------------------------------------------
      // Catalog: service groups
      // ----------------------------------------------------------------
      case "serviceGroups": {
        const groups = await getServiceGroups(lang);
        return NextResponse.json({ success: true, data: groups });
      }

      // ----------------------------------------------------------------
      // Search by code (e.g. "AA.00" returns all services matching that code prefix)
      // ----------------------------------------------------------------
      case "searchCode": {
        const code = sp.get("code");
        if (!code) {
          return NextResponse.json(
            { success: false, error: "code parameter is required" },
            { status: 400 },
          );
        }
        const mainOnly = sp.get("mainOnly") === "1";
        const result = await searchByCode(code, mainOnly, lang);
        const enriched = enrichServices(result.services, taxPointValue);
        return NextResponse.json({
          success: true,
          data: enriched,
          meta: { count: result.count, canton, taxPointValue },
        });
      }

      // ----------------------------------------------------------------
      // Search by chapter
      // ----------------------------------------------------------------
      case "searchChapter": {
        const chapter = sp.get("chapter");
        if (!chapter) {
          return NextResponse.json(
            { success: false, error: "chapter parameter is required" },
            { status: 400 },
          );
        }
        const mainOnly = sp.get("mainOnly") === "1";
        const result = await searchByChapter(chapter, mainOnly, lang);
        const enriched = enrichServices(result.services, taxPointValue);
        return NextResponse.json({
          success: true,
          data: enriched,
          meta: { count: result.count, canton, taxPointValue },
        });
      }

      // ----------------------------------------------------------------
      // Search by service group
      // ----------------------------------------------------------------
      case "searchServiceGroup": {
        const group = sp.get("group");
        if (!group) {
          return NextResponse.json(
            { success: false, error: "group parameter is required" },
            { status: 400 },
          );
        }
        const mainOnly = sp.get("mainOnly") === "1";
        const result = await searchByServiceGroup(group, mainOnly, lang);
        const enriched = enrichServices(result.services, taxPointValue);
        return NextResponse.json({
          success: true,
          data: enriched,
          meta: { count: result.count, canton, taxPointValue },
        });
      }

      // ----------------------------------------------------------------
      // Session info (DB version, etc.)
      // ----------------------------------------------------------------
      case "info": {
        const info = await getSessionInfo(lang);
        return NextResponse.json({ success: true, data: info });
      }

      // ----------------------------------------------------------------
      // Force refresh session
      // ----------------------------------------------------------------
      case "refresh": {
        invalidateSession();
        const info = await getSessionInfo(lang);
        return NextResponse.json({ success: true, data: info, message: "Session refreshed" });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "SUMEX_SERVER_OFFLINE") {
      // Server offline — fall back to the local catalogue (bundled TARDOC
      // items + clinic's saved tardoc_group_items) so the code browser and
      // search keep working. Coverage is partial but usable.
      try {
        const sp = request.nextUrl.searchParams;
        const action = sp.get("action") || "chapters";
        const lang = (Number(sp.get("lang")) || 2) as SumexLanguage;
        const canton = (sp.get("canton") || DEFAULT_CANTON) as SwissCanton;
        const taxPointValue = CANTON_TAX_POINT_VALUES[canton] ?? CANTON_TAX_POINT_VALUES[DEFAULT_CANTON];
        return await localTardocFallback(action, sp, lang, canton, taxPointValue);
      } catch (fbErr) {
        console.error("[tardoc/sumex] local fallback failed:", fbErr);
        return NextResponse.json(
          {
            success: false,
            error: "TarDoc service temporarily unavailable",
            offline: true,
            details: "The billing server is offline. TarDoc code lookup will resume when the service returns. You can still add services manually.",
          },
          { status: 503 },
        );
      }
    }
    console.error("Error in /api/tardoc/sumex:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// --------------------------------------------------------------------------
// Local fallback catalogue (used when the Sumex1 validator is offline)
// --------------------------------------------------------------------------

const DEFAULT_SERVICE_FIELDS = {
  serviceType: "", unit: "", unitCode: "", unitQuantity: 1,
  internalFactorMT: 1, internalFactorTT: 1, serviceMin: 0, placeMin: 0,
  changeMin: 0, findingsMin: 0, anaesthesiaMin: 0, prePostServiceMin: 0,
  mechanicCode: "", kvgObligationCode: "", masterCode: "",
  additionalServiceReferenceCode: "", anaesthesiaInterventionClass: "",
  treatmentType: "", medicalInfo: "", technicalInfo: "",
  validFrom: "", validTo: "", sexRequired: 0, sideRequired: 0,
};

/** Merge the bundled TARDOC items with the clinic's saved group items. */
async function getLocalTardocServices(lang: SumexLanguage): Promise<TardocServiceRecord[]> {
  const seen = new Set<string>();
  const services: TardocServiceRecord[] = [];

  for (const item of TARDOC_TARIFF_ITEMS.filter((i) => i.isActive)) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    services.push({
      ...DEFAULT_SERVICE_FIELDS,
      recordId: services.length + 1,
      code: item.code,
      name:
        lang === 1
          ? item.descriptionDe || item.descriptionFr || item.description
          : item.descriptionFr || item.description,
      chapter: item.chapter,
      section: item.subchapter,
      tpMT: item.medicalTaxPoints,
      tpTT: item.technicalTaxPoints,
    });
  }

  // Clinic-saved group items (tardoc_group_items) — the codes the clinic
  // actually uses, including ones not in the bundled list.
  const { data: groupItems } = await supabaseAdmin
    .from("tardoc_group_items")
    .select("tardoc_code, description, tp_mt, tp_tt");
  for (const row of groupItems || []) {
    const code = (row.tardoc_code || "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const parts = code.split(".");
    services.push({
      ...DEFAULT_SERVICE_FIELDS,
      recordId: services.length + 1,
      code,
      name: (row.description || code).trim(),
      chapter: parts[0] || code,
      section: parts.length > 1 ? `${parts[0]}.${parts[1]}` : code,
      tpMT: row.tp_mt ?? 0,
      tpTT: row.tp_tt ?? 0,
    });
  }

  return services;
}

/** Build the flat chapter tree the accordion expects, derived from known codes. */
function chaptersFromServices(services: TardocServiceRecord[]): { code: string; name: string }[] {
  const chapters = new Map<string, string>();
  for (const svc of services) {
    const parts = svc.code.split(".");
    if (parts.length !== 3) continue;
    const [two, grp] = parts;
    const main = two[0];
    if (!main) continue;
    if (!chapters.has(main)) chapters.set(main, `Chapitre ${main}`);
    if (!chapters.has(two)) chapters.set(two, `Section ${two}`);
    const groupCode = `${two}.${grp}`;
    if (!chapters.has(groupCode)) chapters.set(groupCode, `Groupe ${groupCode}`);
  }
  return [...chapters.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

async function localTardocFallback(
  action: string,
  sp: URLSearchParams,
  lang: SumexLanguage,
  canton: SwissCanton,
  taxPointValue: number,
): Promise<NextResponse> {
  const services = await getLocalTardocServices(lang);
  const localMeta = { source: "local", partial: true };

  switch (action) {
    case "chapters":
      return NextResponse.json({ success: true, data: chaptersFromServices(services), meta: localMeta });

    case "sections":
      return NextResponse.json({
        success: true,
        data: [...new Set(services.map((s) => s.chapter).filter(Boolean))]
          .sort()
          .map((c) => ({ code: c, name: `Section ${c}` })),
        meta: localMeta,
      });

    case "serviceGroups":
      return NextResponse.json({
        success: true,
        data: [...new Set(services.map((s) => s.section).filter(Boolean))]
          .sort()
          .map((c) => ({ code: c, name: `Groupe ${c}` })),
        meta: localMeta,
      });

    case "searchCode":
    case "searchChapter":
    case "searchServiceGroup": {
      const prefix = (sp.get("code") || sp.get("chapter") || sp.get("group") || "").trim();
      if (!prefix) {
        return NextResponse.json({ success: false, error: "code parameter is required" }, { status: 400 });
      }
      const matched = services.filter(
        (s) => s.code === prefix || s.code.startsWith(prefix + ".") || s.code.startsWith(prefix),
      );
      return NextResponse.json({
        success: true,
        data: enrichServices(matched, taxPointValue),
        meta: { ...localMeta, count: matched.length, canton, taxPointValue },
      });
    }

    case "info":
    case "refresh":
      return NextResponse.json({
        success: true,
        data: { source: "local", serviceCount: services.length, note: "Local catalogue — Sumex1 validator offline" },
        meta: localMeta,
      });

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}`, offline: true },
        { status: 400 },
      );
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

type EnrichedService = TardocServiceRecord & {
  priceCHF: number;
  priceMT: number;
  priceTT: number;
};

function enrichServices(
  services: TardocServiceRecord[],
  taxPointValue: number,
): EnrichedService[] {
  return services.map((svc) => ({
    ...svc,
    priceCHF: calculatePrice(svc.tpMT, svc.tpTT, taxPointValue),
    priceMT: Math.round(svc.tpMT * taxPointValue * 100) / 100,
    priceTT: Math.round(svc.tpTT * taxPointValue * 100) / 100,
  }));
}
