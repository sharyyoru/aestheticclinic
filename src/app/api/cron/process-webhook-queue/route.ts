import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processFacebookLead } from "@/lib/processWebhookQueue";

/**
 * Cron job to process webhook queue sequentially
 * This eliminates race conditions by processing one webhook at a time
 * 
 * Vercel Cron: Runs every minute
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Webhook Queue] Starting queue processing");

    // Get pending webhooks (oldest first, limit to 10 per run)
    const { data: pendingWebhooks, error: fetchError } = await supabaseAdmin
      .from("webhook_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[Webhook Queue] Failed to fetch pending webhooks:", fetchError);
      return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 });
    }

    if (!pendingWebhooks || pendingWebhooks.length === 0) {
      console.log("[Webhook Queue] No pending webhooks");
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: "No pending webhooks"
      });
    }

    console.log(`[Webhook Queue] Found ${pendingWebhooks.length} pending webhooks`);

    let processed = 0;
    let failed = 0;

    // Process each webhook sequentially
    for (const webhook of pendingWebhooks) {
      try {
        // Mark as processing
        await supabaseAdmin
          .from("webhook_queue")
          .update({ 
            status: "processing",
            processed_at: new Date().toISOString()
          })
          .eq("id", webhook.id);

        console.log(`[Webhook Queue] Processing webhook ${webhook.id} (${webhook.source})`);

        // Process based on source
        let result;
        if (webhook.source === "zapier-facebook-leads") {
          result = await processFacebookLead(webhook.payload);
        } else {
          throw new Error(`Unknown webhook source: ${webhook.source}`);
        }

        if (result.success) {
          // Mark as completed
          await supabaseAdmin
            .from("webhook_queue")
            .update({ 
              status: "completed",
              completed_at: new Date().toISOString(),
              error_message: null
            })
            .eq("id", webhook.id);

          processed++;
          console.log(`[Webhook Queue] Successfully processed webhook ${webhook.id}`);
        } else {
          // Mark as failed
          const attempts = webhook.attempts + 1;
          const status = attempts >= webhook.max_attempts ? "failed" : "pending";

          await supabaseAdmin
            .from("webhook_queue")
            .update({ 
              status,
              attempts,
              error_message: result.error || "Unknown error",
              ...(status === "failed" && { completed_at: new Date().toISOString() })
            })
            .eq("id", webhook.id);

          failed++;
          console.error(`[Webhook Queue] Failed to process webhook ${webhook.id}:`, result.error);
        }

      } catch (error) {
        // Handle unexpected errors
        const attempts = webhook.attempts + 1;
        const status = attempts >= webhook.max_attempts ? "failed" : "pending";
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await supabaseAdmin
          .from("webhook_queue")
          .update({ 
            status,
            attempts,
            error_message: errorMessage,
            ...(status === "failed" && { completed_at: new Date().toISOString() })
          })
          .eq("id", webhook.id);

        failed++;
        console.error(`[Webhook Queue] Error processing webhook ${webhook.id}:`, error);
      }
    }

    console.log(`[Webhook Queue] Completed: ${processed} processed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: pendingWebhooks.length
    });

  } catch (error) {
    console.error("[Webhook Queue] Fatal error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
