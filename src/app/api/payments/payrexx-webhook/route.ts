import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTransactionPaid, type PayrexxWebhookPayload } from "@/lib/payrexx";

// Use service role for webhook processing (no user context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook payload
    const contentType = request.headers.get("content-type") || "";
    let payload: PayrexxWebhookPayload;

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const transactionData = formData.get("transaction");
      if (typeof transactionData === "string") {
        payload = { transaction: JSON.parse(transactionData) };
      } else {
        console.error("Invalid webhook payload format");
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    } else {
      console.error("Unsupported content type:", contentType);
      return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }

    const { transaction } = payload;

    if (!transaction) {
      console.error("No transaction data in webhook payload");
      return NextResponse.json({ error: "No transaction data" }, { status: 400 });
    }

    console.log("Payrexx webhook received:", {
      transactionId: transaction.id,
      uuid: transaction.uuid,
      status: transaction.status,
      referenceId: transaction.referenceId,
      invoiceReferenceId: transaction.invoice?.referenceId,
    });

    // Find the consultation by reference ID (consultation_id)
    const referenceId = transaction.referenceId || transaction.invoice?.referenceId;
    
    if (!referenceId) {
      console.error("No reference ID in webhook payload");
      return NextResponse.json({ error: "No reference ID" }, { status: 400 });
    }

    // Look up the consultation by consultation_id
    const { data: consultation, error: consultationError } = await supabaseAdmin
      .from("consultations")
      .select("id, consultation_id, invoice_is_paid, payrexx_payment_status")
      .eq("consultation_id", referenceId)
      .eq("record_type", "invoice")
      .single();

    if (consultationError || !consultation) {
      console.error("Consultation not found for reference ID:", referenceId);
      // Still return 200 to prevent Payrexx from retrying
      return NextResponse.json({ 
        received: true, 
        message: "Consultation not found" 
      });
    }

    // Check if payment is confirmed
    const isPaid = isTransactionPaid(transaction.status);
    const paidAt = isPaid ? new Date().toISOString() : null;

    // Update the consultation with transaction details
    const updateData: Record<string, unknown> = {
      payrexx_transaction_id: transaction.id,
      payrexx_transaction_uuid: transaction.uuid,
      payrexx_payment_status: transaction.status,
    };

    // Mark as paid if transaction is confirmed
    if (isPaid && !consultation.invoice_is_paid) {
      updateData.invoice_is_paid = true;
      updateData.payrexx_paid_at = paidAt;
    }

    const { error: updateError } = await supabaseAdmin
      .from("consultations")
      .update(updateData)
      .eq("id", consultation.id);

    if (updateError) {
      console.error("Failed to update consultation:", updateError);
      return NextResponse.json(
        { error: "Failed to update consultation" },
        { status: 500 }
      );
    }

    console.log("Consultation updated successfully:", {
      consultationId: consultation.id,
      newStatus: transaction.status,
      isPaid,
    });

    return NextResponse.json({
      received: true,
      consultationId: consultation.id,
      status: transaction.status,
      isPaid,
    });
  } catch (error) {
    console.error("Error processing Payrexx webhook:", error);
    // Return 200 to prevent retries for parsing errors
    return NextResponse.json({
      received: true,
      error: error instanceof Error ? error.message : "Processing error",
    });
  }
}

// Allow GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: "Payrexx webhook endpoint active" });
}
