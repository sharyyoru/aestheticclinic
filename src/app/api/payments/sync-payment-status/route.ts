import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Sync payment status - can be used to manually mark invoices as paid
 * or to sync status based on consultation_id
 */
export async function POST(request: NextRequest) {
  try {
    const { consultationCode, markAsPaid } = await request.json();

    if (!consultationCode) {
      return NextResponse.json(
        { error: "consultationCode is required (e.g., CONS-MKNWEKTP)" },
        { status: 400 }
      );
    }

    // Find the consultation by consultation_id (the code like CONS-MKNWEKTP)
    const { data: consultation, error: consultationError } = await supabaseAdmin
      .from("consultations")
      .select("id, consultation_id, invoice_is_paid, payrexx_payment_status, payrexx_gateway_id")
      .eq("consultation_id", consultationCode)
      .eq("record_type", "invoice")
      .single();

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: `Invoice not found for code: ${consultationCode}` },
        { status: 404 }
      );
    }

    // If markAsPaid is true, update the invoice
    if (markAsPaid) {
      const { error: updateError } = await supabaseAdmin
        .from("consultations")
        .update({
          invoice_is_paid: true,
          payrexx_payment_status: "confirmed",
          payrexx_paid_at: new Date().toISOString(),
        })
        .eq("id", consultation.id);

      if (updateError) {
        console.error("Failed to update consultation:", updateError);
        return NextResponse.json(
          { error: "Failed to update invoice status" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Invoice marked as paid",
        consultationId: consultation.id,
        consultationCode: consultation.consultation_id,
      });
    }

    // Return current status
    return NextResponse.json({
      success: true,
      consultationId: consultation.id,
      consultationCode: consultation.consultation_id,
      isPaid: consultation.invoice_is_paid,
      payrexxStatus: consultation.payrexx_payment_status,
      payrexxGatewayId: consultation.payrexx_gateway_id,
    });
  } catch (error) {
    console.error("Error syncing payment status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
