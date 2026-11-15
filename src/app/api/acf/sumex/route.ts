import { NextRequest, NextResponse } from "next/server";
import {
  searchAcf005,
  getAcfChapters,
  getAcfSessionInfo,
  invalidateAcfSession,
  initializeValidate005,
  addServiceToValidate005,
  finalizeValidate005,
  getValidatedServices005,
  searchTma,
  getTmaChapters,
  runTmaGrouper,
  ACF_USE_SERVER,
  type AcfValidateServiceInput,
  type TmaType,
  type TmaGrouperInput,
} from "@/lib/sumexAcf";
import { requireStaff, requireRole, authErrorResponse } from "@/lib/serverAuth";
import { validateAcfLocal } from "@/lib/oaatCatalog";
import {
  appliesTo,
  runTarifmatcher,
  tarifmatcherConfigured,
  TARIFMATCHER_APPLICATION_YEAR,
} from "@/lib/tarifmatcher";

/**
 * API route for ACF (Ambulatory Case Flatrate) validator.
 * Proxies requests to the Sumex1 acfValidatorServer100.
 *
 * Actions:
 * - searchCode: Search ACF flat rate codes (code pattern, chapter, name)
 * - chapters: Get all ACF chapters with service counts
 * - searchTma: Search TMA gesture codes
 * - tmaChapters: Get all TMA chapters with service counts
 * - info: Get tariff DB version info
 * - refresh: Invalidate cached session
 */
export async function GET(request: NextRequest) {
    try {
      await requireStaff(request);
    } catch (err) {
      return authErrorResponse(err);
    }
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Missing action parameter" },
        { status: 400 },
      );
    }

    switch (action) {
      case "searchCode": {
        const code = searchParams.get("code") || "*";
        const chapter = searchParams.get("chapter") || "";
        const name = searchParams.get("name") || "";
        const date = searchParams.get("date") || undefined;

        const result = await searchAcf005(code, chapter, name, true, date);

        return NextResponse.json({
          success: true,
          data: {
            count: result.count,
            services: result.services,
          },
        });
      }

      case "chapters": {
        const chapters = await getAcfChapters();
        return NextResponse.json({
          success: true,
          data: chapters,
        });
      }

      case "searchTma": {
        const code = searchParams.get("code") || "*";
        const chapter = searchParams.get("chapter") || "";
        const name = searchParams.get("name") || "";
        const tmaType = parseInt(searchParams.get("tmaType") || "0", 10) as TmaType;
        const grouperOnly = searchParams.get("grouperOnly") === "true";
        const date = searchParams.get("date") || undefined;

        const result = await searchTma(code, chapter, name, tmaType, grouperOnly, date);

        return NextResponse.json({
          success: true,
          data: {
            count: result.count,
            services: result.services,
          },
        });
      }

      case "tmaChapters": {
        const chapters = await getTmaChapters();
        return NextResponse.json({
          success: true,
          data: chapters,
        });
      }

      case "info": {
        const info = await getAcfSessionInfo();
        return NextResponse.json({
          success: true,
          data: info,
        });
      }

      case "refresh": {
        invalidateAcfSession();
        const info = await getAcfSessionInfo();
        return NextResponse.json({
          success: true,
          data: info,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("ACF Sumex API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * POST handler for ACF validation and TMA grouper.
 *
 * Body.action = "validate005" (default):
 *   { services: AcfValidateServiceInput[] }
 *   Runs IValidate005: Initialize → AddService → Finalize → GetServices
 *
 * Body.action = "runGrouper":
 *   { icdCode, patientSex, patientBirthdate, law?, sessionNumber?, services: [{code, side?, ...}] }
 *   Runs IValidateTMA: gesture codes + ICD → ACF flat rate codes
 */
export async function POST(request: NextRequest) {
    try {
      await requireStaff(request);
    } catch (err) {
      return authErrorResponse(err);
    }
  try {
    const body = await request.json();
    const action = body.action || "validate005";

    if (action === "runGrouper") {
      // Gesture + ICD-10 -> flat rate grouping is the OAAT TarifMatcher's
      // job; it is not part of the published catalogues. It is a Java
      // library, so it runs as its own service (tarifmatcher-server/) and is
      // reached over HTTP — Vercel's Node runtime has no JVM.
      if (!ACF_USE_SERVER && tarifmatcherConfigured()) {
        const serviceDate: string | undefined =
          body.serviceDate || body.treatmentDate || body.dateBegin;

        // The bundle is application_year 2027. Grouping a 2026 treatment with
        // it would price this year's work at next year's tariff, so it
        // refuses instead of answering. Remove this gate once the 2026 trees
        // are loaded alongside.
        if (!appliesTo(serviceDate)) {
          return NextResponse.json(
            {
              success: false,
              error:
                `Le groupeur chargé s'applique à partir du 1.1.${TARIFMATCHER_APPLICATION_YEAR}. ` +
                `Pour une prestation antérieure, sélectionnez le forfait directement dans le catalogue.`,
            },
            { status: 503 },
          );
        }

        const codes: string[] = (body.services || [])
          .map((s: { code?: string }) => s?.code)
          .filter(Boolean);
        const icd = String(body.icdCode || "").trim();
        if (!icd) {
          return NextResponse.json(
            { success: false, error: "ICD-10 diagnostic code is required" },
            { status: 400 },
          );
        }
        if (!codes.length) {
          return NextResponse.json(
            { success: false, error: "At least one TMA gesture code is required" },
            { status: 400 },
          );
        }

        try {
          const grouped = await runTarifmatcher({
            services: codes,
            diagnoses: [icd],
            ageYears: body.ageYears,
            caseId: body.caseId,
          });
          if (!grouped.flatRate) {
            return NextResponse.json(
              {
                success: false,
                error: "Le groupeur n'a retourné aucun forfait pour cette combinaison.",
                data: { errors: grouped.warnings },
              },
              { status: 200 },
            );
          }
          // acfCodes is the shape the invoice UI already consumes. The 2027
          // system prices a flat rate by cost weight, not tax points, so the
          // weight is reported as-is and labelled rather than silently
          // multiplied by a tax point value that no longer applies.
          return NextResponse.json({
            success: true,
            data: {
              acfCodes: [
                {
                  code: grouped.flatRate,
                  name: `[ambP ${grouped.applicationYear}] ${grouped.flatRate}`,
                  tp: grouped.costWeight,
                  costWeight: grouped.costWeight,
                  chapterCode: "",
                  chapterName: "",
                },
              ],
              mappedTardocs: grouped.mappedTardocs,
              applicationYear: grouped.applicationYear,
              errors: grouped.warnings,
            },
          });
        } catch (err) {
          return NextResponse.json(
            {
              success: false,
              error: `Groupeur indisponible: ${err instanceof Error ? err.message : String(err)}`,
            },
            { status: 503 },
          );
        }
      }

      if (!ACF_USE_SERVER) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Le groupeur des forfaits ambulatoires n'est pas disponible (serveur Sumex hors service). " +
              "Sélectionnez le forfait directement dans le catalogue.",
          },
          { status: 503 },
        );
      }
      const input: TmaGrouperInput = {
        icdCode: body.icdCode || "",
        patientSex: body.patientSex ?? 0,
        patientBirthdate: body.patientBirthdate || "1990-01-01",
        law: body.law ?? 0,
        sessionNumber: body.sessionNumber ?? 100,
        services: body.services || [],
      };

      if (!input.icdCode) {
        return NextResponse.json(
          { success: false, error: "ICD-10 diagnostic code is required" },
          { status: 400 },
        );
      }
      if (input.services.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one TMA gesture code is required" },
          { status: 400 },
        );
      }

      const result = await runTmaGrouper(input);

      return NextResponse.json({
        success: result.success,
        data: result,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      });
    }

    // Default: validate005
    const services: AcfValidateServiceInput[] = body.services || [];

    if (services.length === 0) {
      return NextResponse.json(
        { success: false, error: "No services provided" },
        { status: 400 },
      );
    }

    if (!ACF_USE_SERVER) {
      return NextResponse.json({ success: true, data: validateAcfLocal(services) });
    }

    // 1. Initialize
    const { validateHandle } = await initializeValidate005();

    // 2. AddService for each
    const addResults = [];
    for (const svc of services) {
      const result = await addServiceToValidate005(validateHandle, svc);
      addResults.push({
        code: svc.code,
        ...result,
      });
    }

    // 3. Finalize
    const finalResult = await finalizeValidate005(validateHandle);

    // 4. Get validated services
    const validatedServices = await getValidatedServices005(validateHandle);

    return NextResponse.json({
      success: true,
      data: {
        addResults,
        finalize: finalResult,
        validatedServices,
      },
    });
  } catch (error) {
    console.error("ACF Validate API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
