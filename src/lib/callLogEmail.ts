import type { CallTurn } from "@/lib/callLog";
import { formatCallDuration, formatTranscriptReadable } from "@/lib/callLog";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic";
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

const CALL_LOG_NOTIFICATION_TO = "info@aesthetics-ge.ch";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

export async function sendCallLogConversationEmail(opts: {
  patientName: string;
  callId: string;
  direction?: string | null;
  startedAt?: string | null;
  durationSeconds?: number | null;
  callStatus?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  summary?: string | null;
  transcript?: string | null;
  turns: CallTurn[];
}) {
  if (!mailgunApiKey || !mailgunDomain) {
    console.warn("[CallLogEmail] Mailgun not configured, skipping call log email");
    return { sent: false, reason: "mailgun_not_configured" };
  }

  const domain = mailgunDomain as string;
  const fromAddress = mailgunFromEmail || `no-reply@${domain}`;
  const patientName = opts.patientName.trim() || "Unknown Patient";
  const subject = `Ai Outbound Call with Patient: ${patientName}`;
  const conversation = formatTranscriptReadable(opts.turns) || opts.transcript || "No transcript was recorded.";
  const startedAt = opts.startedAt ? new Date(opts.startedAt).toLocaleString("fr-CH") : "Unknown";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin: 0 0 16px;">AI outbound call conversation</h2>
      <table style="border-collapse: collapse; margin-bottom: 20px;">
        <tbody>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Patient</td><td>${escapeHtml(patientName)}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Call ID</td><td>${escapeHtml(opts.callId)}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Direction</td><td>${escapeHtml(opts.direction || "outbound")}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Started at</td><td>${escapeHtml(startedAt)}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Duration</td><td>${escapeHtml(formatCallDuration(opts.durationSeconds))}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">Status</td><td>${escapeHtml(opts.callStatus || "Unknown")}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">From</td><td>${escapeHtml(opts.fromNumber || "-")}</td></tr>
          <tr><td style="font-weight: 700; padding: 4px 16px 4px 0;">To</td><td>${escapeHtml(opts.toNumber || "-")}</td></tr>
        </tbody>
      </table>
      ${
        opts.summary
          ? `<h3 style="margin: 20px 0 8px;">Summary</h3><p>${nl2br(opts.summary)}</p>`
          : ""
      }
      <h3 style="margin: 20px 0 8px;">Conversation</h3>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; white-space: normal;">
        ${nl2br(conversation)}
      </div>
    </div>
  `;

  const formData = new FormData();
  formData.append("from", `${mailgunFromName} <${fromAddress}>`);
  formData.append("to", CALL_LOG_NOTIFICATION_TO);
  formData.append("subject", subject);
  formData.append("html", html);

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");
  const response = await fetch(`${mailgunApiBaseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("[CallLogEmail] Mailgun rejected call log email:", response.status, details);
    return { sent: false, reason: `mailgun_${response.status}` };
  }

  return { sent: true };
}
