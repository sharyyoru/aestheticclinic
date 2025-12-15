import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe signature" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Stripe webhook secret not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    let event;
    try {
      const crypto = require("crypto");
      const elements = signature.split(",");
      const timestamp = elements.find((e) => e.startsWith("t="))?.substring(2);
      const signatures = elements.filter((e) => e.startsWith("v1=")).map((e) => e.substring(3));

      if (!timestamp || signatures.length === 0) {
        throw new Error("Invalid signature format");
      }

      const signedPayload = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(signedPayload, "utf8")
        .digest("hex");

      const signatureMatches = signatures.some((sig) => 
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature))
      );

      if (!signatureMatches) {
        throw new Error("Signature verification failed");
      }

      event = JSON.parse(body);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const consultationId = session.metadata?.consultation_id;

      if (!consultationId) {
        console.error("No consultation ID in session metadata");
        return NextResponse.json(
          { error: "Missing consultation ID" },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabaseClient
        .from("consultations")
        .update({
          invoice_is_paid: true,
          payment_completed_at: new Date().toISOString(),
          payment_method: "Online Payment",
        })
        .eq("id", consultationId);

      if (updateError) {
        console.error("Failed to update consultation payment status:", updateError);
        return NextResponse.json(
          { error: "Failed to update payment status" },
          { status: 500 }
        );
      }

      console.log(`Payment completed for consultation ${consultationId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
