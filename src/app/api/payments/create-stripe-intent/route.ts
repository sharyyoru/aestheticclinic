import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const { consultationId, amount } = await request.json();

    if (!consultationId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: consultation, error: consultationError } = await supabaseClient
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .single();

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (consultation.invoice_is_paid) {
      return NextResponse.json(
        { error: "Invoice already paid" },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/invoice/pay/${consultation.payment_link_token}?payment=success`;
    const cancelUrl = `${baseUrl}/invoice/pay/${consultation.payment_link_token}?payment=cancelled`;

    const amountInCents = Math.round(amount * 100);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price_data][currency]": "chf",
        "line_items[0][price_data][product_data][name]": `Invoice ${consultation.consultation_id}`,
        "line_items[0][price_data][unit_amount]": amountInCents.toString(),
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": successUrl,
        "cancel_url": cancelUrl,
        "metadata[consultation_id]": consultationId,
      }),
    });

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.json();
      console.error("Stripe error:", errorData);
      return NextResponse.json(
        { error: "Failed to create payment session" },
        { status: 500 }
      );
    }

    const session = await stripeResponse.json();

    const { error: updateError } = await supabaseClient
      .from("consultations")
      .update({
        stripe_payment_intent_id: session.id,
      })
      .eq("id", consultationId);

    if (updateError) {
      console.error("Failed to update consultation with Stripe session:", updateError);
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating Stripe payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
