export type PatientAppointmentEmailType = "confirmation" | "day_before";

export type PatientAppointmentEmailOptions = {
  type: PatientAppointmentEmailType;
  patientName: string;
  appointmentDate: Date;
  doctorName?: string | null;
  service?: string | null;
  location?: string | null;
  notes?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function generatePatientAppointmentEmailHtml({
  type,
  patientName,
  appointmentDate,
  doctorName,
  service,
  location,
  notes,
  contactPhone,
  contactEmail,
}: PatientAppointmentEmailOptions): string {
  const isReminder = type === "day_before";
  const title = isReminder
    ? "Appointment Reminder / Rappel de rendez-vous"
    : "Appointment Confirmed / Rendez-vous confirmé";
  const intro = isReminder
    ? "This is a friendly reminder for your appointment tomorrow. / Ceci est un rappel amical pour votre rendez-vous de demain."
    : "Your appointment has been confirmed. / Votre rendez-vous est confirmé.";
  const safe = (value: string | null | undefined) => escapeHtml(value?.trim() || "");
  const contact = [contactPhone, contactEmail]
    .filter(Boolean)
    .map((value) => `<p style="margin:4px 0;">${safe(value)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f8fafc;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;">
    <div style="max-width:600px;margin:24px auto;padding:0 16px;">
      <div style="background:#1e293b;color:#fff;padding:28px 24px;border-radius:14px 14px 0 0;">
        <h1 style="margin:0;font-size:24px;">${title}</h1>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;">
        <p>Dear ${safe(patientName)},</p>
        <p>${intro}</p>
        <div style="background:#f8fafc;border-radius:10px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>Date / Date:</strong> ${safe(formatDate(appointmentDate))}</p>
          <p style="margin:0 0 8px;"><strong>Time / Heure:</strong> ${safe(formatTime(appointmentDate))}</p>
          ${doctorName ? `<p style="margin:0 0 8px;"><strong>Doctor / Médecin:</strong> ${safe(doctorName)}</p>` : ""}
          ${service ? `<p style="margin:0 0 8px;"><strong>Service:</strong> ${safe(service)}</p>` : ""}
          ${location ? `<p style="margin:0 0 8px;"><strong>Location / Lieu:</strong> ${safe(location)}</p>` : ""}
          ${notes ? `<p style="margin:0;"><strong>Notes:</strong> ${safe(notes)}</p>` : ""}
        </div>
        <p>We look forward to seeing you. / Nous nous réjouissons de vous accueillir.</p>
        ${contact ? `<div style="margin-top:20px;color:#64748b;font-size:13px;"><p style="margin:0 0 4px;"><strong>Contact</strong></p>${contact}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;
}
