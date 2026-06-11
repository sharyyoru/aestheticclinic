import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPatientSession } from "@/lib/patientAppAuth";

/**
 * Patient App data API.
 * Every query is strictly scoped to the authenticated patient's ID
 * extracted from the verified session token — never from client input.
 */

export async function GET(request: Request) {
  const session = getPatientSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patientId = session.patientId;
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") || "overview";

  try {
    switch (section) {
      case "overview":
        return NextResponse.json(await getOverview(patientId));
      case "appointments":
        return NextResponse.json(await getAppointments(patientId));
      case "records":
        return NextResponse.json(await getRecords(patientId));
      case "photos":
        return NextResponse.json(await getPhotos(patientId));
      case "profile":
        return NextResponse.json(await getProfile(patientId));
      default:
        return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }
  } catch (error) {
    console.error(`patientapp data error (${section}):`, error);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}

async function getOverview(patientId: string) {
  const nowIso = new Date().toISOString();

  const [patientRes, upcomingRes, prescriptionsCountRes, consultationsCountRes] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email, avatar_url")
      .eq("id", patientId)
      .single(),
    supabaseAdmin
      .from("appointments")
      .select("id, start_time, end_time, status, reason, location")
      .eq("patient_id", patientId)
      .gte("start_time", nowIso)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(3),
    supabaseAdmin
      .from("patient_prescriptions")
      .select("journal_entry_id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("active", true),
    supabaseAdmin
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("is_archived", false)
      .neq("record_type", "invoice"),
  ]);

  return {
    patient: patientRes.data,
    upcomingAppointments: (upcomingRes.data || []).map(cleanAppointment),
    stats: {
      prescriptions: prescriptionsCountRes.count || 0,
      consultations: consultationsCountRes.count || 0,
    },
  };
}

async function getAppointments(patientId: string) {
  const nowIso = new Date().toISOString();

  const [upcomingRes, pastRes] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("id, start_time, end_time, status, reason, location")
      .eq("patient_id", patientId)
      .gte("start_time", nowIso)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(25),
    supabaseAdmin
      .from("appointments")
      .select("id, start_time, end_time, status, reason, location")
      .eq("patient_id", patientId)
      .lt("start_time", nowIso)
      .order("start_time", { ascending: false })
      .limit(25),
  ]);

  return {
    upcoming: (upcomingRes.data || []).map(cleanAppointment),
    past: (pastRes.data || []).map(cleanAppointment),
  };
}

async function getRecords(patientId: string) {
  // Latest intake submission (for submission-scoped tables)
  const { data: submissions } = await supabaseAdmin
    .from("patient_intake_submissions")
    .select("id, status, completed_at, started_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1);

  const submissionId = submissions?.[0]?.id ?? null;

  const [healthRes, prefsRes, measurementsRes, treatmentAreasRes, consultationsRes, prescriptionsRes, consultDataRes] =
    await Promise.all([
      supabaseAdmin
        .from("patient_health_background")
        .select(
          "weight_kg, height_cm, bmi, known_illnesses, previous_surgeries, allergies, cigarettes, alcohol_consumption, sports_activity, medications, general_practitioner, gynecologist",
        )
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("patient_intake_preferences")
        .select("preferred_language, preferred_contact_method")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      submissionId
        ? supabaseAdmin
            .from("patient_measurements")
            .select("height_cm, weight_kg, bmi, chest_cm, waist_cm, hips_cm")
            .eq("submission_id", submissionId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      submissionId
        ? supabaseAdmin
            .from("patient_treatment_areas")
            .select("area_name, area_category, specific_concerns, priority")
            .eq("submission_id", submissionId)
            .order("priority", { ascending: true })
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("consultations")
        .select("id, title, content, record_type, doctor_name, scheduled_at")
        .eq("patient_id", patientId)
        .eq("is_archived", false)
        .neq("record_type", "invoice")
        .order("scheduled_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("patient_prescriptions")
        .select(
          "journal_entry_id, product_name, product_type, amount_morning, amount_noon, amount_evening, amount_night, intake_note, quantity, intake_from_date, prescription_sheet_id",
        )
        .eq("patient_id", patientId)
        .eq("active", true)
        .order("intake_from_date", { ascending: false }),
      supabaseAdmin
        .from("patient_consultation_data")
        .select("id, consultation_type, selected_areas, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
    ]);

  return {
    intake: {
      submission: submissions?.[0] ?? null,
      healthBackground: healthRes.data ?? null,
      preferences: prefsRes.data ?? null,
      measurements: measurementsRes.data ?? null,
      treatmentAreas: treatmentAreasRes.data ?? [],
      consultationForms: consultDataRes.data ?? [],
    },
    consultations: consultationsRes.data ?? [],
    prescriptions: prescriptionsRes.data ?? [],
  };
}

async function getPhotos(patientId: string) {
  const photos: Array<{ id: string; url: string; label: string; group: string; uploadedAt: string | null }> = [];

  // Intake photos (patient-intake-photos bucket, rows in patient_intake_photos)
  const { data: intakePhotos } = await supabaseAdmin
    .from("patient_intake_photos")
    .select("id, photo_type, storage_path, file_name, uploaded_at")
    .eq("patient_id", patientId)
    .order("uploaded_at", { ascending: false });

  for (const photo of intakePhotos || []) {
    const { data: urlData } = await supabaseAdmin.storage
      .from("patient-intake-photos")
      .createSignedUrl(photo.storage_path, 3600);
    if (urlData?.signedUrl) {
      photos.push({
        id: photo.id,
        url: urlData.signedUrl,
        label: photo.photo_type || photo.file_name || "Photo",
        group: "Intake",
        uploadedAt: photo.uploaded_at,
      });
    }
  }

  // Consultation photos (patient_document bucket, by folder convention)
  for (const consultType of ["liposuction", "face", "breast"]) {
    const folderPath = `${patientId}/consultation_photos/${consultType}`;
    const { data: files } = await supabaseAdmin.storage
      .from("patient_document")
      .list(folderPath, { limit: 50 });

    for (const file of files || []) {
      if (file.name === ".keep") continue;
      const fullPath = `${folderPath}/${file.name}`;
      const { data: urlData } = await supabaseAdmin.storage
        .from("patient_document")
        .createSignedUrl(fullPath, 3600);
      if (urlData?.signedUrl) {
        photos.push({
          id: fullPath,
          url: urlData.signedUrl,
          label: file.name.split("_")[0].replace(/-/g, " "),
          group: consultType.charAt(0).toUpperCase() + consultType.slice(1),
          uploadedAt: file.created_at ?? null,
        });
      }
    }
  }

  return { photos };
}

async function getProfile(patientId: string) {
  const [patientRes, insuranceRes] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select(
        "id, first_name, last_name, email, phone, gender, dob, nationality, street_address, postal_code, town, country, language_preference, clinic_preference, avatar_url",
      )
      .eq("id", patientId)
      .single(),
    supabaseAdmin
      .from("patient_insurances")
      .select("provider_name, card_number, insurance_type")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    patient: patientRes.data,
    insurance: insuranceRes.data ?? null,
  };
}

/** Strip internal tags like [Doctor: X] [Notes: Y] from the reason for patient display. */
function cleanAppointment(appt: {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  reason: string | null;
  location: string | null;
}) {
  const rawReason = appt.reason || "";
  const doctorMatch = rawReason.match(/\[Doctor:\s*([^\]]+)\]/i);
  const cleaned = rawReason
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: appt.id,
    start_time: appt.start_time,
    end_time: appt.end_time,
    status: appt.status,
    title: cleaned || "Appointment",
    doctor: doctorMatch ? doctorMatch[1].replace(/\(Deactivated User\)/i, "").trim() : null,
    location: appt.location,
  };
}
