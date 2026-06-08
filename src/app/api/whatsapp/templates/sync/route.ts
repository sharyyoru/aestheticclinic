import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken  = process.env.TWILIO_AUTH_TOKEN!;

interface TwilioContentTemplate {
  sid: string;
  friendly_name: string;
  language: string;
  variables?: Record<string, string>;
  types?: Record<string, { body?: string; actions?: unknown[] }>;
  date_created?: string;
  date_updated?: string;
}

interface TwilioContentListResponse {
  contents: TwilioContentTemplate[];
  meta?: { next_page_url?: string | null };
}

interface TwilioApprovalResponse {
  whatsapp?: {
    status: string;   // "approved" | "pending" | "rejected"
    category: string; // "UTILITY" | "MARKETING" | "AUTHENTICATION"
    name?: string;
  };
}

// Fetch all pages from the Twilio Content Templates API
async function fetchAllTwilioTemplates(): Promise<TwilioContentTemplate[]> {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  const results: TwilioContentTemplate[] = [];
  let url: string | null = "https://content.twilio.com/v1/Content?PageSize=50";

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Twilio Content API error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as TwilioContentListResponse;
    results.push(...(data.contents ?? []));
    url = data.meta?.next_page_url ?? null;
  }

  return results;
}

// Fetch approval status from the separate ApprovalRequests endpoint.
// The Content list API always returns approval_requests=null — the real
// status lives at /Content/{sid}/ApprovalRequests.
async function fetchApproval(sid: string, auth: string): Promise<{ status: string; category: string }> {
  try {
    const res = await fetch(
      `https://content.twilio.com/v1/Content/${sid}/ApprovalRequests`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) return { status: "pending", category: "MARKETING" };
    const data = (await res.json()) as TwilioApprovalResponse;
    const wa = data.whatsapp;
    return {
      status:   wa?.status   ?? "pending",
      category: wa?.category ?? "MARKETING",
    };
  } catch {
    return { status: "pending", category: "MARKETING" };
  }
}

// Extract the template body from the Twilio types object
function extractBody(types?: Record<string, { body?: string }>): string {
  if (!types) return "";
  for (const key of [
    "twilio/text",
    "twilio/quick-reply",
    "twilio/list-picker",
    "twilio/call-to-action",
    "whatsapp/card",
  ]) {
    if (types[key]?.body) return types[key].body!;
  }
  for (const val of Object.values(types)) {
    if (val?.body) return val.body;
  }
  return "";
}

// Build a variables array from Twilio's variables map
function buildVariables(vars?: Record<string, string>): Array<{ key: string; label: string; example: string }> {
  if (!vars) return [];
  return Object.entries(vars).map(([key, example]) => ({
    key,
    label: example.replace(/_/g, " ").toLowerCase(),
    example,
  }));
}

// POST /api/whatsapp/templates/sync
export async function POST() {
  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured" },
      { status: 500 },
    );
  }

  try {
    const twilioTemplates = await fetchAllTwilioTemplates();
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Fetch approvals in parallel batches of 10 to avoid rate-limiting
    const BATCH = 10;
    for (let i = 0; i < twilioTemplates.length; i += BATCH) {
      const batch = twilioTemplates.slice(i, i + BATCH);

      await Promise.all(batch.map(async (tmpl) => {
        try {
          const body = extractBody(tmpl.types as Record<string, { body?: string }> | undefined);

          if (!body) {
            skipped++;
            return;
          }

          const variables = buildVariables(tmpl.variables);

          // Fetch real approval status from the dedicated endpoint
          const { status, category } = await fetchApproval(tmpl.sid, auth);

          const { error } = await supabaseAdmin
            .from("whatsapp_templates")
            .upsert(
              {
                name:               tmpl.friendly_name,
                category,
                language:           tmpl.language ?? "en",
                body,
                variables,
                twilio_content_sid: tmpl.sid,
                status,
                updated_at:         new Date().toISOString(),
              },
              { onConflict: "twilio_content_sid" },
            );

          if (error) {
            console.error(`Failed to upsert template ${tmpl.sid}:`, error);
            errors.push(`${tmpl.friendly_name}: ${error.message}`);
          } else {
            synced++;
          }
        } catch (tmplErr) {
          const msg = tmplErr instanceof Error ? tmplErr.message : String(tmplErr);
          errors.push(`${tmpl.friendly_name ?? tmpl.sid}: ${msg}`);
        }
      }));
    }

    return NextResponse.json({
      ok: true,
      total: twilioTemplates.length,
      synced,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Twilio template sync failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
