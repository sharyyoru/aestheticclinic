import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatSwissDateWithWeekday, formatSwissTimeAmPm, parseSwissDateTimeLocal } from "@/lib/swissTimezone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

// Doctor-specific capacity
const MULTI_CAPACITY_DOCTORS = ["xavier-tenorio", "cesar-rodriguez"];

// Clinic location details for emails
const LOCATION_DETAILS: Record<string, { name: string; address: string; city: string }> = {
  rhone: { 
    name: "Rhône", 
    address: "Rue du Rhône 17", 
    city: "1204 Geneva" 
  },
  champel: { 
    name: "Champel", 
    address: "Avenue de Champel 4", 
    city: "1206 Geneva" 
  },
  gstaad: { 
    name: "Gstaad", 
    address: "Promenade 52", 
    city: "3780 Gstaad" 
  },
  montreux: { 
    name: "Montreux", 
    address: "Grand-Rue 80", 
    city: "1820 Montreux" 
  },
};

export const runtime = "nodejs";

type BookingRequest = {
  call_id: string;
  agent_id: string;
  patient: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  appointment: {
    service_name: string;
    doctor_name?: string;
    date_time_iso: string;
    location?: string; // rhone, champel, gstaad, montreux
    notes?: string;
  };
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!mailgunApiKey || !mailgunDomain) {
    console.log("[Retell Book] Mailgun not configured, skipping email");
    return;
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
      console.error("[Retell Book] Email error:", response.status, text);
    }
  } catch (err) {
    console.error("[Retell Book] Email send failed:", err);
  }
}

/**
 * POST /api/retell/book-appointment
 * 
 * Books an appointment from a Retell AI call and records it.
 * This is called by the Retell AI when a patient confirms a booking during a call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { call_id, agent_id, patient, appointment, patient_id } = body;

    // Validate required fields - only service and date are truly required
    if (!appointment?.service_name || !appointment?.date_time_iso) {
      return NextResponse.json(
        { error: "Missing required fields: appointment.service_name, appointment.date_time_iso" },
        { status: 400 }
      );
    }
    
    // Use defaults for missing optional fields
    const effectiveCallId = call_id || `ai-${Date.now()}`;
    const effectivePhone = patient?.phone || "unknown";
    
    // If patient_id is provided, use it directly (from dynamic variables)
    const providedPatientId = patient_id || null;
    console.log(`[Retell Book] Provided patient_id: ${providedPatientId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse appointment date
    const appointmentDate = new Date(appointment.date_time_iso);
    if (Number.isNaN(appointmentDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid appointment date format" },
        { status: 400 }
      );
    }

    // Find the service
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, base_price")
      .ilike("name", `%${appointment.service_name}%`)
      .limit(1)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: `Service not found: ${appointment.service_name}` },
        { status: 404 }
      );
    }

    // Look up provider/doctor
    let providerId: string | null = null;
    let doctorName = appointment.doctor_name || "Unassigned";
    let doctorSlug = "";

    if (appointment.doctor_name) {
      const doctorNameClean = appointment.doctor_name.replace(/^Dr\.\s*/i, "").trim();
      const { data: provider } = await supabase
        .from("providers")
        .select("id, name, slug, email")
        .or(`name.ilike.*${doctorNameClean}*,name.ilike.*${doctorNameClean.split(" ")[0]}*`)
        .limit(1)
        .single();

      if (provider) {
        providerId = provider.id;
        doctorName = provider.name;
        doctorSlug = provider.slug || "";
      }
    }

    // Check capacity
    const maxCapacity = MULTI_CAPACITY_DOCTORS.includes(doctorSlug) ? 3 : 1;
    const slotStart = new Date(appointmentDate);
    const slotEnd = new Date(appointmentDate.getTime() + 30 * 60 * 1000);

    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("id, provider_id, reason, no_patient")
      .gte("start_time", slotStart.toISOString())
      .lt("start_time", slotEnd.toISOString())
      .neq("status", "cancelled");

    // PAUSE/no_patient appointments now BLOCK booking (included in capacity check)
    const doctorAppointments = (existingAppointments || []).filter((apt) => {
      if (providerId && apt.provider_id === providerId) return true;
      if (apt.reason) {
        const match = apt.reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
        if (match && match[1].toLowerCase().includes(doctorName.toLowerCase())) {
          return true;
        }
      }
      return false;
    });

    if (doctorAppointments.length >= maxCapacity) {
      return NextResponse.json(
        { error: "Time slot no longer available", code: "SLOT_UNAVAILABLE" },
        { status: 409 }
      );
    }

    // Find or create patient
    let patientId: string;
    let existingPatient: { id: string } | null = null;
    const normalizedPhone = effectivePhone.replace(/[^\d+]/g, "");
    
    // FIRST: If patient_id is provided directly, use it
    if (providedPatientId) {
      const { data: directPatient } = await supabase
        .from("patients")
        .select("id")
        .eq("id", providedPatientId)
        .single();
      
      if (directPatient) {
        existingPatient = directPatient;
        console.log(`[Retell Book] Using provided patient_id: ${providedPatientId}`);
      }
    }
    
    // SECOND: Try to find by phone
    if (!existingPatient) {
      const phoneVariants = [normalizedPhone, normalizedPhone.replace(/^\+/, ""), normalizedPhone.slice(-9)];

      for (const phoneVariant of phoneVariants) {
        if (!phoneVariant || phoneVariant === "unknown") continue;
        const { data } = await supabase
          .from("patients")
          .select("id")
          .or(`phone.eq.${phoneVariant},phone.ilike.%${phoneVariant.slice(-9)}%`)
          .limit(1)
          .maybeSingle();
        if (data) {
          existingPatient = data;
          break;
        }
      }
    }

    // THIRD: Try to find by email
    if (!existingPatient && patient?.email) {
      const { data } = await supabase
        .from("patients")
        .select("id")
        .eq("email", patient.email.toLowerCase())
        .limit(1)
        .maybeSingle();
      if (data) existingPatient = data;
    }

    const callInfo = {
      source: "Retell AI Booking",
      call_id: effectiveCallId,
      agent_id,
      service: service.name,
      appointment_date: appointmentDate.toISOString(),
      booked_at: new Date().toISOString(),
    };

    if (existingPatient) {
      patientId = existingPatient.id;
      // Update patient with latest info
      await supabase
        .from("patients")
        .update({
          ...(patient.first_name && { first_name: patient.first_name }),
          ...(patient.last_name && { last_name: patient.last_name }),
          ...(patient.email && { email: patient.email.toLowerCase() }),
          source: "Retell AI Agent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientId);
    } else {
      // Create new patient
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          first_name: patient.first_name || "Unknown",
          last_name: patient.last_name || "Caller",
          email: patient.email ? patient.email.toLowerCase() : null,
          phone: normalizedPhone,
          source: "Retell AI Agent",
          lifecycle_stage: "lead",
          notes: `[Retell AI Booking] ${JSON.stringify(callInfo, null, 2)}`,
        })
        .select("id")
        .single();

      if (patientError || !newPatient) {
        console.error("[Retell Book] Failed to create patient:", patientError);
        return NextResponse.json(
          { error: "Failed to create patient", details: patientError?.message, code: patientError?.code },
          { status: 500 }
        );
      }
      patientId = newPatient.id;
    }

    // Get location details
    const locationId = appointment.location?.toLowerCase() || "rhone";
    const locationInfo = LOCATION_DETAILS[locationId] || LOCATION_DETAILS.rhone;
    const fullLocation = `${locationInfo.name} - ${locationInfo.address}, ${locationInfo.city}`;

    // Create the appointment
    const endTime = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    const reason = `${service.name}${appointment.notes ? ` - ${appointment.notes}` : ""} [Doctor: ${doctorName}] [Location: ${locationInfo.name}] [Retell AI Booking] [Call: ${effectiveCallId}]`;

    // Build appointment insert data - don't include source if column doesn't exist
    const appointmentInsert: Record<string, unknown> = {
      patient_id: patientId,
      start_time: appointmentDate.toISOString(),
      end_time: endTime.toISOString(),
      reason,
      location: fullLocation,
      status: "scheduled",
    };
    
    // Only include provider_id if we found one (avoid FK constraint issues)
    if (providerId) {
      appointmentInsert.provider_id = providerId;
    }

    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .insert(appointmentInsert)
      .select("id")
      .single();

    if (aptError || !apt) {
      console.error("[Retell Book] Failed to create appointment:", aptError);
      return NextResponse.json(
        { error: "Failed to create appointment", details: aptError?.message, code: aptError?.code },
        { status: 500 }
      );
    }

    // Create or update deal for this booking
    const { data: requestStage } = await supabase
      .from("deal_stages")
      .select("id")
      .ilike("name", "%request for information%")
      .limit(1)
      .maybeSingle();

    if (requestStage) {
      const { data: existingDeals } = await supabase
        .from("deals")
        .select("id")
        .eq("patient_id", patientId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existingDeals || existingDeals.length === 0) {
        await supabase.from("deals").insert({
          patient_id: patientId,
          stage_id: requestStage.id,
          title: `${patient.first_name || "Unknown"} ${patient.last_name || "Caller"} - ${service.name}`,
          pipeline: "Lead to Surgery",
          service_id: service.id,
          notes: `Booked via Retell AI Call\nCall ID: ${effectiveCallId}\nAppointment: ${formatSwissDateWithWeekday(appointmentDate)} at ${formatSwissTimeAmPm(appointmentDate)}`,
        });
      }
    }

    // Send confirmation email if email provided
    if (patient.email) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0f172a; font-size: 24px; margin: 0;">Aesthetics Clinic</h1>
    <p style="color: #64748b; margin: 5px 0 0 0;">Geneva • Gstaad • Montreux</p>
  </div>
  
  <h2 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">✓ Appointment Confirmed</h2>
  
  <p>Dear ${patient.first_name || "Patient"},</p>
  <p>Your appointment has been successfully booked. We look forward to seeing you!</p>
  
  <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #0ea5e9;">
    <h3 style="margin: 0 0 15px 0; color: #0f172a;">Appointment Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b; width: 100px;">Service:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${service.name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Date:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${formatSwissDateWithWeekday(appointmentDate)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Time:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${formatSwissTimeAmPm(appointmentDate)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Doctor:</td>
        <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${doctorName}</td>
      </tr>
    </table>
  </div>
  
  <div style="background: #fefce8; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #fef08a;">
    <h3 style="margin: 0 0 10px 0; color: #854d0e; font-size: 16px;">📍 Location</h3>
    <p style="margin: 0; color: #713f12; font-weight: 600;">${locationInfo.name}</p>
    <p style="margin: 5px 0 0 0; color: #a16207;">${locationInfo.address}<br>${locationInfo.city}</p>
  </div>
  
  <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #bbf7d0;">
    <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px;">📞 Need to reschedule?</h3>
    <p style="margin: 0; color: #15803d;">Call us at <a href="tel:+41227322223" style="color: #166534; font-weight: 600;">+41 22 732 22 23</a></p>
    <p style="margin: 5px 0 0 0; color: #15803d;">Email: <a href="mailto:info@aesthetics-ge.ch" style="color: #166534;">info@aesthetics-ge.ch</a></p>
  </div>
  
  <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px;">
    Thank you for choosing Aesthetics Clinic.<br>
    Your first consultation is complimentary.
  </p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
  
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    Aesthetics Clinic • Geneva, Gstaad, Montreux<br>
    <a href="https://aestheticclinic.vercel.app/book-appointment/location" style="color: #0ea5e9;">Book Online</a>
  </p>
</body>
</html>`;

      await sendEmail(
        patient.email,
        `✓ Appointment Confirmed - ${formatSwissDateWithWeekday(appointmentDate)} at ${locationInfo.name}`,
        emailHtml
      );
    }

    // Return success with booking details
    return NextResponse.json({
      success: true,
      booking: {
        appointment_id: apt.id,
        patient_id: patientId,
        service: service.name,
        doctor: doctorName,
        location: locationInfo.name,
        location_address: `${locationInfo.address}, ${locationInfo.city}`,
        date: formatSwissDateWithWeekday(appointmentDate),
        time: formatSwissTimeAmPm(appointmentDate),
        datetime_iso: appointmentDate.toISOString(),
        email_sent: !!patient.email,
      },
      message: "Appointment booked successfully via Retell AI",
    });

  } catch (error) {
    console.error("[Retell Book] Error:", error);
    return NextResponse.json(
      { error: "Failed to book appointment", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
