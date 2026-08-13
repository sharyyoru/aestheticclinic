/**
 * Front-desk notification email sent whenever a call doesn't reach a normal
 * conclusion — either it never connected to the patient (busy/no-answer/etc.)
 * or the AI agent connected but couldn't understand the caller mid-call.
 *
 * This closes the gap where front desk previously only got a silent internal
 * CRM task with no email, so nobody outside the CRM knew to call back.
 */
import { logEmailSent } from "@/lib/logEmail";
import { describeMissedCallReason } from "@/lib/missedCalls";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

const MISSED_CALL_NOTIFICATION_TO = "info@aesthetics-ge.ch";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type MissedCallEmailOpts = {
  /** Why the call is being flagged for front-desk follow-up. */
  type: "not_connected" | "ai_confused";
  patientName?: string | null;
  phone: string;
  reason?: string | null;
  patientId?: string | null;
  dealId?: string | null;
};

export async function sendMissedCallNotificationEmail(
  opts: MissedCallEmailOpts,
  toEmail: string = MISSED_CALL_NOTIFICATION_TO,
): Promise<{ sent: boolean; reason?: string }> {
  if (!mailgunApiKey || !mailgunDomain) {
    console.warn("[MissedCallEmail] Mailgun not configured, skipping missed-call email");
    return { sent: false, reason: "mailgun_not_configured" };
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;
  const displayName = opts.patientName?.trim() || "Unknown caller";
  const reasonLabel =
    opts.type === "ai_confused"
      ? opts.reason || "The AI assistant could not understand the caller"
      : describeMissedCallReason(opts.reason);

  const subject =
    opts.type === "ai_confused"
      ? `Missed call: AI could not understand ${displayName}`
      : `Missed call from ${displayName} (${reasonLabel})`;

  const patientLink = opts.patientId ? `${APP_URL}/patients/${opts.patientId}` : null;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin: 0 0 16px;">Missed call — please call the client back</h2>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tbody>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Caller</td><td>${escapeHtml(displayName)}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Phone</td><td>${escapeHtml(opts.phone)}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Reason</td><td>${escapeHtml(reasonLabel)}</td></tr>
        </tbody>
      </table>
      ${
        patientLink
          ? `<p><a href="${patientLink}" style="color: #0284c7;">View patient in CRM</a></p>`
          : `<p style="color: #64748b;">This caller was not matched to an existing patient record.</p>`
      }
      <p style="margin-top: 20px; color: #64748b;">This call did not reach a normal conclusion, so please follow up directly with the client.</p>
    </div>
  `;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", toEmail);
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
      const details = await response.text().catch(() => "");
      console.error("[MissedCallEmail] Mailgun rejected missed-call email:", response.status, details);
      void logEmailSent({
        patient_id: opts.patientId ?? null,
        deal_id: opts.dealId ?? null,
        to_address: toEmail,
        from_address: `${mailgunFromName} <${fromAddress}>`,
        subject,
        body: html,
        source: "missed_call",
        status: "failed",
      });
      return { sent: false, reason: `mailgun_${response.status}` };
    }

    void logEmailSent({
      patient_id: opts.patientId ?? null,
      deal_id: opts.dealId ?? null,
      to_address: toEmail,
      from_address: `${mailgunFromName} <${fromAddress}>`,
      subject,
      body: html,
      source: "missed_call",
      status: "sent",
    });

    return { sent: true };
  } catch (err) {
    console.error("[MissedCallEmail] Failed to send missed-call email:", err);
    return { sent: false, reason: "exception" };
  }
}
