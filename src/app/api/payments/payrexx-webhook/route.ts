import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTransactionPaid, splitPayrexxAmount, type PayrexxWebhookPayload, type PayrexxTransactionStatus } from "@/lib/payrexx";

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

    // Find the invoice by reference ID (invoice_number)
    // Payrexx sometimes returns the invoice number in invoice.number instead of referenceId
    const referenceId = transaction.referenceId || 
                       transaction.invoice?.referenceId || 
                       transaction.invoice?.number;
    
    if (!referenceId) {
      console.error("No reference ID in webhook payload");
      return NextResponse.json({ error: "No reference ID" }, { status: 400 });
    }

    // Check if this is an installment payment (referenceId format: INVOICE_NUMBER-INST1)
    const installmentMatch = referenceId.match(/^(.+)-INST(\d+)$/);

    if (installmentMatch) {
      // ── Installment-level payment ──
      const invoiceNumber = installmentMatch[1];
      const installmentNumber = parseInt(installmentMatch[2], 10);

      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id, invoice_number, total_amount, status, payrexx_fee_amount")
        .eq("invoice_number", invoiceNumber)
        .single();

      if (!invoice) {
        console.error("Invoice not found for installment reference:", referenceId);
        return NextResponse.json({ received: true, message: "Invoice not found" });
      }

      // Find the installment
      const { data: installment } = await supabaseAdmin
        .from("invoice_installments")
        .select("id, amount, status")
        .eq("invoice_id", invoice.id)
        .eq("installment_number", installmentNumber)
        .single();

      if (!installment) {
        console.error("Installment not found:", referenceId);
        return NextResponse.json({ received: true, message: "Installment not found" });
      }

      const isPaid = isTransactionPaid(transaction.status);
      const paidAt = isPaid ? new Date().toISOString() : null;

      // Payrexx charges the patient the full installment amount, then
      // deducts its own fee before paying out to us — same as the
      // invoice-level flow below.
      const { fee: installmentFee, net: installmentNet } = splitPayrexxAmount(
        transaction.amount,
        transaction.payrexxFee
      );

      // Update installment
      const instUpdate: Record<string, unknown> = {
        payrexx_transaction_id: String(transaction.id),
        payrexx_payment_status: transaction.status,
      };
      if (isPaid && installment.status !== "PAID") {
        instUpdate.status = "PAID";
        instUpdate.paid_amount = installment.amount;
        instUpdate.paid_at = paidAt;
        instUpdate.payrexx_paid_at = paidAt;
      }

      await supabaseAdmin
        .from("invoice_installments")
        .update(instUpdate)
        .eq("id", installment.id);

      // Record individual payment — use the NET amount (post-fee) so
      // accounting reflects what the clinic actually receives.
      if (isPaid && installment.status !== "PAID") {
        const netAmount = installmentFee > 0.005 && installmentNet > 0
          ? installmentNet
          : Number(installment.amount) || 0;

        await supabaseAdmin.from("invoice_payments").insert({
          invoice_id: invoice.id,
          amount: netAmount,
          payment_date: new Date().toISOString().substring(0, 10),
          payment_method: "payrexx",
          payrexx_transaction_id: String(transaction.id),
          fee_amount: installmentFee > 0.005 ? installmentFee : null,
        });

        // Accumulate the fee at the invoice level so PARTIAL_LOSS reporting
        // covers installment plans too.
        if (installmentFee > 0.005) {
          const cumulativeFee = (Number(invoice.payrexx_fee_amount) || 0) + installmentFee;
          await supabaseAdmin
            .from("invoices")
            .update({ payrexx_fee_amount: cumulativeFee })
            .eq("id", invoice.id);
        }
      }

      // Recalculate invoice-level status based on all installments
      if (isPaid) {
        const { data: allInstallments } = await supabaseAdmin
          .from("invoice_installments")
          .select("amount, status")
          .eq("invoice_id", invoice.id);

        if (allInstallments && allInstallments.length > 0) {
          const totalPaid = allInstallments
            .filter((i: { status: string }) => i.status === "PAID")
            .reduce((s: number, i: { amount: number }) => s + Number(i.amount || 0), 0);
          const invoiceTotal = Number(invoice.total_amount) || 0;

          const invoiceUpdate: Record<string, unknown> = { paid_amount: totalPaid };
          if (totalPaid >= invoiceTotal - 0.01) {
            invoiceUpdate.status = "PAID";
            invoiceUpdate.paid_at = paidAt;
          } else if (totalPaid > 0) {
            invoiceUpdate.status = "PARTIAL_PAID";
          }

          await supabaseAdmin.from("invoices").update(invoiceUpdate).eq("id", invoice.id);
        }
      }

      console.log("Installment payment processed:", { referenceId, isPaid });
      return NextResponse.json({ received: true, installmentId: installment.id, isPaid });
    }

    // ── Invoice-level payment (original flow) ──
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, status, total_amount, payrexx_payment_status")
      .eq("invoice_number", referenceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found for reference ID:", referenceId);
      return NextResponse.json({ 
        received: true, 
        message: "Invoice not found" 
      });
    }

    // Check if payment is confirmed
    const isPaid = isTransactionPaid(transaction.status);
    const paidAt = isPaid ? new Date().toISOString() : null;

    // Update the invoice with transaction details
    const updateData: Record<string, unknown> = {
      payrexx_transaction_id: String(transaction.id),
      payrexx_transaction_uuid: transaction.uuid,
      payrexx_payment_status: transaction.status,
    };

    // Mark as paid if transaction is confirmed
    let paymentFeeAmount = 0;
    if (isPaid && invoice.status !== "PAID" && invoice.status !== "PARTIAL_LOSS") {
      const invoiceTotal = Number(invoice.total_amount) || 0;

      // Payrexx charges the patient the full transaction `amount`, then
      // deducts its own `payrexxFee` before paying out to us. The fee is
      // never reflected in the amount charged to the patient — it only
      // reduces what we actually receive. (transaction.invoice.amount was
      // removed from the Payrexx API in version 2021-10-12 and must not be
      // used for this calculation.)
      const { gross, fee, net } = splitPayrexxAmount(transaction.amount, transaction.payrexxFee);
      // Fall back to the invoice total if Payrexx didn't echo back an amount
      // (older API versions / some webhook shapes).
      const grossAmount = gross > 0 ? gross : invoiceTotal;
      paymentFeeAmount = fee;

      if (fee > 0.005) {
        // Payrexx deducted a processing fee — the clinic receives less than
        // the invoiced total, even though the patient paid in full.
        updateData.status = "PARTIAL_LOSS";
        updateData.paid_amount = net > 0 ? net : grossAmount - fee;
        updateData.payrexx_fee_amount = fee;
        updateData.paid_at = paidAt;
        updateData.payrexx_paid_at = paidAt;

        console.log("Payrexx fee deducted — recording net amount as partial loss:", {
          invoiceId: invoice.id,
          invoiceTotal,
          grossAmount,
          fee,
          netAmount: updateData.paid_amount,
        });
      } else {
        // Full payment received, no fee reported on this webhook event
        updateData.status = "PAID";
        updateData.paid_amount = invoiceTotal;
        updateData.paid_at = paidAt;
        updateData.payrexx_paid_at = paidAt;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update(updateData)
      .eq("id", invoice.id);

    if (updateError) {
      console.error("Failed to update invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    // Record individual payment
    if (isPaid && updateData.paid_amount) {
      await supabaseAdmin.from("invoice_payments").insert({
        invoice_id: invoice.id,
        amount: Number(updateData.paid_amount),
        payment_date: new Date().toISOString().substring(0, 10),
        payment_method: "payrexx",
        payrexx_transaction_id: String(transaction.id),
        fee_amount: paymentFeeAmount > 0 ? paymentFeeAmount : null,
      });
    }

    console.log("Invoice updated successfully:", {
      invoiceId: invoice.id,
      newStatus: updateData.status || transaction.status,
      isPaid,
      paidAmount: updateData.paid_amount,
    });

    return NextResponse.json({
      received: true,
      invoiceId: invoice.id,
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
