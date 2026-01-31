import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTransactionPaid, type PayrexxWebhookPayload, type PayrexxTransactionStatus } from "@/lib/payrexx";

// Use service role for webhook processing (no user context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook payload
    const contentType = request.headers.get("content-type") || "";
    let payload: PayrexxWebhookPayload | null = null;
    let rawBody = "";

    // Clone request to read body for logging
    try {
      rawBody = await request.clone().text();
      console.log("Payrexx webhook raw body:", rawBody.substring(0, 500));
    } catch {
      // Ignore clone errors
    }

    if (contentType.includes("application/json")) {
      const jsonData = await request.json();
      // Handle both direct transaction object and wrapped payload
      if (jsonData.transaction) {
        payload = jsonData;
      } else if (jsonData.id && jsonData.status) {
        // Direct transaction object without wrapper
        payload = { transaction: jsonData };
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      
      // Try multiple field names that Payrexx might use
      const transactionData = formData.get("transaction") || formData.get("data") || formData.get("payload");
      
      if (typeof transactionData === "string") {
        try {
          const parsed = JSON.parse(transactionData);
          if (parsed.transaction) {
            payload = parsed;
          } else if (parsed.id && parsed.status) {
            payload = { transaction: parsed };
          } else {
            payload = { transaction: parsed };
          }
        } catch {
          console.error("Failed to parse transaction JSON from form data");
        }
      }
      
      // If no transaction field, try to build from individual form fields
      if (!payload) {
        const id = formData.get("id");
        const status = formData.get("status");
        const uuid = formData.get("uuid");
        const referenceId = formData.get("referenceId") || formData.get("reference_id");
        
        if (id && status) {
          payload = {
            transaction: {
              id: Number(id),
              uuid: String(uuid || ""),
              status: String(status) as PayrexxTransactionStatus,
              referenceId: String(referenceId || ""),
              time: new Date().toISOString(),
              lang: "en",
              pageUuid: "",
              payment: { brand: "", wallet: null, cardType: "" },
              psp: "",
              pspId: 0,
              mode: "",
              invoice: {
                number: "",
                products: [],
                amount: 0,
                currency: "CHF",
                discount: { code: "", amount: 0, percentage: 0 },
                customFields: {},
                test: false,
                referenceId: String(referenceId || ""),
                paymentLink: { hash: "", referenceId: String(referenceId || ""), email: null, name: "", differentBillingAddress: false, expirationDate: null },
                paymentRequestId: 0,
                originalAmount: 0,
              },
              contact: { id: 0, uuid: "", title: "", firstname: "", lastname: "", company: "", street: "", zip: "", place: "", country: "", countryISO: "", phone: "", email: "", dateOfBirth: null, deliveryGender: "", deliveryTitle: "", deliveryFirstname: "", deliveryLastname: "", deliveryCompany: "", deliveryStreet: "", deliveryZip: "", deliveryPlace: "", deliveryCountry: "", deliveryCountryISO: "", deliveryPhone: "" },
              subscription: null,
              refundable: false,
              partiallyRefundable: false,
              metadata: {},
            }
          };
        }
      }
    } else {
      // Try to parse as JSON regardless of content type
      try {
        const jsonData = JSON.parse(rawBody);
        if (jsonData.transaction) {
          payload = jsonData;
        } else if (jsonData.id && jsonData.status) {
          payload = { transaction: jsonData };
        }
      } catch {
        console.error("Unsupported content type and failed to parse as JSON:", contentType);
      }
    }

    const transaction = payload?.transaction;

    if (!transaction) {
      console.error("No transaction data in webhook payload. Content-Type:", contentType, "Raw body preview:", rawBody.substring(0, 200));
      // Return 200 to prevent Payrexx from retrying - log the issue but don't block
      return NextResponse.json({ 
        received: true, 
        warning: "No transaction data found in payload",
        contentType,
      });
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
