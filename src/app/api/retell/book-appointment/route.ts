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
    const body = (await request.json()) as BookingRequest;
    const { call_id, agent_id, patient, appointment } = body;

    // Validate required fields
    if (!call_id || !patient?.phone || !appointment?.service_name || !appointment?.date_time_iso) {
      return NextResponse.json(
        { error: "Missing required fields: call_id, patient.phone, appointment.service_name, appointment.date_time_iso" },
        { status: 400 }
      );
    }

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

    const doctorAppointments = (existingAppointments || []).filter((apt) => {
      if (apt.no_patient === true) return false;
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
    const normalizedPhone = patient.phone.replace(/[^\d+]/g, "");
    const phoneVariants = [normalizedPhone, normalizedPhone.replace(/^\+/, ""), normalizedPhone.slice(-9)];

    let existingPatient: { id: string } | null = null;
    for (const phoneVariant of phoneVariants) {
      if (!phoneVariant) continue;
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

    if (!existingPatient && patient.email) {
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
      call_id,
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
        return NextResponse.json(
          { error: "Failed to create patient" },
          { status: 500 }
        );
      }
      patientId = newPatient.id;
    }

    // Create the appointment
    const endTime = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    const reason = `${service.name}${appointment.notes ? ` - ${appointment.notes}` : ""} [Doctor: ${doctorName}] [Retell AI Booking] [Call: ${call_id}]`;

    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        start_time: appointmentDate.toISOString(),
        end_time: endTime.toISOString(),
        reason,
        location: "Geneva",
        status: "scheduled",
        source: "retell_ai",
      })
      .select("id")
      .single();

    if (aptError || !apt) {
      console.error("[Retell Book] Failed to create appointment:", aptError);
      return NextResponse.json(
        { error: "Failed to create appointment" },
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
          notes: `Booked via Retell AI Call\nCall ID: ${call_id}\nAppointment: ${formatSwissDateWithWeekday(appointmentDate)} at ${formatSwissTimeAmPm(appointmentDate)}`,
        });
      }
    }

    // Send confirmation email if email provided
    if (patient.email) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e293b;">Appointment Confirmed</h2>
  <p>Dear ${patient.first_name || "Patient"},</p>
  <p>Your appointment has been booked through our automated booking system.</p>
  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Service:</strong> ${service.name}</p>
    <p><strong>Date:</strong> ${formatSwissDateWithWeekday(appointmentDate)}</p>
    <p><strong>Time:</strong> ${formatSwissTimeAmPm(appointmentDate)}</p>
    <p><strong>Doctor:</strong> ${doctorName}</p>
    <p><strong>Location:</strong> Geneva</p>
  </div>
  <p>If you need to reschedule, please call us at +41 22 732 22 23.</p>
  <p>Main Telephone Number: +41 22 732 22 23<br>
  Main Email Address: info@aesthetics-ge.ch<br>
  Book an appointment: https://aestheticclinic.vercel.app/book-appointment/location</p>
</body>
</html>`;

      await sendEmail(
        patient.email,
        `Appointment Confirmed - ${formatSwissDateWithWeekday(appointmentDate)}`,
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
        date: formatSwissDateWithWeekday(appointmentDate),
        time: formatSwissTimeAmPm(appointmentDate),
        datetime_iso: appointmentDate.toISOString(),
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
