import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSwissDateWithWeekday, formatSwissTimeAmPm, parseSwissDateTimeLocal } from "@/lib/swissTimezone";
import { syncDealToAppointmentSet } from "@/lib/dealAppointmentSync";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

type BookingPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  appointmentDate: string;
  service: string;
  doctorSlug: string;
  doctorName: string;
  doctorEmail: string;
  notes?: string;
  location?: string;
};

function parseBookingAppointmentDate(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) return new Date(NaN);

  const looksLikeIsoWithTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (looksLikeIsoWithTimezone) {
    return new Date(trimmed);
  }

  return parseSwissDateTimeLocal(trimmed);
}

// Mailgun only allows scheduling emails up to 24 hours in advance
const MAILGUN_MAX_SCHEDULE_HOURS = 24;

// Online bookings are first consultations, which are 30 minutes long.
const ONLINE_CONSULTATION_DURATION_MS = 30 * 60 * 1000;

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  scheduledFor?: Date | null
): Promise<{ sent: boolean; scheduled: boolean; reason?: string }> {
  if (!mailgunApiKey || !mailgunDomain) {
    console.log("Mailgun not configured, skipping email send");
    return { sent: false, scheduled: false, reason: "Mailgun not configured" };
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);

  // Check if we can use Mailgun's scheduled delivery (must be within 24 hours)
  const now = Date.now();
  const maxScheduleTime = now + MAILGUN_MAX_SCHEDULE_HOURS * 60 * 60 * 1000;
  
  if (scheduledFor && scheduledFor.getTime() > now) {
    if (scheduledFor.getTime() <= maxScheduleTime) {
      // Within 24 hours - use Mailgun's scheduled delivery
      formData.append("o:deliverytime", scheduledFor.toUTCString());
    } else {
      // Beyond 24 hours - don't send now, will be handled by cron job from scheduled_emails table
      console.log(`Email scheduled for ${scheduledFor.toISOString()} is beyond Mailgun's 24-hour limit. Will be sent by cron job.`);
      return { sent: false, scheduled: true, reason: "Beyond 24-hour limit, stored for cron job" };
    }
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
  
  return { sent: true, scheduled: !!scheduledFor };
}

function formatDate(date: Date): string {
  return formatSwissDateWithWeekday(date);
}

function formatTime(date: Date): string {
  return formatSwissTimeAmPm(date);
}

function formatDoctorNameWithTitle(name: string): string {
  // Add "Dr." prefix if not already present
  if (!name) return name;
  if (name.toLowerCase().startsWith("dr.") || name.toLowerCase().startsWith("dr ")) {
    return name;
  }
  return `Dr. ${name}`;
}

function generatePatientConfirmationEmail(
  patientName: string,
  doctorName: string,
  appointmentDate: Date,
  service: string,
  location: string | null
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: #1e293b; padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <img src="https://cdn.jsdelivr.net/gh/sharyyoru/aestheticclinic@main/public/logos/aesthetics-logo.svg" alt="Aesthetics Clinic" style="height: 40px; margin-bottom: 20px; filter: brightness(0) invert(1);">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Appointment Confirmed!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Thank you for booking with us</p>
  </div>
  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="font-size: 18px; margin-bottom: 24px; color: #1e293b;">Dear <strong>${patientName}</strong>,</p>
    <p style="margin-bottom: 24px; color: #475569;">Your appointment has been successfully scheduled. We look forward to seeing you!</p>
    
    <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Appointment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Doctor</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${doctorName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${formatDate(appointmentDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${formatTime(appointmentDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Service</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${service}</td>
        </tr>
        ${location ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${location}</td>
        </tr>
        ` : ""}
      </table>
    </div>
    
    <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #1e293b; margin-bottom: 24px;">
      <p style="margin: 0; color: #1e293b; font-size: 14px;">
        <strong>Important:</strong> If you need to reschedule or cancel your appointment, please contact us at least 24 hours in advance.
      </p>
    </div>
    
    <p style="margin-bottom: 0; color: #475569;">Best regards,<br><strong style="color: #1e293b;">Aesthetics Clinic Team</strong></p>
  </div>
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Aesthetics Clinic. All rights reserved.</p>
  </div>
</body>
</html>`;
}

function generatePatientReminderEmail(
  patientName: string,
  doctorName: string,
  appointmentDate: Date,
  service: string,
  location: string | null
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: #1e293b; padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <img src="https://cdn.jsdelivr.net/gh/sharyyoru/aestheticclinic@main/public/logos/aesthetics-logo.svg" alt="Aesthetics Clinic" style="height: 40px; margin-bottom: 20px; filter: brightness(0) invert(1);">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">⏰ Appointment Reminder</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your appointment is tomorrow</p>
  </div>
  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="font-size: 18px; margin-bottom: 24px; color: #1e293b;">Dear <strong>${patientName}</strong>,</p>
    <p style="margin-bottom: 24px; color: #475569;">This is a friendly reminder that you have an appointment scheduled for <strong>tomorrow</strong>.</p>
    
    <div style="background: #fffbeb; padding: 24px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Appointment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Doctor</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${doctorName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${formatDate(appointmentDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${formatTime(appointmentDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Service</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${service}</td>
        </tr>
        ${location ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${location}</td>
        </tr>
        ` : ""}
      </table>
    </div>
    
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; color: #475569; font-size: 14px;">
        If you need to reschedule or cancel, please contact us as soon as possible at <strong>+41 22 732 22 23</strong>.
      </p>
    </div>
    
    <p style="margin-bottom: 0; color: #475569;">We look forward to seeing you!<br><strong style="color: #1e293b;">Aesthetics Clinic Team</strong></p>
  </div>
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Aesthetics Clinic. All rights reserved.</p>
  </div>
</body>
</html>`;
}

function generateDoctorNotificationEmail(
  doctorName: string,
  patientName: string,
  patientEmail: string,
  patientPhone: string | null,
  appointmentDate: Date,
  service: string,
  notes: string | null,
  location: string | null
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: #1e293b; padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <img src="https://cdn.jsdelivr.net/gh/sharyyoru/aestheticclinic@main/public/logos/aesthetics-logo.svg" alt="Aesthetics Clinic" style="height: 40px; margin-bottom: 20px; filter: brightness(0) invert(1);">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">New Appointment Booked</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Via Online Booking</p>
  </div>
  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="font-size: 18px; margin-bottom: 24px; color: #1e293b;">Hi <strong>${doctorName}</strong>,</p>
    <p style="margin-bottom: 24px; color: #475569;">A new appointment has been booked through the online booking system.</p>
    
    <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Patient Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Name</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${patientName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${patientEmail}</td>
        </tr>
        ${patientPhone ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Phone</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${patientPhone}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <div style="background: #f1f5f9; padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #cbd5e1;">
      <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Appointment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${formatDate(appointmentDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${formatTime(appointmentDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Service</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${service}</td>
        </tr>
        ${location ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location</td>
          <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right;">${location}</td>
        </tr>
        ` : ""}
      </table>
    </div>
    
    ${notes ? `
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">Patient Notes:</p>
      <p style="margin: 0; color: #1e293b; font-size: 14px;">${notes}</p>
    </div>
    ` : ""}
    
    <p style="margin-bottom: 0; color: #475569;">This appointment has been added to your agenda.</p>
  </div>
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Aesthetics Clinic. All rights reserved.</p>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookingPayload;

    const {
      firstName,
      lastName,
      email,
      phone,
      appointmentDate,
      service,
      doctorSlug,
      doctorName,
      doctorEmail,
      notes,
      location,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !appointmentDate || !service || !doctorSlug || !doctorName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const patientName = `${firstName} ${lastName}`;
    // The public booking pages already send an ISO UTC timestamp.
    // Only interpret naive datetime-local strings as Swiss local time.
    const appointmentDateObj = parseBookingAppointmentDate(appointmentDate);

    if (Number.isNaN(appointmentDateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid appointment date" },
        { status: 400 }
      );
    }

    // Look up the provider ID for this doctor to filter appointments correctly
    let providerId: string | null = null;
    const doctorNameClean = doctorName.replace(/^Dr\.\s*/i, "").trim();
    
    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .or(`name.ilike.*${doctorNameClean}*,name.ilike.*${doctorNameClean.split(" ")[0]}*`)
      .limit(1)
      .single();
    
    if (provider) {
      providerId = provider.id;
    }

    // Doctor-specific capacity: XT and CR can have 3 concurrent, others have 1
    const MULTI_CAPACITY_DOCTORS = ["xavier-tenorio", "cesar-rodriguez"];
    const maxCapacity = MULTI_CAPACITY_DOCTORS.includes(doctorSlug) ? 3 : 1;

    // Check if time slot has capacity for this doctor
    // NEW: Check for any OVERLAPPING appointments, not just appointments starting in this slot
    // This prevents double-booking when existing appointments overlap with the requested time
    const requestedStart = new Date(appointmentDateObj);
    const requestedEnd = new Date(appointmentDateObj.getTime() + ONLINE_CONSULTATION_DURATION_MS); // 30 min consultation

    console.log(`[Booking] Checking availability for ${doctorName} (${doctorSlug}) at ${requestedStart.toISOString()}`);
    console.log(`[Booking] Requested slot: ${requestedStart.toISOString()} - ${requestedEnd.toISOString()}`);
    console.log(`[Booking] Max capacity for this doctor: ${maxCapacity}`);
    console.log(`[Booking] Provider ID found: ${providerId}`);

    // Find all appointments that OVERLAP with the requested time slot
    // Overlap condition: existing.start < requested.end AND existing.end > requested.start
    const { data: existingAppointments, error: fetchError } = await supabase
      .from("appointments")
      .select("id, no_patient, provider_id, reason, start_time, end_time")
      .lt("start_time", requestedEnd.toISOString())  // existing starts before requested ends
      .gt("end_time", requestedStart.toISOString())  // existing ends after requested starts
      .neq("status", "cancelled");

    if (fetchError) {
      console.error("[Booking] Error fetching appointments:", fetchError);
    }

    console.log(`[Booking] Found ${existingAppointments?.length || 0} total appointments in time range`);

    // Filter to only this doctor's appointments
    // PAUSE/no_patient appointments now BLOCK booking (included in capacity check)
    const doctorAppointments = (existingAppointments || []).filter((apt) => {
      // Check by provider_id first (most reliable)
      if (providerId && apt.provider_id === providerId) {
        return true;
      }
      
      // Fallback: check the reason field for [Doctor: Name] pattern
      if (apt.reason) {
        const match = apt.reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
        if (match && match[1].toLowerCase().includes(doctorNameClean.toLowerCase())) {
          return true;
        }
      }
      
      return false;
    });

    console.log(`[Booking] Found ${doctorAppointments.length} appointments for ${doctorName}`);
    console.log(`[Booking] Appointments:`, doctorAppointments.map(a => ({ id: a.id, provider_id: a.provider_id, reason: a.reason?.substring(0, 50) })));

    // Only block if provider has reached maximum capacity
    if (doctorAppointments.length >= maxCapacity) {
      console.log(`[Booking] REJECTED: ${doctorAppointments.length} >= ${maxCapacity}`);
      return NextResponse.json(
        { error: `This time slot is fully booked (${doctorAppointments.length}/${maxCapacity}). Please choose another time.` },
        { status: 409 }
      );
    }

    console.log(`[Booking] ALLOWED: ${doctorAppointments.length} < ${maxCapacity}`);

    // Check if patient exists or create new
    let patientId: string;
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    let isNewPatient = false;
    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      // Create new patient
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase(),
          phone: phone || null,
          source: "online_booking",
        })
        .select("id")
        .single();

      if (patientError || !newPatient) {
        console.error("Error creating patient:", patientError);
        return NextResponse.json(
          { error: "Failed to create patient record" },
          { status: 500 }
        );
      }

      patientId = newPatient.id;
      isNewPatient = true;
    }

    // Calculate end time (30 min first-consultation duration)
    const endDateObj = new Date(appointmentDateObj.getTime() + ONLINE_CONSULTATION_DURATION_MS);

    // providerId was already looked up earlier for availability check
    // If it wasn't found earlier, try one more lookup method
    if (!providerId) {
      const simpleName = doctorName.replace(/^Dr\.\s*/i, "");
      const { data: providerBySimpleName } = await supabase
        .from("providers")
        .select("id")
        .ilike("name", `%${simpleName.split(" ")[0]}%`)
        .single();
      
      if (providerBySimpleName) {
        providerId = providerBySimpleName.id;
        console.log("Found provider by simple name:", providerBySimpleName.id);
      } else {
        console.log("Provider not found for doctor:", doctorName, "- appointment will not be linked to a specific provider");
      }
    } else {
      console.log("Using provider:", providerId, "for doctor:", doctorName);
    }

    // Build reason field - include [Doctor: Name] for calendar filtering
    const reason = `${service}${notes ? ` - ${notes}` : ""} [Doctor: ${doctorName.replace("Dr. ", "")}] [Online Booking]`;

    // Create the appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        start_time: appointmentDateObj.toISOString(),
        end_time: endDateObj.toISOString(),
        reason,
        location: location || "Geneva",
        status: "scheduled",
        source: "online_booking",
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      console.error("Error creating appointment:", appointmentError);
      return NextResponse.json(
        { error: "Failed to create appointment" },
        { status: 500 }
      );
    }

    // Create "Organize Anesthesia" task assigned to aileen.bodenmann@aesthetics-ge.ch
    try {
      const { data: aileenUser } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("email", "aileen.bodenmann@aesthetics-ge.ch")
        .single();

      const { error: taskError } = await supabase
        .from("tasks")
        .insert({
          name: "Organize Anesthesia",
          content: `Auto-created on appointment booking for patient: ${patientName}`,
          status: "not_started",
          priority: "medium",
          type: "todo",
          activity_date: appointmentDateObj.toISOString(),
          assigned_user_id: aileenUser?.id || null,
          assigned_user_name: aileenUser?.full_name || aileenUser?.email || "aileen.bodenmann@aesthetics-ge.ch",
          patient_id: patientId,
        });

      if (taskError) {
        console.error("✗ Failed to create Organize Anesthesia task:", taskError);
      } else {
        console.log("✓ Created Organize Anesthesia task for patient:", patientId);
      }
    } catch (err) {
      console.error("✗ Error creating Organize Anesthesia task:", err);
    }

    // Move the patient's deal to "Appointment Set" (or create it there if none
    // exists) so the booked appointment is reflected automatically. This avoids
    // staff having to drag the deal manually, which would open the appointment
    // modal and create a duplicate appointment.
    try {
      const dealSync = await syncDealToAppointmentSet(supabase, {
        patientId,
        title: `${patientName} - ${service}`,
        notes: `Booked via online booking on ${formatDate(appointmentDateObj)} at ${formatTime(appointmentDateObj)} with ${doctorName}`,
        location: location || null,
      });
      console.log("✓ Deal synced to Appointment Set:", dealSync);
    } catch (err) {
      console.error("✗ Failed to sync deal to Appointment Set:", err);
      // Don't fail the booking if deal sync fails
    }

    // If this is a new patient, trigger the patient-created workflow to create
    // the sales task. We pass skip_deal_creation so it does NOT create a
    // separate "Request for Information" deal — the booking already places the
    // deal in "Appointment Set" above.
    if (isNewPatient) {
      try {
        // Get the base URL from the request
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        
        await fetch(`${baseUrl}/api/workflows/patient-created`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: patientId, skip_deal_creation: true }),
        });
        console.log("✓ Triggered patient-created workflow for new patient:", patientId);
      } catch (err) {
        console.error("✗ Failed to trigger patient-created workflow:", err);
        // Don't fail the booking if workflow trigger fails
      }
    }

    // Send confirmation email to patient
    console.log("Attempting to send confirmation emails...");
    console.log("Mailgun configured:", !!mailgunApiKey && !!mailgunDomain);
    console.log("Patient email:", email);
    console.log("Doctor email:", doctorEmail);
    
    // Format doctor name with "Dr." title for all patient-facing emails
    const formattedDoctorName = formatDoctorNameWithTitle(doctorName);
    
    try {
      const patientEmailHtml = generatePatientConfirmationEmail(
        patientName,
        formattedDoctorName,
        appointmentDateObj,
        service,
        location || null
      );
      await sendEmail(
        email,
        `Appointment Confirmed - ${formatDate(appointmentDateObj)} at ${formatTime(appointmentDateObj)}`,
        patientEmailHtml
      );
      console.log("✓ Patient confirmation email sent successfully to:", email);
    } catch (err) {
      console.error("✗ Error sending patient email:", err);
    }

    // Send notification email to doctor (use original name for internal email)
    try {
      const doctorEmailHtml = generateDoctorNotificationEmail(
        doctorName,
        patientName,
        email,
        phone || null,
        appointmentDateObj,
        service,
        notes || null,
        location || null
      );
      await sendEmail(
        doctorEmail,
        `New Appointment: ${patientName} - ${formatDate(appointmentDateObj)}`,
        doctorEmailHtml
      );
      console.log("✓ Doctor notification email sent successfully to:", doctorEmail);
    } catch (err) {
      console.error("✗ Error sending doctor email:", err);
    }

    // Schedule reminder email for 1 day before appointment
    const reminderDate = new Date(appointmentDateObj);
    reminderDate.setDate(reminderDate.getDate() - 1);

    // Only schedule if reminder date is in the future
    if (reminderDate.getTime() > Date.now()) {
      // Run reminder scheduling in background (don't block the response)
      const scheduleReminder = async () => {
        try {
          const reminderHtml = generatePatientReminderEmail(
            patientName,
            formattedDoctorName,
            appointmentDateObj,
            service,
            location || null
          );

          // Store in scheduled_emails as pending. The send-scheduled-emails
          // cron is the single sender and validates the appointment is still
          // active (not cancelled/rescheduled/past) right before sending.
          //
          // We intentionally do NOT hand the reminder to Mailgun's scheduled
          // delivery (o:deliverytime) here: a Mailgun-scheduled message cannot
          // be recalled, so it would still be delivered even if the
          // appointment is later cancelled or rescheduled.
          await supabase.from("scheduled_emails").insert({
            patient_id: patientId,
            appointment_id: appointment.id,
            recipient_type: "patient",
            recipient_email: email,
            subject: `Reminder: Your Appointment Tomorrow - ${formatDate(appointmentDateObj)} at ${formatTime(appointmentDateObj)}`,
            body: reminderHtml,
            scheduled_for: reminderDate.toISOString(),
            status: "pending",
          });

          console.log("✓ Patient reminder queued (cron-validated) for:", reminderDate.toISOString());
        } catch (err) {
          console.error("✗ Error scheduling patient reminder:", err);
        }
      };

      // Fire and forget - don't block the response
      scheduleReminder().catch(err => {
        console.error("Error in reminder scheduling:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      appointmentId: appointment.id,
      message: "Appointment booked successfully",
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    return NextResponse.json(
      { error: "Failed to book appointment", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
