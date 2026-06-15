import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!mailgunApiKey || !mailgunDomain) {
    console.log("Mailgun not configured, skipping email send");
    return false;
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

  try {
    const response = await fetch(`${mailgunApiBaseUrl}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Error sending email via Mailgun", response.status, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error sending email:", err);
    return false;
  }
}

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending scheduled emails that are due (scheduled_for <= now)
    const now = new Date().toISOString();
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .limit(50); // Process in batches

    if (fetchError) {
      console.error("Error fetching scheduled emails:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch scheduled emails", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({ message: "No pending emails to send", sent: 0 });
    }

    console.log(`Processing ${pendingEmails.length} scheduled emails`);

    // ─────────────────────────────────────────────────────────────────────
    // Validate against the LIVE appointment before sending.
    // Prevents sending reminders/confirmations for appointments that were
    // cancelled, deleted, already happened, or rescheduled (stale body).
    // ─────────────────────────────────────────────────────────────────────
    const appointmentIds = Array.from(
      new Set(
        pendingEmails
          .map((e) => e.appointment_id)
          .filter((id): id is string => !!id),
      ),
    );

    const appointmentMap = new Map<
      string,
      { id: string; status: string | null; start_time: string | null }
    >();

    if (appointmentIds.length > 0) {
      const { data: appts, error: apptError } = await supabase
        .from("appointments")
        .select("id, status, start_time")
        .in("id", appointmentIds);

      if (apptError) {
        console.error("Error fetching appointments for validation:", apptError);
      } else {
        for (const appt of appts || []) {
          appointmentMap.set(appt.id, appt);
        }
      }
    }

    const nowMs = Date.now();
    // How far the live start_time may drift from what the reminder assumed
    // (reminders are scheduled for start_time - 24h). Tolerates DST shifts;
    // anything larger means the appointment was rescheduled => stale email.
    const RESCHEDULE_TOLERANCE_MS = 90 * 60 * 1000;

    const emailsToSend: typeof pendingEmails = [];
    const staleEmails: { id: string; reason: string }[] = [];

    for (const email of pendingEmails) {
      // Emails not tied to an appointment (generic) are always sent.
      if (!email.appointment_id) {
        emailsToSend.push(email);
        continue;
      }

      const appt = appointmentMap.get(email.appointment_id);

      if (!appt) {
        staleEmails.push({ id: email.id, reason: "appointment_deleted" });
        continue;
      }
      if (appt.status === "cancelled") {
        staleEmails.push({ id: email.id, reason: "appointment_cancelled" });
        continue;
      }
      if (appt.start_time) {
        const startMs = new Date(appt.start_time).getTime();
        // Appointment already in the past — reminder no longer relevant.
        if (startMs < nowMs) {
          staleEmails.push({ id: email.id, reason: "appointment_past" });
          continue;
        }
        // Detect reschedule: the reminder was scheduled for start_time - 24h.
        // If the live start_time no longer lines up, the stored body is stale.
        if (email.scheduled_for) {
          const expectedStartMs = new Date(email.scheduled_for).getTime() + 24 * 60 * 60 * 1000;
          if (Math.abs(startMs - expectedStartMs) > RESCHEDULE_TOLERANCE_MS) {
            staleEmails.push({ id: email.id, reason: "appointment_rescheduled" });
            continue;
          }
        }
      }

      emailsToSend.push(email);
    }

    // Retire stale emails so they are never sent or retried.
    // Use the known-valid "failed" status (the column may have a CHECK
    // constraint) and record the reason in the error column.
    if (staleEmails.length > 0) {
      console.log(
        `Skipping ${staleEmails.length} stale scheduled emails:`,
        staleEmails.map((s) => `${s.id}=${s.reason}`).join(", "),
      );
      await Promise.allSettled(
        staleEmails.map((s) =>
          supabase
            .from("scheduled_emails")
            .update({
              status: "failed",
              error: `Skipped (not sent): ${s.reason}`,
            })
            .eq("id", s.id),
        ),
      );
    }

    if (emailsToSend.length === 0) {
      return NextResponse.json({
        message: "No valid emails to send",
        sent: 0,
        skipped: staleEmails.length,
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Process emails in parallel (batch of 10 at a time)
    const batchSize = 10;
    for (let i = 0; i < emailsToSend.length; i += batchSize) {
      const batch = emailsToSend.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (email) => {
          const success = await sendEmail(
            email.recipient_email,
            email.subject,
            email.body
          );

          // Update status in database
          const newStatus = success ? "sent" : "failed";
          await supabase
            .from("scheduled_emails")
            .update({
              status: newStatus,
              sent_at: success ? new Date().toISOString() : null,
              error: success ? null : "Failed to send via Mailgun",
            })
            .eq("id", email.id);

          return success;
        })
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          sentCount++;
        } else {
          failedCount++;
        }
      });
    }

    console.log(`Scheduled emails processed: ${sentCount} sent, ${failedCount} failed`);

    return NextResponse.json({
      message: "Scheduled emails processed",
      sent: sentCount,
      failed: failedCount,
      skipped: staleEmails.length,
      total: pendingEmails.length,
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility with different cron providers
export async function POST(request: Request) {
  return GET(request);
}
