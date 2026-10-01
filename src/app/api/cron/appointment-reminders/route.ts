import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSwissDateWithWeekday, formatSwissTimeAmPm } from "@/lib/swissTimezone";
import { isOperationRoomAppointment, reminderSuppressionReason } from "@/lib/appointmentComms";
import { logEmailSent } from "@/lib/logEmail";
import { generatePatientAppointmentEmailHtml } from "@/lib/appointmentEmailTemplates";
import { sendSms } from "@/lib/messaging";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
const reminderReplyToEmail = "info@aesthetics-ge.ch";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Appointment Reminders Cron Job
 * 
 * Sends reminders:
 * 1. 1 day before appointment - via SMS (priority) AND email
 * 2. 1 hour after booking - via SMS (priority) AND email
 * 
 * Run this cron every 15 minutes
 */

async function sendAppointmentSms(
  toPhone: string,
  message: string,
  patientId: string | undefined,
  messageType: string,
): Promise<boolean> {
  // SMS via Twilio — server-to-server, no WhatsApp session to keep alive, and
  // every send is logged in sms_logs by /api/sms/send.
  const result = await sendSms({
    to: toPhone,
    body: message,
    patientId,
    source: "appointment_reminder",
    metadata: { message_type: messageType },
  });
  if (!result.ok) {
    console.error(`[Reminder] SMS send failed to ${toPhone}:`, result.error);
  }
  return result.ok;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  patientId: string,
  replyTo?: string,
): Promise<boolean> {
  if (!mailgunApiKey || !mailgunDomain) {
    console.log("[Reminder] Mailgun not configured");
    return false;
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);
  if (replyTo) formData.append("h:Reply-To", replyTo);

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

  try {
    const response = await fetch(`${mailgunApiBaseUrl}/v3/${domain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[Reminder] Email error:", response.status, text);
      void logEmailSent({ patient_id: patientId, to_address: to, from_address: fromAddress, subject, body: html, source: "appointment_reminder", status: "failed" });
      return false;
    }
    void logEmailSent({ patient_id: patientId, to_address: to, from_address: fromAddress, subject, body: html, source: "appointment_reminder", status: "sent" });
    return true;
  } catch (err) {
    console.error("[Reminder] Email send failed:", err);
    void logEmailSent({ patient_id: patientId, to_address: to, from_address: fromAddress, subject, body: html, source: "appointment_reminder", status: "failed" });
    return false;
  }
}

function extractDoctorName(reason: string | null): string | null {
  if (!reason) return null;
  const match = reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
  return match ? match[1] : null;
}

type ReminderPatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    
    // Calculate time windows
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));
    
    // 1 hour ago (for booking confirmations that were created 1 hour ago)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneHourAgoStart = new Date(oneHourAgo.getTime() - 5 * 60 * 1000); // 5 min window
    
    const results = {
      dayBefore: { sms: 0, email: 0, failed: 0 },
      bookingConfirm: { sms: 0, email: 0, failed: 0 },
    };

    // ─────────────────────────────────────────────────────────────────────
    // 1. Send reminders for appointments TOMORROW (1 day before)
    // ─────────────────────────────────────────────────────────────────────
    const { data: tomorrowAppts, error: tomorrowError } = await supabase
      .from("appointments")
      .select(`
        id, patient_id, start_time, location, reason, status,
        patient:patients(id, first_name, last_name, email, phone)
      `)
      .gte("start_time", tomorrowStart.toISOString())
      .lte("start_time", tomorrowEnd.toISOString())
      .eq("status", "scheduled")
      .is("reminder_sent_at", null); // Only if reminder not already sent

    if (tomorrowError) {
      console.error("[Reminder] Error fetching tomorrow appointments:", tomorrowError);
    }

    if (tomorrowAppts && tomorrowAppts.length > 0) {
      console.log(`[Reminder] Processing ${tomorrowAppts.length} appointments for tomorrow`);
      
      for (const appt of tomorrowAppts) {
        if (isOperationRoomAppointment(appt)) {
          console.log(`[Reminder] Skipping Operation Room appointment ${appt.id}`);
          continue;
        }
        // Authoritative guard: skip appointments that were moved ("Déplacé") or
        // cancelled via the agenda `[Status: ...]` tag even though the DB
        // status column is still "scheduled". See @/lib/appointmentComms.
        const suppression = reminderSuppressionReason(appt);
        if (suppression) {
          console.log(
            `[Reminder] Skipping day-before reminder for appointment ${appt.id}: ${suppression}`,
          );
          continue;
        }

        const patient = appt.patient as unknown as ReminderPatient | undefined;
        if (!patient) continue;

        const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient";
        const patientPhone = patient.phone;
        const patientEmail = patient.email;
        const appointmentDate = new Date(appt.start_time);
        const location = appt.location;
        const doctorName = extractDoctorName(appt.reason);

        const dateStr = formatSwissDateWithWeekday(appointmentDate);
        const timeStr = formatSwissTimeAmPm(appointmentDate);
        
        // SMS message (priority) — ASCII only so it stays GSM-7 and doesn't
        // get billed as multiple UCS-2 segments.
        const smsMessage = `Aesthetics Clinic reminder: appointment TOMORROW ${dateStr} at ${timeStr}${doctorName ? ` with ${doctorName}` : ""}${location ? `, ${location}` : ""}. To reschedule call +41 22 732 22 23.`;

        let smsSent = false;
        let emailSent = false;

        // Send SMS FIRST (priority)
        if (patientPhone && patientPhone.trim().length > 0) {
          smsSent = await sendAppointmentSms(patientPhone, smsMessage, patient.id, "appointment_reminder");
          if (smsSent) results.dayBefore.sms++;
        }

        // Send email as backup/copy
        if (patientEmail && patientEmail.trim().length > 0) {
          const emailHtml = generatePatientAppointmentEmailHtml({
            type: "day_before",
            patientName,
            appointmentDate,
            location,
            doctorName,
            contactPhone: "+41 22 732 22 23",
            contactEmail: reminderReplyToEmail,
          });
          emailSent = await sendEmail(
            patientEmail,
            `Appointment Reminder / Rappel de rendez-vous - Tomorrow ${timeStr}`,
            emailHtml,
            patient.id,
            reminderReplyToEmail,
          );
          if (emailSent) results.dayBefore.email++;
        }

        // Mark reminder as sent
        if (smsSent || emailSent) {
          await supabase
            .from("appointments")
            .update({ reminder_sent_at: now.toISOString() })
            .eq("id", appt.id);
        } else {
          results.dayBefore.failed++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. Send booking confirmation 1 hour after appointment was created
    // ─────────────────────────────────────────────────────────────────────
    const { data: recentBookings, error: recentError } = await supabase
      .from("appointments")
      .select(`
        id, patient_id, start_time, location, reason, status, created_at,
        patient:patients(id, first_name, last_name, email, phone)
      `)
      .gte("created_at", oneHourAgoStart.toISOString())
      .lte("created_at", oneHourAgo.toISOString())
      .neq("status", "cancelled")
      .is("booking_confirmation_sent_at", null); // Only if not already sent

    if (recentError) {
      console.error("[Reminder] Error fetching recent bookings:", recentError);
    }

    if (recentBookings && recentBookings.length > 0) {
      console.log(`[Reminder] Processing ${recentBookings.length} booking confirmations`);
      
      for (const appt of recentBookings) {
        if (isOperationRoomAppointment(appt)) {
          console.log(`[Reminder] Skipping Operation Room booking confirmation ${appt.id}`);
          continue;
        }
        // Same authoritative guard as the day-before reminder above.
        const suppression = reminderSuppressionReason(appt);
        if (suppression) {
          console.log(
            `[Reminder] Skipping booking confirmation for appointment ${appt.id}: ${suppression}`,
          );
          continue;
        }

        const patient = appt.patient as unknown as ReminderPatient | undefined;
        if (!patient) continue;

        const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient";
        const patientPhone = patient.phone;
        const patientEmail = patient.email;
        const appointmentDate = new Date(appt.start_time);
        const location = appt.location;
        const doctorName = extractDoctorName(appt.reason);

        const dateStr = formatSwissDateWithWeekday(appointmentDate);
        const timeStr = formatSwissTimeAmPm(appointmentDate);
        
        // SMS booking confirmation
        const smsMessage = `Aesthetics Clinic: appointment confirmed for ${dateStr} at ${timeStr}${doctorName ? ` with ${doctorName}` : ""}${location ? `, ${location}` : ""}. Reminder the day before. To reschedule call +41 22 732 22 23.`;

        let smsSent = false;
        let emailSent = false;

        // Send SMS FIRST (priority)
        if (patientPhone && patientPhone.trim().length > 0) {
          smsSent = await sendAppointmentSms(patientPhone, smsMessage, patient.id, "booking_confirmation");
          if (smsSent) results.bookingConfirm.sms++;
        }

        // Send email as backup/copy
        if (patientEmail && patientEmail.trim().length > 0) {
          const emailHtml = generatePatientAppointmentEmailHtml({
            type: "confirmation",
            patientName,
            appointmentDate,
            location,
            doctorName,
            contactPhone: "+41 22 732 22 23",
            contactEmail: mailgunFromEmail,
          });
          emailSent = await sendEmail(
            patientEmail,
            `Booking Confirmed / Réservation confirmée - ${dateStr} at ${timeStr}`,
            emailHtml,
            patient.id,
          );
          if (emailSent) results.bookingConfirm.email++;
        }

        // Mark confirmation as sent
        if (smsSent || emailSent) {
          await supabase
            .from("appointments")
            .update({ booking_confirmation_sent_at: now.toISOString() })
            .eq("id", appt.id);
        } else {
          results.bookingConfirm.failed++;
        }
      }
    }

    console.log("[Reminder] Cron job completed:", results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error("[Reminder] Cron job error:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
