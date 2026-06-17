import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("id");

    if (emailId && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const openedAt = new Date().toISOString();

      // Update email status to "read" and set read_at timestamp
      const { error } = await supabase
        .from("emails")
        .update({
          status: "read",
          read_at: openedAt,
        })
        .eq("id", emailId)
        .eq("direction", "outbound") // Only track outbound emails
        .is("read_at", null); // Only update if not already read

      if (error) {
        console.error("Error updating email read status:", error);
      } else {
        console.log(`Email ${emailId} marked as read`);
      }

      // Propagate the open to marketing campaign stats. The pixel records the
      // open against the `emails` row, but campaign reporting reads from
      // `marketing_campaign_recipients.opened_at` / `marketing_campaigns.total_opened`,
      // so we mirror the event here. Guard on opened_at IS NULL so each unique
      // recipient open is counted only once.
      try {
        const { data: openedRecipients, error: recipientError } = await supabase
          .from("marketing_campaign_recipients")
          .update({ opened_at: openedAt, status: "opened" })
          .eq("email_id", emailId)
          .is("opened_at", null)
          .select("campaign_id");

        if (recipientError) {
          console.error("Error updating campaign recipient open:", recipientError);
        } else if (openedRecipients && openedRecipients.length > 0) {
          // Recompute total_opened from the source of truth (idempotent, race-safe).
          const campaignIds = Array.from(
            new Set(
              openedRecipients
                .map((r) => (r as { campaign_id: string | null }).campaign_id)
                .filter((cid): cid is string => Boolean(cid)),
            ),
          );
          for (const campaignId of campaignIds) {
            const { count } = await supabase
              .from("marketing_campaign_recipients")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .not("opened_at", "is", null);
            if (count !== null && count !== undefined) {
              await supabase
                .from("marketing_campaigns")
                .update({ total_opened: count })
                .eq("id", campaignId);
            }
          }
        }
      } catch (propagationError) {
        console.error("Error propagating open to campaign stats:", propagationError);
      }
    }

    // Always return the tracking pixel, even if update fails
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error in email tracking:", error);
    // Still return the pixel to avoid broken images
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store",
      },
    });
  }
}
