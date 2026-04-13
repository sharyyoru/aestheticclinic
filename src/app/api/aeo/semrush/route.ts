import { NextRequest, NextResponse } from "next/server";

const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY || "f9ad9c77fdbd2b57d551867ab800d380";
const SEMRUSH_BASE_URL = "https://api.semrush.com/";

// European databases for aesthetic medicine
const EU_DATABASES = ["fr", "de", "uk", "ch", "it", "es", "nl", "be", "at"];

type SemrushReport = 
  | "phrase_this"      // Keyword overview
  | "phrase_related"   // Related keywords
  | "phrase_questions" // Questions
  | "phrase_fullsearch"// Broad match
  | "domain_organic"   // Domain organic keywords
  | "domain_organic_organic"; // Competitors

async function fetchSemrush(params: Record<string, string>): Promise<string> {
  const url = new URL(SEMRUSH_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  url.searchParams.append("key", SEMRUSH_API_KEY);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Semrush API error: ${response.status} - ${text}`);
  }

  return response.text();
}

function parseSemrushResponse(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(";").map(h => h.trim());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";");
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || "";
    });
    results.push(row);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, keyword, domain, database = "ch", limit = 50 } = body;

    let result: unknown;

    switch (action) {
      case "keyword_overview": {
        // Get keyword metrics for a specific database
        const csv = await fetchSemrush({
          type: "phrase_this",
          phrase: keyword,
          database,
          export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd",
        });
        result = parseSemrushResponse(csv);
        break;
      }

      case "keyword_overview_all": {
        // Get keyword metrics across all EU databases
        const results: Record<string, unknown>[] = [];
        for (const db of EU_DATABASES) {
          try {
            const csv = await fetchSemrush({
              type: "phrase_this",
              phrase: keyword,
              database: db,
              export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd",
            });
            const parsed = parseSemrushResponse(csv);
            if (parsed.length > 0) {
              results.push({ database: db, ...parsed[0] });
            }
          } catch {
            // Skip databases with no data
          }
        }
        result = results;
        break;
      }

      case "related_keywords": {
        // Get related keywords
        const csv = await fetchSemrush({
          type: "phrase_related",
          phrase: keyword,
          database,
          export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd,Rr",
          display_limit: String(limit),
          display_sort: "nq_desc",
        });
        result = parseSemrushResponse(csv);
        break;
      }

      case "keyword_questions": {
        // Get questions related to keyword
        const csv = await fetchSemrush({
          type: "phrase_questions",
          phrase: keyword,
          database,
          export_columns: "Ph,Nq,Cp,Co,Nr,Kd",
          display_limit: String(limit),
          display_sort: "nq_desc",
        });
        result = parseSemrushResponse(csv);
        break;
      }

      case "broad_match": {
        // Get broad match keywords
        const csv = await fetchSemrush({
          type: "phrase_fullsearch",
          phrase: keyword,
          database,
          export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd",
          display_limit: String(limit),
          display_sort: "nq_desc",
        });
        result = parseSemrushResponse(csv);
        break;
      }

      case "domain_keywords": {
        // Get organic keywords for a domain
        const csv = await fetchSemrush({
          type: "domain_organic",
          domain: domain || "aesthetics-ge.ch",
          database,
          export_columns: "Ph,Po,Pp,Pd,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td,Kd",
          display_limit: String(limit),
          display_sort: "tr_desc",
        });
        result = parseSemrushResponse(csv);
        break;
      }

      case "competitors": {
        // Get organic competitors
        const csv = await fetchSemrush({
          type: "domain_organic_organic",
          domain: domain || "aesthetics-ge.ch",
          database,
          export_columns: "Dn,Cr,Np,Or,Ot,Oc,Ad",
          display_limit: String(limit),
        });
        result = parseSemrushResponse(csv);
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Semrush API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch from Semrush" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Simple health check and API test
  try {
    const csv = await fetchSemrush({
      type: "phrase_this",
      phrase: "aesthetic medicine",
      database: "ch",
      export_columns: "Ph,Nq,Cp,Co",
    });
    const result = parseSemrushResponse(csv);
    return NextResponse.json({ 
      success: true, 
      message: "Semrush API connected",
      sample: result 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "API connection failed" },
      { status: 500 }
    );
  }
}
