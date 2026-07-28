import { createHmac, timingSafeEqual } from "crypto";

type UnsubscribePayload = {
  patientId: string;
  email: string;
};

function getSecret(): string {
  const secret =
    process.env.MARKETING_UNSUBSCRIBE_SECRET ||
    process.env.PATIENT_APP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing MARKETING_UNSUBSCRIBE_SECRET");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createUnsubscribeToken(payload: UnsubscribePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UnsubscribePayload;
    if (!payload.patientId || !payload.email) return null;
    return { patientId: payload.patientId, email: payload.email.trim().toLowerCase() };
  } catch {
    return null;
  }
}

export function createUnsubscribeUrl(patientId: string, email: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
  const token = createUnsubscribeToken({ patientId, email: email.trim().toLowerCase() });
  return `${appUrl}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;">
      You are receiving this marketing email from Aesthetics Clinic.
      <a href="${unsubscribeUrl}" style="color:#4b5563;text-decoration:underline;">Unsubscribe from marketing emails</a>
    </div>`;
  return html.includes("</body>")
    ? html.replace("</body>", `${footer}</body>`)
    : `${html}${footer}`;
}
