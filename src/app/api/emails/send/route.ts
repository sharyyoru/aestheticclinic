import { NextResponse } from "next/server";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

if (!mailgunApiKey || !mailgunDomain) {
  throw new Error("Missing MAILGUN_API_KEY or MAILGUN_DOMAIN environment variables");
}

export async function POST(request: Request) {
  try {
    const { to, subject, html, fromUserEmail, emailId, patientId } = (await request.json()) as {
      to?: string;
      subject?: string;
      html?: string;
      fromUserEmail?: string | null;
      emailId?: string | null;
      patientId?: string | null;
    };

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    const trimmedTo = to.trim();
    const trimmedSubject = subject.trim();
    const trimmedHtml = html.trim();

    if (!trimmedTo || !trimmedSubject || !trimmedHtml) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    const domain = mailgunDomain as string;

    // Use actual user email if provided, otherwise use system default
    let fromAddress = mailgunFromEmail || `no-reply@${domain}`;
    if (fromUserEmail && fromUserEmail.trim().length > 0) {
      fromAddress = fromUserEmail.trim();
    }

    const params = new URLSearchParams();
    params.append("from", `${mailgunFromName} <${fromAddress}>`);
    params.append("to", trimmedTo);
    params.append("subject", trimmedSubject);
    params.append("html", trimmedHtml);
    
    // Add custom header with email ID for reply tracking
    if (emailId) {
      params.append("v:email-id", emailId);
    }
    if (patientId) {
      params.append("v:patient-id", patientId);
    }

    const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

    const response = await fetch(`${mailgunApiBaseUrl}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Error sending email via Mailgun", response.status, text);
      return NextResponse.json(
        {
          error: "Failed to send email via Mailgun",
          mailgunStatus: response.status,
          mailgunBody: text,
        },
        { status: 502 },
      );
    }

    // Get the Message-ID from Mailgun response for reply tracking
    const mailgunResponse = await response.json();
    const messageId = mailgunResponse.id || null;

    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    console.error("Error sending email via Mailgun", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
