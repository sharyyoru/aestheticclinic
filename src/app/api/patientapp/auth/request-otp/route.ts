import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateOtp } from "@/lib/patientAppAuth";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Aliice Medical";
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string };
    const normalized = (email || "").trim().toLowerCase();

    if (!normalized || !normalized.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // Look up patient by email (case-insensitive)
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email")
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();

    // Always return success to avoid leaking which emails exist.
    // Only actually send a code when a matching patient is found.
    if (patient && mailgunApiKey && mailgunDomain) {
      const code = generateOtp(normalized);
      const firstName = (patient.first_name || "").trim();

      const html = `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Your sign-in code</h2>
          <p style="color: #475569; font-size: 14px;">Hello${firstName ? ` ${firstName}` : ""},</p>
          <p style="color: #475569; font-size: 14px;">Use this code to sign in to your patient portal. It expires in 10 minutes.</p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0284c7;">${code}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">If you did not request this code, you can safely ignore this email.</p>
        </div>
      `;

      const formData = new FormData();
      formData.append("from", `${mailgunFromName} <${mailgunFromEmail || `clinic@${mailgunDomain}`}>`);
      formData.append("to", patient.email || normalized);
      formData.append("subject", `${code} is your patient portal sign-in code`);
      formData.append("html", html);

      const mgResponse = await fetch(
        `${mailgunApiBaseUrl}/v3/${mailgunDomain}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString("base64")}`,
          },
          body: formData,
        },
      );

      if (!mgResponse.ok) {
        const errText = await mgResponse.text();
        console.error("Patient OTP email failed:", errText);
        return NextResponse.json({ error: "Failed to send code. Please try again." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("request-otp error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
