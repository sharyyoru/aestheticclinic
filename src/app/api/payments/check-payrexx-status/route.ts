import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayrexxGateway } from "@/lib/payrexx";

export async function POST(request: NextRequest) {
  try {
    const { consultationId } = await request.json();

    if (!consultationId) {
      return NextResponse.json(
        { error: "Consultation ID is required" },
        { status: 400 }
      );
    }

    // Get the consultation with Payrexx gateway info
    const { data: consultation, error: consultationError } = await supabaseAdmin
      .from("consultations")
      .select("id, consultation_id, payrexx_gateway_id, invoice_is_paid, payrexx_payment_status")
      .eq("id", consultationId)
      .eq("record_type", "invoice")
      .single();

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (!consultation.payrexx_gateway_id) {
      return NextResponse.json(
        { error: "No Payrexx gateway associated with this invoice" },
        { status: 400 }
      );
    }

    // Fetch gateway status from Payrexx
    const gatewayResponse = await getPayrexxGateway(consultation.payrexx_gateway_id);

    console.log("Payrexx gateway status:", JSON.stringify(gatewayResponse, null, 2));

    if (gatewayResponse.status !== "success") {
      return NextResponse.json(
        { error: "Failed to fetch Payrexx gateway status" },
        { status: 500 }
      );
    }

    const gatewayData = Array.isArray(gatewayResponse.data) 
      ? gatewayResponse.data[0] 
      : gatewayResponse.data;

    if (!gatewayData) {
      return NextResponse.json(
        { error: "No gateway data returned" },
        { status: 500 }
      );
    }

    // Check gateway status - "confirmed" means payment was completed
    const gatewayStatus = (gatewayData as { status?: string }).status;
    const isPaid = gatewayStatus === "confirmed";

    // Update consultation if payment is confirmed
    if (isPaid && !consultation.invoice_is_paid) {
      const { error: updateError } = await supabaseAdmin
        .from("consultations")
        .update({
          invoice_is_paid: true,
          payrexx_payment_status: "confirmed",
          payrexx_paid_at: new Date().toISOString(),
        })
        .eq("id", consultationId);

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
        gatewayStatus,
        isPaid: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: consultation.invoice_is_paid ? "Invoice already marked as paid" : "Payment not yet confirmed",
      gatewayStatus,
      isPaid: consultation.invoice_is_paid,
    });
  } catch (error) {
    console.error("Error checking Payrexx status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
