import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type InvoiceData = {
  id: string;
  consultation_id: string;
  patient_id: string;
  title: string;
  scheduled_at: string;
  invoice_total_amount: number | null;
  payment_method: string | null;
  doctor_name: string | null;
  invoice_is_paid: boolean;
  invoice_pdf_path: string | null;
  payment_link_expires_at: string | null;
  payrexx_payment_link: string | null;
};

type PatientData = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: "Invalid payment link" },
        { status: 400 }
      );
    }

    // Fetch invoice by payment token using admin client (bypasses RLS)
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("consultations")
      .select("id, consultation_id, patient_id, title, scheduled_at, invoice_total_amount, payment_method, doctor_name, invoice_is_paid, invoice_pdf_path, payment_link_expires_at, payrexx_payment_link")
      .eq("payment_link_token", token)
      .eq("record_type", "invoice")
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found or link has expired" },
        { status: 404 }
      );
    }

    const invoiceData = invoice as InvoiceData;

    // Check if payment link has expired
    if (invoiceData.payment_link_expires_at) {
      const expiresAt = new Date(invoiceData.payment_link_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: "This payment link has expired" },
          { status: 410 }
        );
      }
    }

    // Fetch patient information
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("first_name, last_name, email, phone")
      .eq("id", invoiceData.patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    // Generate public URL for PDF if available
    let pdfPublicUrl: string | null = null;
    if (invoiceData.invoice_pdf_path) {
      const { data: urlData } = supabaseAdmin.storage
        .from("invoice-pdfs")
        .getPublicUrl(invoiceData.invoice_pdf_path);
      pdfPublicUrl = urlData?.publicUrl || null;
    }

    return NextResponse.json({
      invoice: {
        id: invoiceData.id,
        consultation_id: invoiceData.consultation_id,
        title: invoiceData.title,
        scheduled_at: invoiceData.scheduled_at,
        invoice_total_amount: invoiceData.invoice_total_amount,
        payment_method: invoiceData.payment_method,
        doctor_name: invoiceData.doctor_name,
        invoice_is_paid: invoiceData.invoice_is_paid,
        pdf_url: pdfPublicUrl,
        payrexx_payment_link: invoiceData.payrexx_payment_link,
      },
      patient: patient as PatientData,
    });
  } catch (error) {
    console.error("Error fetching public invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
