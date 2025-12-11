import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

type CreateAppointmentPayload = {
  patientId: string;
  dealId?: string | null;
  providerId?: string | null;
  title?: string;
  appointmentDate: string;
  durationMinutes?: number;
  location?: string;
  notes?: string;
  sendPatientEmail?: boolean;
  sendUserEmail?: boolean;
  scheduleReminder?: boolean;
};

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  scheduledFor?: Date | null
) {
  if (!mailgunApiKey || !mailgunDomain) {
    console.log("Mailgun not configured, skipping email send");
    return;
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);

  if (scheduledFor && scheduledFor.getTime() > Date.now()) {
    formData.append("o:deliverytime", scheduledFor.toUTCString());
  }

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

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
    throw new Error(`Failed to send email: ${response.status}`);
  }
}

function formatAppointmentDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generatePatientEmailHtml(
  patientName: string,
  appointmentDate: Date,
  location: string | null,
  notes: string | null
): string {
  const formattedDate = formatAppointmentDate(appointmentDate);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Confirmed</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${patientName},</p>
    <p style="margin-bottom: 20px;">Your appointment has been scheduled. Here are the details:</p>
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;"><strong>📅 Date & Time:</strong> ${formattedDate}</p>
      ${location ? `<p style="margin: 0 0 10px 0;"><strong>📍 Location:</strong> ${location}</p>` : ""}
      ${notes ? `<p style="margin: 0;"><strong>📝 Notes:</strong> ${notes}</p>` : ""}
    </div>
    
    <p style="margin-bottom: 20px;">If you need to reschedule or cancel, please contact us as soon as possible.</p>
    
    <p style="margin-bottom: 0;">Best regards,<br><strong>Your Clinic Team</strong></p>
  </div>
</body>
</html>`;
}

function generateUserEmailHtml(
  userName: string,
  patientName: string,
  patientEmail: string,
  appointmentDate: Date,
  location: string | null,
  notes: string | null
): string {
  const formattedDate = formatAppointmentDate(appointmentDate);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Appointment Scheduled</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
    <p style="margin-bottom: 20px;">A new appointment has been scheduled with one of your patients:</p>
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;"><strong>👤 Patient:</strong> ${patientName}</p>
      <p style="margin: 0 0 10px 0;"><strong>📧 Email:</strong> ${patientEmail}</p>
      <p style="margin: 0 0 10px 0;"><strong>📅 Date & Time:</strong> ${formattedDate}</p>
      ${location ? `<p style="margin: 0 0 10px 0;"><strong>📍 Location:</strong> ${location}</p>` : ""}
      ${notes ? `<p style="margin: 0;"><strong>📝 Notes:</strong> ${notes}</p>` : ""}
    </div>
    
    <p style="margin-bottom: 0;">This appointment has been added to the patient's record in the CRM.</p>
  </div>
</body>
</html>`;
}

function generateReminderEmailHtml(
  recipientName: string,
  isPatient: boolean,
  patientName: string,
  appointmentDate: Date,
  location: string | null
): string {
  const formattedDate = formatAppointmentDate(appointmentDate);
  
  if (isPatient) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Appointment Reminder</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${recipientName},</p>
    <p style="margin-bottom: 20px;"><strong>This is a friendly reminder</strong> that you have an appointment scheduled for tomorrow:</p>
    
    <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;"><strong>📅 Date & Time:</strong> ${formattedDate}</p>
      ${location ? `<p style="margin: 0;"><strong>📍 Location:</strong> ${location}</p>` : ""}
    </div>
    
    <p style="margin-bottom: 20px;">If you need to reschedule, please contact us as soon as possible.</p>
    
    <p style="margin-bottom: 0;">We look forward to seeing you!<br><strong>Your Clinic Team</strong></p>
  </div>
</body>
</html>`;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Appointment Reminder</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${recipientName},</p>
    <p style="margin-bottom: 20px;"><strong>Reminder:</strong> You have an appointment scheduled for tomorrow with a patient:</p>
    
    <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;"><strong>👤 Patient:</strong> ${patientName}</p>
      <p style="margin: 0 0 10px 0;"><strong>📅 Date & Time:</strong> ${formattedDate}</p>
      ${location ? `<p style="margin: 0;"><strong>📍 Location:</strong> ${location}</p>` : ""}
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAppointmentPayload;

    const {
      patientId,
      dealId,
      providerId,
      title,
      appointmentDate,
      durationMinutes = 60,
      location,
      notes,
      sendPatientEmail = true,
      sendUserEmail = true,
      scheduleReminder = true,
    } = body;

    if (!patientId || !appointmentDate) {
      return NextResponse.json(
        { error: "Missing required fields: patientId, appointmentDate" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient details
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const patientName = [patient.first_name, patient.last_name]
      .filter(Boolean)
      .join(" ") || "Patient";
    const patientEmail = patient.email;

    // Get user details if providerId (userId) provided
    let assignedUserName = "Staff Member";
    let assignedUserEmail: string | null = null;

    if (providerId) {
      // providerId is actually a user ID from the platform users
      const { data: userData } = await supabase.auth.admin.getUserById(providerId);
      if (userData?.user) {
        const meta = userData.user.user_metadata || {};
        assignedUserName = meta.full_name || 
                          [meta.first_name, meta.last_name].filter(Boolean).join(" ") || 
                          userData.user.email?.split("@")[0] || "Staff Member";
        assignedUserEmail = userData.user.email || null;
      }
    }

    const appointmentDateObj = new Date(appointmentDate);

    // Calculate end time from duration
    const endDateObj = new Date(appointmentDateObj.getTime() + durationMinutes * 60 * 1000);

    // Build reason field (title + notes + status)
    let reason = title || `Appointment with ${patientName}`;
    if (assignedUserName && assignedUserName !== "Staff Member") {
      reason += ` [Doctor: ${assignedUserName}]`;
    }
    if (notes) {
      reason += ` [Notes: ${notes}]`;
    }

    // Create the appointment using the existing schema
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        provider_id: providerId || null,
        start_time: appointmentDateObj.toISOString(),
        end_time: endDateObj.toISOString(),
        reason,
        location: location || null,
        status: "scheduled",
        source: "workflow",
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      console.error("Error creating appointment:", appointmentError);
      return NextResponse.json(
        { error: "Failed to create appointment", details: appointmentError?.message },
        { status: 500 }
      );
    }

    const appointmentId = appointment.id;

    // Send confirmation email to patient
    if (sendPatientEmail && patientEmail) {
      try {
        const patientEmailHtml = generatePatientEmailHtml(
          patientName,
          appointmentDateObj,
          location || null,
          notes || null
        );
        await sendEmail(
          patientEmail,
          `Appointment Confirmed - ${formatAppointmentDate(appointmentDateObj)}`,
          patientEmailHtml
        );
        console.log("Patient confirmation email sent to:", patientEmail);
      } catch (err) {
        console.error("Error sending patient email:", err);
      }
    }

    // Send notification email to provider/staff
    if (sendUserEmail && assignedUserEmail) {
      try {
        const userEmailHtml = generateUserEmailHtml(
          assignedUserName,
          patientName,
          patientEmail || "Not provided",
          appointmentDateObj,
          location || null,
          notes || null
        );
        await sendEmail(
          assignedUserEmail,
          `New Appointment: ${patientName} - ${formatAppointmentDate(appointmentDateObj)}`,
          userEmailHtml
        );
        console.log("Provider notification email sent to:", assignedUserEmail);
      } catch (err) {
        console.error("Error sending provider email:", err);
      }
    }

    // Schedule reminder emails for 1 day before
    if (scheduleReminder) {
      const reminderDate = new Date(appointmentDateObj);
      reminderDate.setDate(reminderDate.getDate() - 1);

      // Only schedule if reminder date is in the future
      if (reminderDate.getTime() > Date.now()) {
        // Schedule patient reminder
        if (patientEmail) {
          try {
            const patientReminderHtml = generateReminderEmailHtml(
              patientName,
              true,
              patientName,
              appointmentDateObj,
              location || null
            );

            // Store in scheduled_emails table
            await supabase.from("scheduled_emails").insert({
              patient_id: patientId,
              appointment_id: appointmentId,
              recipient_type: "patient",
              recipient_email: patientEmail,
              subject: `Reminder: Appointment Tomorrow - ${formatAppointmentDate(appointmentDateObj)}`,
              body: patientReminderHtml,
              scheduled_for: reminderDate.toISOString(),
              status: "pending",
            });

            // Send via Mailgun with scheduled delivery
            await sendEmail(
              patientEmail,
              `Reminder: Appointment Tomorrow - ${formatAppointmentDate(appointmentDateObj)}`,
              patientReminderHtml,
              reminderDate
            );
            console.log("Patient reminder scheduled for:", reminderDate.toISOString());
          } catch (err) {
            console.error("Error scheduling patient reminder:", err);
          }
        }

        // Schedule provider reminder
        if (assignedUserEmail) {
          try {
            const providerReminderHtml = generateReminderEmailHtml(
              assignedUserName,
              false,
              patientName,
              appointmentDateObj,
              location || null
            );

            await supabase.from("scheduled_emails").insert({
              patient_id: patientId,
              appointment_id: appointmentId,
              recipient_type: "provider",
              recipient_email: assignedUserEmail,
              subject: `Reminder: Appointment with ${patientName} Tomorrow`,
              body: providerReminderHtml,
              scheduled_for: reminderDate.toISOString(),
              status: "pending",
            });

            await sendEmail(
              assignedUserEmail,
              `Reminder: Appointment with ${patientName} Tomorrow`,
              providerReminderHtml,
              reminderDate
            );
            console.log("Provider reminder scheduled for:", reminderDate.toISOString());
          } catch (err) {
            console.error("Error scheduling provider reminder:", err);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      appointmentId,
      message: "Appointment created successfully",
      emailsSent: {
        patient: sendPatientEmail && !!patientEmail,
        provider: sendUserEmail && !!assignedUserEmail,
      },
      reminderScheduled: scheduleReminder,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      { error: "Failed to create appointment", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
