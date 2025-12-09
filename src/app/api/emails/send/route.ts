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
    const { to, subject, html, fromUserEmail, emailId } = (await request.json()) as {
      to?: string;
      subject?: string;
      html?: string;
      fromUserEmail?: string | null;
      emailId?: string | null;
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

    const replyAlias = emailId ? `reply+${emailId}@${domain}` : null;

    let fromAddress = mailgunFromEmail || `no-reply@${domain}`;
    let replyTo: string | null = replyAlias;

    if (fromUserEmail && fromUserEmail.trim().length > 0) {
      const userEmail = fromUserEmail.trim();
      fromAddress = userEmail;
      if (!replyAlias) {
        replyTo = userEmail;
      }
    }

    const params = new URLSearchParams();
    params.append("from", `${mailgunFromName} <${fromAddress}>`);
    params.append("to", trimmedTo);
    params.append("subject", trimmedSubject);
    params.append("html", trimmedHtml);

    if (replyTo) {
      params.append("h:Reply-To", replyTo);
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending email via Mailgun", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
