import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendLeadPromoSms } from "@/lib/messaging";

/**
 * Webhook endpoint for receiving Facebook Lead Ads via Zapier
 * 
 * This endpoint queues webhooks for sequential processing to prevent race conditions.
 * The actual processing happens in /api/cron/process-webhook-queue
 * 
 * An immediate promo SMS is sent from this endpoint so the lead receives it right away.
 */

type FacebookLeadPayload = {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  service_interest?: string;
  service?: string;
  ad_name?: string;
  campaign_name?: string;
  form_name?: string;
  created_time?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming payload
    let payload: FacebookLeadPayload;
    
    const contentType = request.headers.get("content-type") || "";
    const bodyText = await request.clone().text();
    
    console.log("[Zapier Facebook Leads] Received webhook, queuing for processing");
    
    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(bodyText);
      } catch (parseError) {
        console.error("[Zapier Facebook Leads] JSON parse error:", parseError);
        return NextResponse.json(
          { success: false, error: "Invalid JSON payload" },
          { status: 400 }
        );
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries()) as unknown as FacebookLeadPayload;
    } else {
      try {
        payload = JSON.parse(bodyText);
      } catch {
        try {
          const formData = await request.formData();
          payload = Object.fromEntries(formData.entries()) as unknown as FacebookLeadPayload;
        } catch (formError) {
          console.error("[Zapier Facebook Leads] Failed to parse:", formError);
          return NextResponse.json(
            { success: false, error: "Could not parse request body" },
            { status: 400 }
          );
        }
      }
    }

    // Insert into queue for processing
    const { data: queueItem, error: queueError } = await supabaseAdmin
      .from("webhook_queue")
      .insert({
        source: "zapier-facebook-leads",
        payload: payload,
        status: "pending"
      })
      .select("id")
      .single();

    if (queueError || !queueItem) {
      console.error("[Zapier Facebook Leads] Failed to queue webhook:", queueError);
      return NextResponse.json(
        { success: false, error: "Failed to queue webhook" },
        { status: 500 }
      );
    }

    console.log(`[Zapier Facebook Leads] Webhook queued successfully: ${queueItem.id}`);

    // Send the lead promo SMS immediately (fire-and-forget).
    // The queue handles patient/deal creation in the background.
    const phone = payload.phone || payload.phone_number;
    if (phone) {
      const email = payload.email?.toLowerCase().trim() || null;

      // Try to find an existing patient so we can use their preferred language and first name
      let patientId: string | null = null;
      let firstName = payload.first_name || "";
      let language: "en" | "fr" = "en";

      try {
        const phoneDigits = phone.replace(/\D/g, "");
        const lastNine = phoneDigits.slice(-9);
        const filters: string[] = [];
        if (email) filters.push(`email.ilike.${email}`);
        if (lastNine) filters.push(`phone.ilike.%${lastNine}%`);

        let query = supabaseAdmin
          .from("patients")
          .select("id, first_name, language_preference");

        if (filters.length > 0) {
          query = query.or(filters.join(","));
        }

        const { data: existingPatient } = await query.limit(1).maybeSingle();

        if (existingPatient) {
          patientId = existingPatient.id;
          if (existingPatient.first_name) firstName = existingPatient.first_name;
          if (existingPatient.language_preference === "fr") language = "fr";
        }
      } catch (lookupErr) {
        console.error("[Zapier Facebook Leads] Patient lookup error:", lookupErr);
      }

      // Fire-and-forget so the webhook response is not delayed
      sendLeadPromoSms({
        to: phone,
        firstName,
        language,
        patientId,
        promoSource: "facebook_lead",
      }).catch((err) => {
        console.error("[Zapier Facebook Leads] Promo SMS send failed:", err);
      });
    }

    // Return success immediately - processing happens in background
    return NextResponse.json({
      success: true,
      queued: true,
      queueId: queueItem.id,
      message: "Webhook queued for processing"
    });

  } catch (error) {
    console.error("[Zapier Facebook Leads] Error queuing webhook:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}

// Handle GET for Zapier webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    message: "Facebook Lead Ads webhook is active (queued processing)",
    endpoint: "/api/webhooks/zapier-facebook-leads",
    method: "POST",
    processing: "Webhooks are queued and processed sequentially",
    required_fields: ["email OR phone"],
    optional_fields: [
      "first_name",
      "last_name", 
      "full_name",
      "service_interest",
      "ad_name",
      "campaign_name",
      "form_name"
    ],
  });
}
