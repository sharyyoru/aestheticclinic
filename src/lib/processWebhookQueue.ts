import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shouldCreateDeal } from "@/lib/dealDeduplication";

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

type HubspotService = {
  id: string;
  name: string;
};

function matchServiceToHubspot(
  serviceInterest: string,
  hubspotServices: HubspotService[]
): HubspotService | null {
  if (!serviceInterest || hubspotServices.length === 0) return null;

  const normalizedInterest = serviceInterest.toLowerCase().trim();

  // Direct match first
  const directMatch = hubspotServices.find(
    (s) => s.name.toLowerCase() === normalizedInterest
  );
  if (directMatch) return directMatch;

  // Keyword matching patterns
  const serviceKeywords: { keywords: string[]; serviceNames: string[] }[] = [
    { keywords: ["breast", "augment", "implant", "mammoplasty"], serviceNames: ["breast augmentation", "breast"] },
    { keywords: ["face", "filler", "facial filler"], serviceNames: ["face filler", "facial filler", "filler"] },
    { keywords: ["wrinkle", "ride", "rides", "anti-age", "antiage"], serviceNames: ["wrinkle", "anti-aging", "rides"] },
    { keywords: ["blepharo", "eyelid", "paupière"], serviceNames: ["blepharoplasty", "eyelid"] },
    { keywords: ["lipo", "liposuc"], serviceNames: ["liposuction", "lipo"] },
    { keywords: ["iv", "therapy", "infusion", "drip"], serviceNames: ["iv therapy", "infusion"] },
    { keywords: ["rhino", "nose", "nez"], serviceNames: ["rhinoplasty", "nose"] },
    { keywords: ["facelift", "lifting", "face lift"], serviceNames: ["facelift", "face lift"] },
    { keywords: ["botox", "toxin"], serviceNames: ["botox", "botulinum"] },
    { keywords: ["lip", "lèvre"], serviceNames: ["lip filler", "lip"] },
    { keywords: ["tummy", "tuck", "abdominoplast"], serviceNames: ["tummy tuck", "abdominoplasty"] },
    { keywords: ["breast", "lift", "mastopexy"], serviceNames: ["breast lift", "mastopexy"] },
    { keywords: ["hyperbaric", "oxygen", "hbot"], serviceNames: ["hyperbaric", "hbot", "oxygen"] },
    { keywords: ["consultation", "consult"], serviceNames: ["consultation", "consult"] },
  ];

  for (const { keywords, serviceNames } of serviceKeywords) {
    const hasKeyword = keywords.some((k) => normalizedInterest.includes(k));
    if (hasKeyword) {
      for (const serviceName of serviceNames) {
        const match = hubspotServices.find((s) =>
          s.name.toLowerCase().includes(serviceName)
        );
        if (match) return match;
      }
    }
  }

  const interestWords = normalizedInterest.split(/\s+/).filter((w) => w.length > 3);
  for (const word of interestWords) {
    const partialMatch = hubspotServices.find((s) =>
      s.name.toLowerCase().includes(word)
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}

export async function processFacebookLead(payload: FacebookLeadPayload): Promise<{
  success: boolean;
  patientId?: string;
  dealId?: string | null;
  isNewPatient?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Extract and normalize fields
    let firstName = payload.first_name || "";
    let lastName = payload.last_name || "";
    
    if (!firstName && !lastName && payload.full_name) {
      const nameParts = payload.full_name.trim().split(/\s+/);
      firstName = nameParts[0] || "Unknown";
      lastName = nameParts.slice(1).join(" ") || "";
    }

    if (!firstName) firstName = "Unknown";

    const email = payload.email?.toLowerCase().trim() || null;
    const phone = payload.phone || payload.phone_number || null;
    const serviceInterest = payload.service_interest || payload.service || "General Inquiry";
    const adName = payload.ad_name || null;
    const campaignName = payload.campaign_name || null;
    const formName = payload.form_name || null;

    if (!email && !phone) {
      return {
        success: false,
        error: "At least email or phone is required"
      };
    }

    // Check for existing patient
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
      patientId = patientRow.id;
      const existingNotes = patientRow.notes || "";

      await supabaseAdmin
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
    } else {
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
        return {
          success: false,
          error: insertError?.message || "Failed to create patient"
        };
      }

      patientId = newPatient.id;
    }

    // Get default deal stage
    let defaultStageId: string | undefined;

    const { data: defaultLeadStage } = await supabaseAdmin
      .from("deal_stages")
      .select("id")
      .eq("is_default", true)
      .eq("type", "lead")
      .eq("is_demo", false)
      .limit(1)
      .maybeSingle();

    defaultStageId = defaultLeadStage?.id;

    if (!defaultStageId) {
      const { data: anyDefaultStage } = await supabaseAdmin
        .from("deal_stages")
        .select("id")
        .eq("is_default", true)
        .eq("is_demo", false)
        .limit(1)
        .maybeSingle();
      defaultStageId = anyDefaultStage?.id;
    }

    if (!defaultStageId) {
      const { data: firstStage } = await supabaseAdmin
        .from("deal_stages")
        .select("id")
        .eq("is_demo", false)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      defaultStageId = firstStage?.id;
    }

    if (!defaultStageId) {
      return {
        success: false,
        error: "No deal stages configured"
      };
    }

    // Load HubSpot services
    const { data: hubspotCategory } = await supabaseAdmin
      .from("service_categories")
      .select("id")
      .eq("name", "Hubspot")
      .single();

    let hubspotServices: HubspotService[] = [];
    if (hubspotCategory) {
      const { data: services } = await supabaseAdmin
        .from("services")
        .select("id, name")
        .eq("category_id", hubspotCategory.id)
        .eq("is_active", true)
        .order("name", { ascending: true});
      hubspotServices = (services as HubspotService[]) || [];
    }

    const matchedService = matchServiceToHubspot(serviceInterest, hubspotServices);
    const serviceId = matchedService?.id || null;
    const finalServiceInterest = matchedService?.name || serviceInterest;

    const dealTitle = `${firstName} ${lastName} - ${finalServiceInterest}`;

    const dealCheck = await shouldCreateDeal(supabaseAdmin, {
      title: dealTitle,
      patientFirstName: firstName,
      patientLastName: lastName,
    });

    let dealId: string | null = null;

    if (dealCheck.shouldCreate) {
      const { data: newDeal, error: dealError } = await supabaseAdmin
        .from("deals")
        .insert({
          patient_id: patientId,
          title: dealTitle,
          pipeline: "Lead to Surgery",
          stage_id: defaultStageId,
          service_id: serviceId,
          notes: `Source: Facebook Lead Ads\nFacebook Ad: ${adName || "N/A"}\nCampaign: ${campaignName || "N/A"}\nForm: ${formName || "N/A"}\nService Interest: ${finalServiceInterest}`,
        })
        .select("id")
        .single();

      if (!dealError && newDeal) {
        dealId = newDeal.id;

        // Trigger workflow
        if (defaultStageId) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
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
          }
        }
      }
    } else {
      dealId = dealCheck.existingDeal.id;
      console.log(`Skipped deal creation — recent deal exists: ${dealId}`);
    }

    return {
      success: true,
      patientId,
      dealId,
      isNewPatient,
      message: isNewPatient 
        ? `New lead created: ${firstName} ${lastName}` 
        : `Existing patient updated: ${firstName} ${lastName}`,
    };

  } catch (error) {
    console.error("Error processing Facebook lead:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    };
  }
}
