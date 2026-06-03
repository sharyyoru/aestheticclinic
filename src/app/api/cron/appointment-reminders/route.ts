import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSwissDateWithWeekday, formatSwissTimeAmPm } from "@/lib/swissTimezone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Appointment Reminders Cron Job
 * 
 * Sends reminders:
 * 1. 1 day before appointment - via WhatsApp (priority) AND email
 * 2. 1 hour after booking - via WhatsApp (priority) AND email
 * 
 * Run this cron every 15 minutes
 */

async function sendWhatsAppMessage(
  toPhone: string,
  message: string,
  patientId?: string
): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
    const response = await fetch(`${baseUrl}/api/whatsapp/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toPhone,
        messageBody: message,
        patientId,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("[Reminder] WhatsApp send failed:", error);
    return false;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
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
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Reminder] Email send failed:", err);
    return false;
  }
}

function generateReminderEmailHtml(
  patientName: string,
  appointmentDate: Date,
  location: string | null,
  doctorName: string | null,
  reminderType: "day_before" | "booking_confirmation"
): string {
  const dateStr = formatSwissDateWithWeekday(appointmentDate);
  const timeStr = formatSwissTimeAmPm(appointmentDate);
  
  const headerText = reminderType === "day_before" 
    ? "⏰ Appointment Reminder" 
    : "✓ Booking Confirmation";
  const subText = reminderType === "day_before"
    ? "Your appointment is tomorrow!"
    : "Your appointment has been booked";
  const bodyText = reminderType === "day_before"
    ? "This is a friendly reminder that you have an appointment scheduled for <strong>tomorrow</strong>:"
    : "Thank you for booking with us! Here are your appointment details:";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: #1e293b; padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">${headerText}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${subText}</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${patientName},</p>
    <p style="margin-bottom: 20px;">${bodyText}</p>
    
    <div style="background: ${reminderType === "day_before" ? "#fffbeb" : "#f0fdf4"}; padding: 20px; border-radius: 8px; border-left: 4px solid ${reminderType === "day_before" ? "#f59e0b" : "#22c55e"}; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;"><strong>📅 Date:</strong> ${dateStr}</p>
      <p style="margin: 0 0 10px 0;"><strong>🕐 Time:</strong> ${timeStr}</p>
      ${doctorName ? `<p style="margin: 0 0 10px 0;"><strong>👨‍⚕️ Doctor:</strong> ${doctorName}</p>` : ""}
      ${location ? `<p style="margin: 0;"><strong>📍 Location:</strong> ${location}</p>` : ""}
    </div>
    
    <p style="margin-bottom: 20px;">If you need to reschedule or cancel, please contact us:</p>
    <p style="margin-bottom: 0;">
      📞 +41 22 732 22 23<br>
      📧 info@aesthetics-ge.ch<br><br>
      <strong>Aesthetics Clinic</strong>
    </p>
  </div>
</body>
</html>`;
}

function extractDoctorName(reason: string | null): string | null {
  if (!reason) return null;
  const match = reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
  return match ? match[1] : null;
}

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
      dayBefore: { whatsapp: 0, email: 0, failed: 0 },
      bookingConfirm: { whatsapp: 0, email: 0, failed: 0 },
    };

    // ─────────────────────────────────────────────────────────────────────
    // 1. Send reminders for appointments TOMORROW (1 day before)
    // ─────────────────────────────────────────────────────────────────────
    const { data: tomorrowAppts, error: tomorrowError } = await supabase
      .from("appointments")
      .select(`
        id, patient_id, start_time, location, reason,
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
        const patient = appt.patient as any;
        if (!patient) continue;

        const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient";
        const patientPhone = patient.phone;
        const patientEmail = patient.email;
        const appointmentDate = new Date(appt.start_time);
        const location = appt.location;
        const doctorName = extractDoctorName(appt.reason);

        const dateStr = formatSwissDateWithWeekday(appointmentDate);
        const timeStr = formatSwissTimeAmPm(appointmentDate);
        
        // WhatsApp message (priority)
        const whatsappMessage = `⏰ Appointment Reminder - Aesthetics Clinic

Dear ${patientName},

This is a friendly reminder that you have an appointment TOMORROW:

📅 Date: ${dateStr}
🕐 Time: ${timeStr}
${doctorName ? `👨‍⚕️ Doctor: ${doctorName}` : ""}
${location ? `📍 Location: ${location}` : ""}

If you need to reschedule, please call us at +41 22 732 22 23.

We look forward to seeing you!`;

        let whatsappSent = false;
        let emailSent = false;

        // Send WhatsApp FIRST (priority)
        if (patientPhone && patientPhone.trim().length > 0) {
          whatsappSent = await sendWhatsAppMessage(patientPhone, whatsappMessage, patient.id);
          if (whatsappSent) results.dayBefore.whatsapp++;
        }

        // Send email as backup/copy
        if (patientEmail && patientEmail.trim().length > 0) {
          const emailHtml = generateReminderEmailHtml(
            patientName,
            appointmentDate,
            location,
            doctorName,
            "day_before"
          );
          emailSent = await sendEmail(
            patientEmail,
            `⏰ Appointment Reminder - Tomorrow ${timeStr}`,
            emailHtml
          );
          if (emailSent) results.dayBefore.email++;
        }

        // Mark reminder as sent
        if (whatsappSent || emailSent) {
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
        id, patient_id, start_time, location, reason, created_at,
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
        const patient = appt.patient as any;
        if (!patient) continue;

        const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient";
        const patientPhone = patient.phone;
        const patientEmail = patient.email;
        const appointmentDate = new Date(appt.start_time);
        const location = appt.location;
        const doctorName = extractDoctorName(appt.reason);

        const dateStr = formatSwissDateWithWeekday(appointmentDate);
        const timeStr = formatSwissTimeAmPm(appointmentDate);
        
        // WhatsApp booking confirmation
        const whatsappMessage = `✓ Booking Confirmed - Aesthetics Clinic

Dear ${patientName},

Your appointment has been successfully booked!

📅 Date: ${dateStr}
🕐 Time: ${timeStr}
${doctorName ? `👨‍⚕️ Doctor: ${doctorName}` : ""}
${location ? `📍 Location: ${location}` : ""}

We will send you a reminder the day before your appointment.

If you need to reschedule, please call us at +41 22 732 22 23.

Thank you for choosing Aesthetics Clinic!`;

        let whatsappSent = false;
        let emailSent = false;

        // Send WhatsApp FIRST (priority)
        if (patientPhone && patientPhone.trim().length > 0) {
          whatsappSent = await sendWhatsAppMessage(patientPhone, whatsappMessage, patient.id);
          if (whatsappSent) results.bookingConfirm.whatsapp++;
        }

        // Send email as backup/copy
        if (patientEmail && patientEmail.trim().length > 0) {
          const emailHtml = generateReminderEmailHtml(
            patientName,
            appointmentDate,
            location,
            doctorName,
            "booking_confirmation"
          );
          emailSent = await sendEmail(
            patientEmail,
            `✓ Booking Confirmed - ${dateStr} at ${timeStr}`,
            emailHtml
          );
          if (emailSent) results.bookingConfirm.email++;
        }

        // Mark confirmation as sent
        if (whatsappSent || emailSent) {
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
