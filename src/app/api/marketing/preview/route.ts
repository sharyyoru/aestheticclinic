import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  describeSupabaseError,
  fetchCampaignAudience,
  MAX_CAMPAIGN_RECIPIENTS,
  type MarketingFilter,
} from "@/lib/marketingFilters";

export const runtime = "nodejs";

/**
 * POST /api/marketing/preview
 * Body: { filter: MarketingFilter, sampleSize?: number }
 * Returns: { count, sample: PatientRow[] }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      filter?: MarketingFilter;
      sampleSize?: number;
    };

    const sampleSize = Math.max(1, Math.min(body.sampleSize ?? 10, 50));

    // Resolve the audience exactly the way the send route does — same cap,
    // same de-duplication — so the count shown in the UI is the number of
    // emails that will actually go out. Counting rows here while the sender
    // paginated past the cap is what made the page advertise 5,000 for an
    // audience of 28,687.
    const audience = await fetchCampaignAudience(supabaseAdmin, body.filter ?? {});

    return NextResponse.json({
      count: audience.recipients.length,
      sample: audience.recipients.slice(0, sampleSize),
      capped: audience.capped,
      cap: MAX_CAMPAIGN_RECIPIENTS,
      duplicatePatientsRemoved: audience.duplicatePatientsRemoved,
      sharedAddressesRemoved: audience.sharedAddressesRemoved,
    });
  } catch (error) {
    const message = describeSupabaseError(error);
    console.error("[/api/marketing/preview] Error:", error);
    return NextResponse.json(
      { error: `Preview failed: ${message}` },
      { status: 500 },
    );
  }
}
