import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayrexxGateway, getPayrexxTransaction, splitPayrexxAmount } from "@/lib/payrexx";

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
      .select("id, invoice_number, payrexx_gateway_id, status, total_amount, payrexx_payment_status, payrexx_transaction_id")
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
    if (isPaid && invoice.status !== "PAID" && invoice.status !== "PARTIAL_LOSS") {
      const invoiceTotal = Number(invoice.total_amount) || 0;
      const now = new Date().toISOString();

      // The Gateway endpoint does NOT return Payrexx's fee — only the
      // Transaction endpoint does. If we already have a transaction ID on
      // file (normally set by the webhook), fetch it to get the authoritative
      // gross/fee amounts. Otherwise fall back to treating it as a full
      // payment (the webhook is the source of truth for fee tracking).
      let fee = 0;
      let netAmount = invoiceTotal;
      if (invoice.payrexx_transaction_id) {
        try {
          const txResponse = await getPayrexxTransaction(Number(invoice.payrexx_transaction_id));
          const tx = Array.isArray(txResponse.data) ? txResponse.data[0] : undefined;
          if (tx) {
            const split = splitPayrexxAmount(tx.amount, tx.payrexxFee);
            fee = split.fee;
            netAmount = split.net > 0 ? split.net : invoiceTotal;
          }
        } catch (txErr) {
          console.error("Failed to fetch Payrexx transaction for fee lookup:", txErr);
        }
      }

      const isPartialLoss = fee > 0.005;

      const updatePayload: Record<string, unknown> = {
        status: isPartialLoss ? "PARTIAL_LOSS" : "PAID",
        paid_amount: isPartialLoss ? netAmount : invoiceTotal,
        payrexx_payment_status: "confirmed",
        payrexx_paid_at: now,
        paid_at: now,
      };
      if (isPartialLoss) {
        updatePayload.payrexx_fee_amount = fee;
      }

      if (isPartialLoss) {
        console.log("Payrexx fee deducted — recording net amount as partial loss (status check):", {
          invoiceId: invoice.id,
          invoiceTotal,
          fee,
          netAmount,
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update(updatePayload)
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Failed to update invoice:", updateError);
        return NextResponse.json(
          { error: "Failed to update invoice status" },
          { status: 500 }
        );
      }

      // Record individual payment
      await supabaseAdmin.from("invoice_payments").insert({
        invoice_id: invoiceId,
        amount: Number(updatePayload.paid_amount),
        payment_date: new Date().toISOString().substring(0, 10),
        payment_method: "payrexx",
        payrexx_transaction_id: invoice.payrexx_gateway_id ? String(invoice.payrexx_gateway_id) : null,
        fee_amount: isPartialLoss ? fee : null,
      });

      return NextResponse.json({
        success: true,
        message: isPartialLoss ? "Invoice marked as partial loss (Payrexx fee deducted)" : "Invoice marked as paid",
        gatewayStatus,
        isPaid: true,
        isPartialLoss,
        paidAmount: updatePayload.paid_amount,
      });
    }

    const alreadyPaid = invoice.status === "PAID" || invoice.status === "OVERPAID" || invoice.status === "PARTIAL_LOSS";

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
