import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken  = process.env.TWILIO_AUTH_TOKEN!;

interface TwilioContentTemplate {
  sid: string;
  friendly_name: string;
  language: string;
  variables?: Record<string, string>; // e.g. { "1": "customer_name", "2": "appointment_date" }
  types?: Record<string, { body?: string; actions?: unknown[] }>;
  approval_requests?: {
    status: string;   // "approved" | "pending" | "rejected"
    category: string; // "UTILITY" | "MARKETING" | "AUTHENTICATION"
    name?: string;
  }[];
  date_created?: string;
  date_updated?: string;
}

interface TwilioContentListResponse {
  contents: TwilioContentTemplate[];
  meta?: { next_page_url?: string | null };
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

// Extract the template body from the Twilio types object
function extractBody(types?: Record<string, { body?: string }>): string {
  if (!types) return "";
  // Priority order of content types
  for (const key of [
    "twilio/text",
    "twilio/quick-reply",
    "twilio/list-picker",
    "twilio/call-to-action",
    "whatsapp/card",
  ]) {
    if (types[key]?.body) return types[key].body!;
  }
  // Fall back to first type that has a body
  for (const val of Object.values(types)) {
    if (val?.body) return val.body;
  }
  return "";
}

// Build a variables array from Twilio's variables map
// Twilio gives: { "1": "customer_name", "2": "appointment_date" }
// We store:     [{ key: "1", label: "customer name", example: "customer_name" }]
function buildVariables(vars?: Record<string, string>): Array<{ key: string; label: string; example: string }> {
  if (!vars) return [];
  return Object.entries(vars).map(([key, example]) => ({
    key,
    label: example.replace(/_/g, " ").toLowerCase(),
    example,
  }));
}

// POST /api/whatsapp/templates/sync
// Fetches all approved templates from Twilio Content API and upserts into whatsapp_templates.
export async function POST() {
  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured" },
      { status: 500 },
    );
  }

  try {
    const twilioTemplates = await fetchAllTwilioTemplates();

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const tmpl of twilioTemplates) {
      try {
        const approval = tmpl.approval_requests?.[0];
        const status   = approval?.status   ?? "pending";
        const category = approval?.category ?? "MARKETING";
        const body     = extractBody(tmpl.types as Record<string, { body?: string }> | undefined);
        const variables = buildVariables(tmpl.variables);

        if (!body) {
          // Skip templates without a text body (e.g. media-only)
          skipped++;
          continue;
        }

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
