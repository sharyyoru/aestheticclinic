import { NextRequest, NextResponse } from "next/server";

const SEMRUSH_API_KEY = process.env.SEMRUSH_API_KEY || "f9ad9c77fdbd2b57d551867ab800d380";
const SEMRUSH_BASE_URL = "https://api.semrush.com/";
const SEMRUSH_BACKLINKS_URL = "https://api.semrush.com/analytics/v1/";

// European databases for aesthetic medicine
const EU_DATABASES = ["fr", "de", "uk", "ch", "it", "es", "nl", "be", "at"];

type SemrushReport = 
  | "phrase_this"      // Keyword overview
  | "phrase_related"   // Related keywords
  | "phrase_questions" // Questions
  | "phrase_fullsearch"// Broad match
  | "domain_organic"   // Domain organic keywords
  | "domain_organic_organic"; // Competitors

async function fetchSemrush(params: Record<string, string>, isBacklinks = false): Promise<string> {
  const baseUrl = isBacklinks ? SEMRUSH_BACKLINKS_URL : SEMRUSH_BASE_URL;
  const url = new URL(baseUrl);
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

      case "backlinks_overview": {
        // Get backlinks overview for domain
        const csv = await fetchSemrush({
          type: "backlinks_overview",
          target: domain || "aesthetics-ge.ch",
          target_type: "root_domain",
          export_columns: "ascore,total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num,images_num",
        }, true);
        result = parseSemrushResponse(csv);
        break;
      }

      case "backlinks": {
        // Get list of backlinks
        const csv = await fetchSemrush({
          type: "backlinks",
          target: domain || "aesthetics-ge.ch",
          target_type: "root_domain",
          export_columns: "page_ascore,source_url,source_title,target_url,anchor,first_seen,last_seen,nofollow",
          display_limit: String(limit),
          display_sort: "page_ascore_desc",
        }, true);
        result = parseSemrushResponse(csv);
        break;
      }

      case "referring_domains": {
        // Get referring domains
        const csv = await fetchSemrush({
          type: "backlinks_refdomains",
          target: domain || "aesthetics-ge.ch",
          target_type: "root_domain",
          export_columns: "domain_ascore,domain,backlinks_num,ip,first_seen,last_seen",
          display_limit: String(limit),
          display_sort: "domain_ascore_desc",
        }, true);
        result = parseSemrushResponse(csv);
        break;
      }

      case "keyword_deep_analysis": {
        // Deep analysis for a keyword - combines multiple reports
        const results: Record<string, unknown> = {};

        // Get keyword overview
        try {
          const overviewCsv = await fetchSemrush({
            type: "phrase_this",
            phrase: keyword,
            database,
            export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd",
          });
          results.overview = parseSemrushResponse(overviewCsv)[0] || null;
        } catch { results.overview = null; }

        // Get related keywords
        try {
          const relatedCsv = await fetchSemrush({
            type: "phrase_related",
            phrase: keyword,
            database,
            export_columns: "Ph,Nq,Cp,Co,Kd",
            display_limit: "20",
            display_sort: "nq_desc",
          });
          results.related = parseSemrushResponse(relatedCsv);
        } catch { results.related = []; }

        // Get questions
        try {
          const questionsCsv = await fetchSemrush({
            type: "phrase_questions",
            phrase: keyword,
            database,
            export_columns: "Ph,Nq,Kd",
            display_limit: "10",
            display_sort: "nq_desc",
          });
          results.questions = parseSemrushResponse(questionsCsv);
        } catch { results.questions = []; }

        // Get broad match
        try {
          const broadCsv = await fetchSemrush({
            type: "phrase_fullsearch",
            phrase: keyword,
            database,
            export_columns: "Ph,Nq,Cp,Kd",
            display_limit: "15",
            display_sort: "nq_desc",
          });
          results.broadMatch = parseSemrushResponse(broadCsv);
        } catch { results.broadMatch = []; }

        result = results;
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
