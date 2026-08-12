import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatSwissPhone } from "@/lib/phoneFormatter";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";

export type PatientContact = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  language_preference?: "en" | "fr" | string | null;
  whatsapp_opt_in?: boolean | null;
};

function getLanguage(patient: PatientContact | null | undefined, fallback = "en"): "en" | "fr" {
  const lang = patient?.language_preference || fallback;
  return lang === "fr" ? "fr" : "en";
}

function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const formatted = formatSwissPhone(phone);
  if (formatted) return formatted;

  // Fallback: keep E.164-ish format if it already starts with +
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (cleaned.startsWith("+")) return cleaned;

  // Last resort: assume Swiss if 10 digits starting with 0 or 9 digits
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return `+41${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+41${digits}`;
  }

  return cleaned.startsWith("+") ? cleaned : null;
}

export function buildBookingLink(options: {
  patientId?: string | null;
  promo?: string;
  promoSource?: string;
  language?: "en" | "fr";
}): string {
  const params = new URLSearchParams();
  params.set("promo", options.promo || "LEAD100");
  if (options.promoSource) params.set("promo_source", options.promoSource);
  if (options.language) params.set("lang", options.language);
  if (options.patientId) {
    params.set("pid", options.patientId);
    params.set("autofill", "true");
  }
  return `${APP_URL}/book-appointment/location?${params.toString()}`;
}

export function getLeadPromoSmsBody(options: {
  firstName?: string | null;
  language?: "en" | "fr";
  bookingLink: string;
}): string {
  const { firstName, language = "en", bookingLink } = options;
  const name = firstName?.trim() || (language === "fr" ? "vous" : "there");

  if (language === "fr") {
    return `Bonjour ${name},

Débloquez votre bonus exclusif : 100 CHF de crédit + consultation gratuite. Réservez dans les 10 prochaines minutes pour en profiter :

${bookingLink}

Sélectionnez votre date et heure.

Aesthetics Clinic`;
  }

  return `Hi ${name},

Unlock your exclusive bonus: 100 CHF credit + free consultation. Book within the next 10 minutes to claim it:

${bookingLink}

Select date and time.

Aesthetics Clinic`;
}

export function getCancellationPolicyBody(options: {
  firstName?: string | null;
  language?: "en" | "fr";
  channel: "sms" | "whatsapp";
}): string {
  const { firstName, language = "en" } = options;
  const name = firstName?.trim() || (language === "fr" ? "vous" : "there");

  if (language === "fr") {
    return `Bonjour ${name},

Votre rendez-vous est confirmé.

Politique d'annulation : des frais de 150 CHF seront facturés à votre adresse enregistrée uniquement en cas d'absence ou d'annulation tardive (moins de 24 heures de préavis).

Aesthetics Clinic`;
  }

  return `Hi ${name},

Your appointment is confirmed.

Cancellation Policy: A 150 CHF fee will be billed to your registered address only in the event of a no-show or late cancellation (under 24h notice).

Aesthetics Clinic`;
}

export async function sendSms(options: {
  to: string;
  body: string;
  patientId?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; sid?: string | null; error?: string }> {
  const { to, body, patientId, source = "system", metadata = {} } = options;

  const normalized = normalizePhoneNumber(to);
  if (!normalized) {
    console.log(`[SMS] Skipped send to ${to}: could not normalize phone number`);
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const res = await fetch(`${APP_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toNumber: normalized,
        body,
        patientId,
        metadata: {
          ...metadata,
          source,
          message_type: metadata.message_type || "promo",
        },
      }),
    });

    const result = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      console.error(`[SMS] Failed to send to ${normalized}:`, result);
      return { ok: false, error: (result.error as string) || `HTTP ${res.status}` };
    }

    console.log(`[SMS] Sent to ${normalized}, SID: ${result.sid}`);
    return { ok: true, sid: (result.sid as string) || null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SMS] Unexpected error sending to ${to}:`, msg);
    return { ok: false, error: msg };
  }
}

export async function sendWhatsAppTemplate(options: {
  to: string;
  templateName: string;
  contentVariables: Record<string, string>;
  patientId?: string | null;
  source?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, templateName, contentVariables, patientId, source = "system" } = options;

  const normalized = normalizePhoneNumber(to);
  if (!normalized) {
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const { data: template, error } = await supabaseAdmin
      .from("whatsapp_templates")
      .select("id, twilio_content_sid, body, status")
      .eq("name", templateName)
      .maybeSingle();

    if (error || !template?.twilio_content_sid) {
      console.log(
        `[WhatsApp] Template ${templateName} not usable (missing SID or not found). Status: ${
          template?.status || "not found"
        }`
      );
      return {
        ok: false,
        error: `Template ${templateName} has no approved Twilio Content SID`,
      };
    }

    const res = await fetch(`${APP_URL}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        to: normalized,
        contentSid: template.twilio_content_sid,
        contentVariables,
        templateId: template.id,
        _skipWindowCheck: true,
      }),
    });

    const result = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok && !(result as any).skipped) {
      console.error(`[WhatsApp] Failed to send ${templateName} to ${normalized}:`, result);
      return { ok: false, error: (result.error as string) || `HTTP ${res.status}` };
    }

    console.log(`[WhatsApp] Sent ${templateName} to ${normalized}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[WhatsApp] Unexpected error sending ${templateName} to ${to}:`, msg);
    return { ok: false, error: msg };
  }
}

export async function sendLeadPromoSms(options: {
  to: string;
  firstName?: string | null;
  language?: "en" | "fr";
  patientId?: string | null;
  promoSource?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, firstName, language = "en", patientId, promoSource = "lead_form" } = options;
  const bookingLink = buildBookingLink({ patientId, promo: "LEAD100", promoSource, language });
  const body = getLeadPromoSmsBody({ firstName, language, bookingLink });
  const result = await sendSms({
    to,
    body,
    patientId,
    source: promoSource,
    metadata: { message_type: "lead_promo", promo: "LEAD100" },
  });
  return result;
}

export async function sendCancellationPolicyMessages(options: {
  patient: PatientContact;
  language?: "en" | "fr";
  appointmentDate?: Date | string | null;
  appointmentId?: string | null;
}): Promise<{ smsOk: boolean; whatsappOk: boolean }> {
  const { patient, language: lang, appointmentDate, appointmentId } = options;
  const language = lang || getLanguage(patient);
  const firstName = patient.first_name;
  const phone = patient.phone;

  let smsOk = false;
  let whatsappOk = false;

  if (!phone) {
    console.log("[CancellationPolicy] Patient has no phone, skipping messages");
    return { smsOk, whatsappOk };
  }

  // SMS
  const smsBody = getCancellationPolicyBody({ firstName, language, channel: "sms" });
  const smsResult = await sendSms({
    to: phone,
    body: smsBody,
    patientId: patient.id,
    source: "online_booking",
    metadata: {
      message_type: "cancellation_policy",
      appointment_id: appointmentId,
      appointment_date: appointmentDate ? new Date(appointmentDate).toISOString() : null,
    },
  });
  smsOk = smsResult.ok;

  // WhatsApp (only works once the cancellation policy template is approved in Twilio)
  const templateName = language === "fr" ? "cancellation_policy_fr" : "cancellation_policy_en";
  const whatsappResult = await sendWhatsAppTemplate({
    to: phone,
    templateName,
    contentVariables: { "1": firstName || (language === "fr" ? "vous" : "there") },
    patientId: patient.id,
    source: "online_booking",
  });
  whatsappOk = whatsappResult.ok;

  return { smsOk, whatsappOk };
}
