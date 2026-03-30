import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, recipientEmail } = (await request.json()) as {
      invoiceId?: string;
      recipientEmail?: string;
    };

    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { error: "Missing invoiceId or recipientEmail" },
        { status: 400 },
      );
    }

    if (!mailgunApiKey || !mailgunDomain) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 },
      );
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, total_amount, paid_amount, status, patient_id, pdf_path, provider_name")
      .eq("id", invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.pdf_path) {
      return NextResponse.json(
        { error: "Invoice PDF not generated yet. Please generate it first." },
        { status: 400 },
      );
    }

    // Fetch patient name
    let patientName = "Patient";
    if (invoice.patient_id) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("first_name, last_name")
        .eq("id", invoice.patient_id)
        .single();
      if (patient) {
        patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient";
      }
    }

    // Download PDF from storage
    const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
      .from("invoice-pdfs")
      .download(invoice.pdf_path);

    if (dlErr || !pdfBlob) {
      return NextResponse.json(
        { error: "Failed to download invoice PDF" },
        { status: 500 },
      );
    }

    // Build email
    const providerName = invoice.provider_name || mailgunFromName;
    const isPaid = invoice.status === "PAID" || invoice.status === "OVERPAID";
    const isPartial = invoice.status === "PARTIAL_PAID" || invoice.status === "PARTIAL_LOSS";
    const totalAmt = Number(invoice.total_amount) || 0;
    const paidAmt = Number(invoice.paid_amount) || 0;

    let subject = `Invoice ${invoice.invoice_number} — ${providerName}`;
    if (isPaid) subject = `Receipt ${invoice.invoice_number} — ${providerName}`;
    else if (isPartial) subject = `Invoice ${invoice.invoice_number} (Partial Payment) — ${providerName}`;

    let bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 16px;">${isPaid ? "Payment Receipt" : "Invoice"} ${invoice.invoice_number}</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Dear ${patientName},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          ${isPaid
            ? `Please find attached the receipt for your fully paid invoice of <strong>CHF ${totalAmt.toFixed(2)}</strong>.`
            : isPartial
              ? `Please find attached your invoice. Amount paid so far: <strong>CHF ${paidAmt.toFixed(2)}</strong>. Remaining balance: <strong>CHF ${(totalAmt - paidAmt).toFixed(2)}</strong>.`
              : `Please find attached your invoice for <strong>CHF ${totalAmt.toFixed(2)}</strong>.`
          }
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Thank you for your trust.</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Kind regards,<br/>${providerName}</p>
      </div>
    `;

    // Send via Mailgun with PDF attachment
    const fromAddress = mailgunFromEmail || `clinic@${mailgunDomain}`;
    const formData = new FormData();
    formData.append("from", `${providerName} <${fromAddress}>`);
    formData.append("to", recipientEmail.trim());
    formData.append("subject", subject);
    formData.append("html", bodyHtml);

    const pdfFileName = `${isPaid ? "receipt" : "invoice"}-${invoice.invoice_number}.pdf`;
    const pdfFile = new File([pdfBlob], pdfFileName, { type: "application/pdf" });
    formData.append("attachment", pdfFile, pdfFileName);

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
      const mgErr = await mgResponse.text().catch(() => "");
      console.error("[InvoiceSendEmail] Mailgun error:", mgResponse.status, mgErr);
      return NextResponse.json(
        { error: "Failed to send email", details: mgErr },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, sentTo: recipientEmail.trim() });
  } catch (err) {
    console.error("[InvoiceSendEmail] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
