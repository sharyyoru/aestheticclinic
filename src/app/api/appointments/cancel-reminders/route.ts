import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Source-side cleanup for appointment reminders.
 *
 * Called immediately when staff cancel or reschedule an appointment so that
 * any pending reminder/confirmation rows in `scheduled_emails` are retired
 * right away (defense-in-depth on top of the cron-side validation).
 *
 * POST body: { appointmentId: string, reason?: "cancelled" | "rescheduled" }
 */
export async function POST(request: Request) {
  let body: { appointmentId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const appointmentId = body.appointmentId?.trim();
  const reason = body.reason === "rescheduled" ? "rescheduled" : "cancelled";

  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId is required" }, { status: 400 });
  }

  try {
    // Retire any pending scheduled emails for this appointment. Use the
    // known-valid "failed" status (the column may have a CHECK constraint)
    // so the row is never picked up by the sender cron again.
    const { data, error } = await supabaseAdmin
      .from("scheduled_emails")
      .update({
        status: "failed",
        error: `Appointment ${reason} (source-side cleanup)`,
      })
      .eq("appointment_id", appointmentId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error("[cancel-reminders] Failed to update scheduled_emails:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cancelled = data?.length ?? 0;
    console.log(
      `[cancel-reminders] Retired ${cancelled} pending reminder(s) for appointment ${appointmentId} (${reason})`,
    );

    return NextResponse.json({ ok: true, cancelled });
  } catch (err) {
    console.error("[cancel-reminders] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
