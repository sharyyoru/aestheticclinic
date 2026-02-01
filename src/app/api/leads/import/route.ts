import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatSwissPhone } from "@/lib/phoneFormatter";

type ImportLead = {
  rowNumber: number;
  created: Date | string | null;
  name: string;
  email: string | null;
  source: string;
  form: string;
  channel: string;
  stage: string;
  owner: string;
  labels: string[];
  phones: {
    primary: string | null;
    secondary: string | null;
    whatsapp: string | null;
  };
  formattedPhones: Array<{ phone: string; source: string; original: string }>;
  bestPhone: string | null;
  service: string;
  detectedService: string | null;
  validationIssues: string[];
};

type HubspotService = {
  id: string;
  name: string;
};

/**
 * Match a service interest string to the closest HubSpot service
 * Uses fuzzy matching to find the best match
 */
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

  // Keyword matching patterns for common services
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

  // Try keyword matching
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

  // Partial match - find service that contains any word from the interest
  const interestWords = normalizedInterest.split(/\s+/).filter((w) => w.length > 3);
  for (const word of interestWords) {
    const partialMatch = hubspotServices.find((s) =>
      s.name.toLowerCase().includes(word)
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}

/**
 * Check if a patient already exists by email or phone
 */
async function findExistingPatient(
  email: string | null,
  phone: string | null
): Promise<{ id: string; notes: string | null } | null> {
  if (email) {
    const { data: existingByEmail } = await supabaseAdmin
      .from("patients")
      .select("id, notes")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existingByEmail) return existingByEmail;
  }

  if (phone) {
    // Try different phone formats
    const phoneDigits = phone.replace(/[^\d]/g, "");
    const lastNineDigits = phoneDigits.slice(-9);

    if (lastNineDigits.length >= 9) {
      const { data: existingByPhone } = await supabaseAdmin
        .from("patients")
        .select("id, notes")
        .or(`phone.ilike.%${lastNineDigits}%`)
        .limit(1)
        .maybeSingle();

      if (existingByPhone) return existingByPhone;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { leads, service, filename } = await request.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "No leads provided" },
        { status: 400 }
      );
    }

    if (!service) {
      return NextResponse.json(
        { error: "Service is required" },
        { status: 400 }
      );
    }

    let imported = 0;
    let failed = 0;
    let skippedDuplicates = 0;
    const errors: string[] = [];
    const importedPatientIds: string[] = [];
    const duplicatePatientIds: string[] = [];

    // Get default deal stage for new leads
    const { data: defaultStage } = await supabaseAdmin
      .from("deal_stages")
      .select("id")
      .eq("is_default", true)
      .eq("type", "lead")
      .single();

    const defaultStageId = defaultStage?.id;

    // Load HubSpot services for matching
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
        .eq("is_active", true);
      hubspotServices = (services as HubspotService[]) || [];
    }

    // Match the provided service to a HubSpot service
    const matchedService = matchServiceToHubspot(service, hubspotServices);
    const serviceId = matchedService?.id || null;
    const finalServiceInterest = matchedService?.name || service;

    // Sort leads chronologically by created date (oldest first)
    // This ensures leads are imported in the order they were created
    const sortedLeads = [...(leads as ImportLead[])].sort((a, b) => {
      const dateA = a.created ? new Date(a.created).getTime() : 0;
      const dateB = b.created ? new Date(b.created).getTime() : 0;
      return dateA - dateB; // Oldest first
    });

    console.log(`Processing ${sortedLeads.length} leads in chronological order`);
    console.log(`First lead date: ${sortedLeads[0]?.created}, Last lead date: ${sortedLeads[sortedLeads.length - 1]?.created}`);

    for (const lead of sortedLeads) {
      try {
        // Split name into first and last
        const nameParts = lead.name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Format phone number
        const formattedPhone = lead.bestPhone || formatSwissPhone(lead.phones.primary);
        const normalizedEmail = lead.email?.toLowerCase().trim() || null;

        // Check for existing patient (duplicate prevention)
        const existingPatient = await findExistingPatient(normalizedEmail, formattedPhone);

        let patientId: string;
        let isNewPatient = false;

        if (existingPatient) {
          // Patient already exists - update notes and skip creating new one
          patientId = existingPatient.id;
          duplicatePatientIds.push(patientId);
          skippedDuplicates++;

          // Append import info to existing patient notes
          const importNote = `\n\n[Lead Import ${new Date().toISOString().split('T')[0]}] Duplicate found during import from ${filename}. Original Stage: ${lead.stage}, Form: ${lead.form}`;
          const existingNotes = existingPatient.notes || "";

          await supabaseAdmin
            .from("patients")
            .update({
              notes: (existingNotes + importNote).trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", patientId);

          console.log(`Duplicate found for ${lead.name} (${normalizedEmail || formattedPhone}), patient ID: ${patientId}`);
        } else {
          // Create new patient record
          isNewPatient = true;

          // Use the original lead creation date for created_at if available
          const leadCreatedAt = lead.created ? new Date(lead.created).toISOString() : new Date().toISOString();

          const { data: patient, error: patientError } = await supabaseAdmin
            .from("patients")
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: normalizedEmail,
              phone: formattedPhone,
              source: lead.source || "Lead Import",
              lifecycle_stage: "lead",
              notes: `Imported from ${filename}\nOriginal Stage: ${lead.stage}\nForm: ${lead.form}\nChannel: ${lead.channel}`,
              created_at: leadCreatedAt,
            })
            .select("id")
            .single();

          if (patientError) {
            console.error(`Failed to create patient for ${lead.name}:`, patientError);
            failed++;
            errors.push(`Row ${lead.rowNumber}: ${patientError.message}`);
            continue;
          }

          patientId = patient.id;
          importedPatientIds.push(patientId);
        }

        // Check if deal already exists for this patient with same service
        let existingDealQuery = supabaseAdmin
          .from("deals")
          .select("id")
          .eq("patient_id", patientId);
        
        // If we matched a service, check by service_id, otherwise check by title
        if (serviceId) {
          existingDealQuery = existingDealQuery.eq("service_id", serviceId);
        } else {
          existingDealQuery = existingDealQuery.ilike("title", `%${service}%`);
        }
        
        const { data: existingDeal } = await existingDealQuery.limit(1).maybeSingle();

        let dealId: string | null = null;

        if (!existingDeal) {
          // Use the original lead creation date for deal created_at if available
          const dealCreatedAt = lead.created ? new Date(lead.created).toISOString() : new Date().toISOString();

          // Create deal record with matched service
          const { data: deal, error: dealError } = await supabaseAdmin
            .from("deals")
            .insert({
              patient_id: patientId,
              title: `${firstName} ${lastName} - ${finalServiceInterest}`,
              pipeline: "Lead to Surgery",
              stage_id: defaultStageId,
              service_id: serviceId,
              notes: `Source: ${lead.source || "Lead Import"}\nImported from ${filename}\nLabels: ${lead.labels.join(", ")}\nService Interest: ${finalServiceInterest}`,
              created_at: dealCreatedAt,
            })
            .select("id")
            .single();

          if (dealError) {
            console.error(`Failed to create deal for ${lead.name}:`, dealError);
          } else {
            dealId = deal?.id || null;
          }

          // Trigger workflow for "Request for Information" - only for new deals
          if (dealId && defaultStageId) {
            try {
              await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/deal-stage-changed`, {
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
              console.log(`Workflow triggered for deal ${dealId}, patient ${patientId}`);
            } catch (workflowError) {
              console.error("Failed to trigger workflow:", workflowError);
            }
          }
        } else {
          console.log(`Deal already exists for patient ${patientId} with service ${service}`);
        }

        if (isNewPatient) {
          imported++;
        }
      } catch (error) {
        console.error(`Error importing lead row ${lead.rowNumber}:`, error);
        failed++;
        errors.push(`Row ${lead.rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Track import history
    const { data: importRecord } = await supabaseAdmin
      .from("lead_imports")
      .insert({
        filename,
        service: finalServiceInterest,
        total_leads: leads.length,
        imported_count: imported,
        failed_count: failed,
        imported_patient_ids: importedPatientIds,
        errors: errors.length > 0 ? errors : null,
        import_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      imported,
      failed,
      skippedDuplicates,
      duplicatePatientIds: duplicatePatientIds.length > 0 ? duplicatePatientIds : undefined,
      matchedService: matchedService?.name || null,
      importId: importRecord?.id,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported} leads${skippedDuplicates > 0 ? `, ${skippedDuplicates} duplicates skipped` : ""}${failed > 0 ? `, ${failed} failed` : ""}`,
    });
  } catch (error) {
    console.error("Lead import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
