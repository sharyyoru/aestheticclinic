import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Webhook endpoint for receiving Facebook Lead Ads via Zapier
 * 
 * Expected Zapier field mapping:
 * - first_name: Lead's first name
 * - last_name: Lead's last name
 * - email: Lead's email address
 * - phone: Lead's phone number
 * - service_interest: The service/treatment they're interested in
 * - ad_name: (optional) Name of the Facebook ad
 * - campaign_name: (optional) Name of the campaign
 * - form_name: (optional) Name of the lead form
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
    // Parse the incoming payload - Zapier can send as JSON or form data
    let payload: FacebookLeadPayload;
    
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries()) as unknown as FacebookLeadPayload;
    } else {
      // Try JSON first, fallback to form data
      try {
        payload = await request.json();
      } catch {
        const formData = await request.formData();
        payload = Object.fromEntries(formData.entries()) as unknown as FacebookLeadPayload;
      }
    }

    console.log("Received Facebook Lead via Zapier:", JSON.stringify(payload, null, 2));

    // Extract and normalize fields
    let firstName = payload.first_name || "";
    let lastName = payload.last_name || "";
    
    // Handle full_name if first/last not provided
    if (!firstName && !lastName && payload.full_name) {
      const nameParts = payload.full_name.trim().split(/\s+/);
      firstName = nameParts[0] || "Unknown";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    // Default to "Unknown" if no name provided
    if (!firstName) firstName = "Unknown";

    const email = payload.email?.toLowerCase().trim() || null;
    const phone = payload.phone || payload.phone_number || null;
    const serviceInterest = payload.service_interest || payload.service || "General Inquiry";
    const adName = payload.ad_name || null;
    const campaignName = payload.campaign_name || null;
    const formName = payload.form_name || null;

    // Validate required fields
    if (!email && !phone) {
      return NextResponse.json(
        { 
          success: false, 
          error: "At least email or phone is required" 
        },
        { status: 400 }
      );
    }

    // Check for existing patient by email or phone
    let patientRow: { id: string; notes: string | null } | null = null;

    if (email) {
      const { data: existingByEmail } = await supabaseAdmin
        .from("patients")
        .select("id, notes")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (existingByEmail) {
        patientRow = existingByEmail;
      }
    }

    if (!patientRow && phone) {
      // Try different phone formats
      const phoneVariants = [
        phone,
        phone.replace(/\s+/g, ""),
        phone.replace(/[^\d+]/g, ""),
      ];

      for (const phoneVariant of phoneVariants) {
        const { data: existingByPhone } = await supabaseAdmin
          .from("patients")
          .select("id, notes")
          .or(`phone.eq.${phoneVariant},phone.ilike.%${phoneVariant.slice(-9)}%`)
          .limit(1)
          .maybeSingle();

        if (existingByPhone) {
          patientRow = existingByPhone;
          break;
        }
      }
    }

    let patientId: string;
    let isNewPatient = false;

    // Build notes with Facebook lead info
    const leadInfo = {
      source: "Facebook Lead Ads",
      ad_name: adName,
      campaign_name: campaignName,
      form_name: formName,
      service_interest: serviceInterest,
      received_at: new Date().toISOString(),
    };
    const leadNote = `\n\n[Facebook Lead] ${JSON.stringify(leadInfo, null, 2)}`;

    if (patientRow) {
      // Update existing patient
      patientId = patientRow.id;
      const existingNotes = patientRow.notes || "";

      const { error: updateError } = await supabaseAdmin
        .from("patients")
        .update({
          first_name: firstName,
          last_name: lastName,
          ...(email && { email }),
          ...(phone && { phone }),
          notes: (existingNotes + leadNote).trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientId);

      if (updateError) {
        console.error("Failed to update patient:", updateError);
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Create new patient
      isNewPatient = true;

      const { data: newPatient, error: insertError } = await supabaseAdmin
        .from("patients")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          source: "Facebook Lead Ads",
          lifecycle_stage: "lead",
          notes: leadNote.trim(),
        })
        .select("id")
        .single();

      if (insertError || !newPatient) {
        console.error("Failed to create patient:", insertError);
        return NextResponse.json(
          { success: false, error: insertError?.message || "Failed to create patient" },
          { status: 500 }
        );
      }

      patientId = newPatient.id;
    }

    // Get default deal stage for new leads
    const { data: defaultStage } = await supabaseAdmin
      .from("deal_stages")
      .select("id")
      .eq("is_default", true)
      .eq("type", "lead")
      .single();

    const defaultStageId = defaultStage?.id;

    // Check if deal already exists for this patient with similar service
    const { data: existingDeal } = await supabaseAdmin
      .from("deals")
      .select("id")
      .eq("patient_id", patientId)
      .ilike("service_interest", `%${serviceInterest}%`)
      .limit(1)
      .maybeSingle();

    let dealId: string | null = null;

    if (!existingDeal) {
      // Create new deal
      const { data: newDeal, error: dealError } = await supabaseAdmin
        .from("deals")
        .insert({
          patient_id: patientId,
          title: `${firstName} ${lastName} - ${serviceInterest}`,
          pipeline: "Lead to Surgery",
          stage_id: defaultStageId,
          service_interest: serviceInterest,
          source: "Facebook Lead Ads",
          deal_value: null,
          notes: `Facebook Ad: ${adName || "N/A"}\nCampaign: ${campaignName || "N/A"}\nForm: ${formName || "N/A"}`,
        })
        .select("id")
        .single();

      if (dealError) {
        console.error("Failed to create deal:", dealError);
        // Don't fail the whole request - patient was created
      } else {
        dealId = newDeal?.id || null;
      }

      // Trigger workflow for new lead
      if (dealId && defaultStageId) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          await fetch(`${baseUrl}/api/workflows/deal-stage-changed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dealId,
              patientId,
              fromStageId: null,
              toStageId: defaultStageId,
              pipeline: "Lead to Surgery",
            }),
          });
        } catch (workflowError) {
          console.error("Failed to trigger workflow:", workflowError);
          // Don't fail the request for workflow errors
        }
      }
    } else {
      dealId = existingDeal.id;
    }

    console.log(`Facebook Lead processed: Patient ${patientId}, Deal ${dealId}, New: ${isNewPatient}`);

    return NextResponse.json({
      success: true,
      patientId,
      dealId,
      isNewPatient,
      message: isNewPatient 
        ? `New lead created: ${firstName} ${lastName}` 
        : `Existing patient updated: ${firstName} ${lastName}`,
    });

  } catch (error) {
    console.error("Error processing Facebook Lead webhook:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}

// Also handle GET for Zapier webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    message: "Facebook Lead Ads webhook is active",
    endpoint: "/api/webhooks/zapier-facebook-leads",
    method: "POST",
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
