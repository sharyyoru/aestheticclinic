import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadPromoSms } from "@/lib/messaging";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

export async function POST(request: Request) {
  try {
    const { name, email, mobile, language } = await request.json();

    if (!name || !email || !mobile) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, mobile" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Parse name into first/last name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Find or create patient record
    let patientId: string | null = null;
    let existingLanguage: "en" | "fr" = "en";
    let existingFirstName = firstName;

    try {
      const mobileDigits = mobile.replace(/\D/g, "");
      const lastNine = mobileDigits.slice(-9);
      const filters: string[] = [`email.ilike.${normalizedEmail}`];
      if (lastNine) filters.push(`phone.ilike.%${lastNine}%`);

      const { data: existingPatient } = await supabaseAdmin
        .from("patients")
        .select("id, first_name, last_name, email, phone, language_preference")
        .or(filters.join(","))
        .limit(1)
        .maybeSingle();

      if (existingPatient) {
        patientId = existingPatient.id;
        existingFirstName = existingPatient.first_name || firstName;
        existingLanguage =
          (existingPatient.language_preference as "en" | "fr") ||
          (language === "fr" ? "fr" : "en");

        // Update missing phone/email if needed
        const updates: Record<string, string> = { updated_at: new Date().toISOString() };
        if (!existingPatient.phone && mobile) updates.phone = mobile;
        if (!existingPatient.first_name) updates.first_name = firstName;
        if (!existingPatient.last_name) updates.last_name = lastName;

        if (Object.keys(updates).length > 1) {
          await supabaseAdmin.from("patients").update(updates).eq("id", patientId);
        }
      } else {
        const { data: newPatient, error: insertError } = await supabaseAdmin
          .from("patients")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: normalizedEmail,
            phone: mobile,
            source: "aliice_inquiry",
            lifecycle_stage: "lead",
            language_preference: language === "fr" ? "fr" : "en",
            notes: `Created from Aliice inquiry form.`,
          })
          .select("id")
          .single();

        if (insertError || !newPatient) {
          console.error("[Aliice Inquiry] Failed to create patient:", insertError);
        } else {
          patientId = newPatient.id;
        }
      }
    } catch (patientErr) {
      console.error("[Aliice Inquiry] Patient lookup/creation error:", patientErr);
    }

    // Send immediate promo SMS
    if (mobile) {
      const smsLanguage: "en" | "fr" =
        language === "fr" ? "fr" : existingLanguage;
      sendLeadPromoSms({
        to: mobile,
        firstName: existingFirstName,
        language: smsLanguage,
        patientId,
        promoSource: "aliice_inquiry",
      }).catch((err) => {
        console.error("[Aliice Inquiry] Promo SMS send failed:", err);
      });
    }

    const toEmail = "sharyyoru@gmail.com";
    const subject = "new Aliice Inquiry";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">New Aliice Inquiry</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151; width: 120px;">Name:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Email:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">
              <a href="mailto:${email}" style="color: #3b82f6;">${email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Mobile:</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">
              <a href="tel:${mobile}" style="color: #3b82f6;">${mobile}</a>
            </td>
          </tr>
        </table>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This inquiry was submitted from the Aliice pricing page.
        </p>
      </div>
    `;

    if (!mailgunApiKey || !mailgunDomain) {
      console.error("Missing Mailgun configuration");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const formData = new FormData();
    formData.append("from", `Aliice <noreply@${mailgunDomain}>`);
    formData.append("to", toEmail);
    formData.append("subject", subject);
    formData.append("html", html);
    formData.append("h:Reply-To", email);

    const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

    const response = await fetch(`${mailgunApiBaseUrl}/v3/${mailgunDomain}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Mailgun error:", response.status, text);
      return NextResponse.json({ error: "Failed to send inquiry" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, patientId });
  } catch (error) {
    console.error("Error sending inquiry:", error);
    return NextResponse.json({ error: "Failed to send inquiry" }, { status: 500 });
  }
}
