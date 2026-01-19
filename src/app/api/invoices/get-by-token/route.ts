import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Public API endpoint to fetch invoice data by payment token
 * This bypasses RLS to allow anonymous access via magic link
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Payment token is required" },
        { status: 400 }
      );
    }

    // Fetch invoice using admin client to bypass RLS
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("consultations")
      .select("*")
      .eq("payment_link_token", token)
      .eq("record_type", "invoice")
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found or link has expired" },
        { status: 404 }
      );
    }

    // Check if payment link has expired
    if (invoice.payment_link_expires_at) {
      const expiresAt = new Date(invoice.payment_link_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: "This payment link has expired" },
          { status: 410 }
        );
      }
    }

    // Fetch patient data
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("first_name, last_name, email, phone")
      .eq("id", invoice.patient_id)
      .single();

    if (patientError) {
      console.error("Error fetching patient:", patientError);
    }

    // Return only necessary data for payment page
    return NextResponse.json({
      invoice: {
        id: invoice.id,
        consultation_id: invoice.consultation_id,
        patient_id: invoice.patient_id,
        title: invoice.title,
        scheduled_at: invoice.scheduled_at,
        invoice_total_amount: invoice.invoice_total_amount,
        payment_method: invoice.payment_method,
        doctor_name: invoice.doctor_name,
        invoice_is_paid: invoice.invoice_is_paid,
        invoice_pdf_path: invoice.invoice_pdf_path,
        payment_link_expires_at: invoice.payment_link_expires_at,
        payrexx_payment_link: invoice.payrexx_payment_link,
      },
      patient: patient ? {
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        phone: patient.phone,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching invoice by token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
