import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUploadStatus } from "@/lib/medidataProxy";
import { mapUploadStatusToSubmissionStatus } from "@/lib/medidataResponseParser";

// This route talks to MediData via the AWS proxy (geoblocking bypass).
// The old implementation used MediDataClient directly, which only works from
// inside the MediData Box / EU network — in production (Vercel, non-EU) it
// silently failed. The proxy is the only working path.

/**
 * GET /api/medidata/status?submissionId=xxx
 * Poll the upload status of a MediData submission via the proxy.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    // Get submission record
    const { data: submission, error: subError } = await supabaseAdmin
      .from("medidata_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // If no message ID, return current status from DB
    if (!submission.medidata_message_id) {
      return NextResponse.json({
        submissionId,
        status: submission.status,
        statusMessage: "Not yet transmitted to MediData",
        lastChecked: null,
        history: [],
      });
    }

    // Poll upload status via the proxy
    const statusResult = await getUploadStatus(submission.medidata_message_id);
    const rawData = statusResult.rawResponse as any;
    const medidataStatus = rawData?.data?.status;
    const errorReason = rawData?.data?.errorReason;
    const created = rawData?.data?.created;

    const newStatus = mapUploadStatusToSubmissionStatus(
      medidataStatus,
      submission.status,
      created,
    );

    // Update status if changed
    if (newStatus !== submission.status) {
      await supabaseAdmin
        .from("medidata_submissions")
        .update({
          status: newStatus,
          medidata_response_code: medidataStatus || null,
          medidata_response_message: errorReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      await supabaseAdmin.from("medidata_submission_history").insert({
        submission_id: submissionId,
        previous_status: submission.status,
        new_status: newStatus,
        response_code: medidataStatus || null,
        changed_by: null,
        notes: errorReason || `Upload status: ${medidataStatus}`,
      });
    }

    // Get history
    const { data: history } = await supabaseAdmin
      .from("medidata_submission_history")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      submissionId,
      messageId: submission.medidata_message_id,
      status: newStatus,
      statusCode: medidataStatus || null,
      statusMessage: errorReason || null,
      lastChecked: new Date().toISOString(),
      history: history || [],
    });
  } catch (error) {
    console.error("Error polling MediData status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/medidata/status
 * Manually trigger upload status refresh for multiple submissions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionIds } = body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json(
        { error: "submissionIds array is required" },
        { status: 400 },
      );
    }

    // Limit batch size
    const idsToProcess = submissionIds.slice(0, 20);

    // Get submissions
    const { data: submissions } = await supabaseAdmin
      .from("medidata_submissions")
      .select("id, medidata_message_id, status, created_at")
      .in("id", idsToProcess)
      .not("medidata_message_id", "is", null);

    const results: Array<{
      submissionId: string;
      previousStatus: string;
      newStatus: string;
      updated: boolean;
    }> = [];

    for (const sub of submissions || []) {
      if (!sub.medidata_message_id) continue;

      try {
        const statusResult = await getUploadStatus(sub.medidata_message_id);
        const rawData = statusResult.rawResponse as any;
        const medidataStatus = rawData?.data?.status;
        const errorReason = rawData?.data?.errorReason;
        const created = rawData?.data?.created || sub.created_at;

        const newStatus = mapUploadStatusToSubmissionStatus(
          medidataStatus,
          sub.status,
          created,
        );

        const updated = newStatus !== sub.status;

        if (updated) {
          await supabaseAdmin
            .from("medidata_submissions")
            .update({
              status: newStatus,
              medidata_response_code: medidataStatus || null,
              medidata_response_message: errorReason || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          await supabaseAdmin.from("medidata_submission_history").insert({
            submission_id: sub.id,
            previous_status: sub.status,
            new_status: newStatus,
            response_code: medidataStatus || null,
            changed_by: null,
            notes: `Batch status update: ${errorReason || medidataStatus || newStatus}`,
          });
        }

        results.push({
          submissionId: sub.id,
          previousStatus: sub.status,
          newStatus,
          updated,
        });
      } catch (error) {
        console.error(`Error polling status for ${sub.id}:`, error);
        results.push({
          submissionId: sub.id,
          previousStatus: sub.status,
          newStatus: sub.status,
          updated: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      updated: results.filter((r) => r.updated).length,
      results,
    });
  } catch (error) {
    console.error("Error in batch status poll:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
