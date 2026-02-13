import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayrexxGateway } from "@/lib/payrexx";

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Get the invoice with Payrexx gateway info
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, payrexx_gateway_id, status, total_amount, payrexx_payment_status")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (!invoice.payrexx_gateway_id) {
      return NextResponse.json(
        { error: "No Payrexx gateway associated with this invoice" },
        { status: 400 }
      );
    }

    // Fetch gateway status from Payrexx
    const gatewayResponse = await getPayrexxGateway(invoice.payrexx_gateway_id);

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

    // Update invoice if payment is confirmed
    if (isPaid && invoice.status !== "PAID") {
      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "PAID",
          paid_amount: invoice.total_amount,
          payrexx_payment_status: "confirmed",
          payrexx_paid_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Failed to update invoice:", updateError);
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

    const alreadyPaid = invoice.status === "PAID" || invoice.status === "OVERPAID";

    return NextResponse.json({
      success: true,
      message: alreadyPaid ? "Invoice already marked as paid" : "Payment not yet confirmed",
      gatewayStatus,
      isPaid: alreadyPaid,
    });
  } catch (error) {
    console.error("Error checking Payrexx status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
