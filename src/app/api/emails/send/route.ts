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

    // Always send from Mailgun domain so replies are captured
    // Store actual user email in custom variables for reference
    const fromAddress = mailgunFromEmail || `no-reply@${domain}`;
    
    // Use staff member's name if provided, otherwise use clinic name
    let fromName = mailgunFromName;
    if (fromUserEmail && fromUserEmail.trim().length > 0) {
      // Extract name from email if available, or use email prefix
      const emailPrefix = fromUserEmail.split("@")[0];
      fromName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }

    const params = new URLSearchParams();
    params.append("from", `${fromName} <${fromAddress}>`);
    params.append("to", trimmedTo);
    params.append("subject", trimmedSubject);
    params.append("html", trimmedHtml);
    
    // Set Reply-To to Mailgun domain so replies come back through webhook
    // Using clinic address ensures all replies are captured
    const replyToAddress = `clinic@${domain}`;
    params.append("h:Reply-To", replyToAddress);
    
    // Add custom headers for reply tracking and metadata
    if (emailId) {
      params.append("v:email-id", emailId);
    }
    if (patientId) {
      params.append("v:patient-id", patientId);
    }
    if (fromUserEmail && fromUserEmail.trim().length > 0) {
      params.append("v:sent-by", fromUserEmail.trim());
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
