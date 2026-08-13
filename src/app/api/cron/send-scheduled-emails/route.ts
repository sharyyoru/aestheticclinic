import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reminderSuppressionReason } from "@/lib/appointmentComms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

type ScheduledEmailContext = {
  emailId: string;
  patientId: string | null;
  sentByEmail: string | null;
};

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  context: ScheduledEmailContext,
): Promise<{ success: boolean; messageId: string | null }> {
  if (!mailgunApiKey || !mailgunDomain) {
    console.log("Mailgun not configured, skipping email send");
    return { success: false, messageId: null };
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);

  // Route patient replies through the inbound webhook and preserve enough
  // metadata to notify/forward to the staff member who booked the appointment.
  const replyToAddress = context.patientId
    ? `reply+${context.emailId}+${context.patientId}@${domain}`
    : `reply+${context.emailId}@${domain}`;
  formData.append("h:Reply-To", replyToAddress);
  formData.append("v:email-id", context.emailId);
  if (context.patientId) formData.append("v:patient-id", context.patientId);
  if (context.sentByEmail) formData.append("v:sent-by", context.sentByEmail);

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
      return { success: false, messageId: null };
    }

    const mailgunResponse = (await response.json().catch(() => null)) as { id?: string } | null;
    return { success: true, messageId: mailgunResponse?.id ?? null };
  } catch (err) {
    console.error("Error sending email:", err);
    return { success: false, messageId: null };
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
      { id: string; status: string | null; start_time: string | null; reason: string | null }
    >();

    const schedulerByAppointment = new Map<
      string,
      { userId: string | null; email: string | null }
    >();

    if (appointmentIds.length > 0) {
      const { data: appts, error: apptError } = await supabase
        .from("appointments")
        .select("id, status, start_time, reason")
        .in("id", appointmentIds);

      if (apptError) {
        console.error("Error fetching appointments for validation:", apptError);
      } else {
        for (const appt of appts || []) {
          appointmentMap.set(appt.id, appt);
        }
      }

      // The creation history is the authoritative record of who scheduled an
      // appointment from the staff calendar. Keep the first creation entry per
      // appointment so replies go to that person, not merely the assigned doctor.
      const { data: creationHistory, error: historyError } = await supabase
        .from("appointment_history")
        .select("appointment_id, changed_by_user_id, changed_by_email, changed_at")
        .in("appointment_id", appointmentIds)
        .eq("change_type", "created")
        .order("changed_at", { ascending: true });

      if (historyError) {
        console.error("Error fetching appointment schedulers:", historyError);
      } else {
        for (const entry of creationHistory || []) {
          if (!schedulerByAppointment.has(entry.appointment_id)) {
            schedulerByAppointment.set(entry.appointment_id, {
              userId: entry.changed_by_user_id ?? null,
              email: entry.changed_by_email ?? null,
            });
          }
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
      // Authoritative agenda-status guard: also retire emails for appointments
      // moved ("Déplacé") or cancelled via the `[Status: ...]` reason tag, which
      // leave the DB status as "scheduled". See @/lib/appointmentComms.
      const suppression = reminderSuppressionReason(appt);
      if (suppression) {
        staleEmails.push({ id: email.id, reason: suppression });
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
          const scheduler = email.appointment_id
            ? schedulerByAppointment.get(email.appointment_id)
            : undefined;
          const fromAddress = scheduler?.email || mailgunFromEmail || `no-reply@${mailgunDomain}`;

          // Create the CRM row before sending so the Reply-To address can carry
          // its ID. The inbound webhook uses this row to create the scheduler's
          // notification and forward the patient's response to their work email.
          const { data: emailLog, error: emailLogError } = await supabase
            .from("emails")
            .insert({
              patient_id: email.patient_id ?? null,
              to_address: email.recipient_email,
              from_address: fromAddress,
              subject: email.subject,
              body: email.body,
              direction: "outbound",
              status: "queued",
              source: "scheduled_reminder",
              sent_by_user_id: scheduler?.userId ?? null,
            })
            .select("id")
            .single();

          if (emailLogError || !emailLog) {
            console.error("Failed to create scheduled reminder email record:", emailLogError);
            return false;
          }

          const result = await sendEmail(email.recipient_email, email.subject, email.body, {
            emailId: emailLog.id,
            patientId: email.patient_id ?? null,
            sentByEmail: scheduler?.email ?? null,
          });

          await supabase
            .from("emails")
            .update({
              status: result.success ? "sent" : "failed",
              sent_at: result.success ? new Date().toISOString() : null,
              message_id: result.messageId,
            })
            .eq("id", emailLog.id);

          // Update status in database
          const newStatus = result.success ? "sent" : "failed";
          await supabase
            .from("scheduled_emails")
            .update({
              status: newStatus,
              sent_at: result.success ? new Date().toISOString() : null,
              error: result.success ? null : "Failed to send via Mailgun",
            })
            .eq("id", email.id);

          return result.success;
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
