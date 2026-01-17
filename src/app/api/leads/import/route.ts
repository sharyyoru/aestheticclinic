import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatSwissPhone, extractLeadPhones } from "@/lib/phoneFormatter";

type ImportLead = {
  rowNumber: number;
  created: Date | null;
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
    const errors: string[] = [];

    // Get default deal stage for new leads
    const { data: defaultStage } = await supabaseAdmin
      .from("deal_stages")
      .select("id")
      .eq("is_default", true)
      .eq("type", "lead")
      .single();

    const defaultStageId = defaultStage?.id;

    for (const lead of leads as ImportLead[]) {
      try {
        // Split name into first and last
        const nameParts = lead.name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Format phone number
        const formattedPhone = lead.bestPhone || formatSwissPhone(lead.phones.primary);

        // Create patient record
        const { data: patient, error: patientError } = await supabaseAdmin
          .from("patients")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: lead.email,
            phone: formattedPhone,
            source: lead.source || "Lead Import",
            lifecycle_stage: "lead",
            notes: `Imported from ${filename}\nOriginal Stage: ${lead.stage}\nForm: ${lead.form}\nChannel: ${lead.channel}`,
          })
          .select("id")
          .single();

        if (patientError) {
          console.error(`Failed to create patient for ${lead.name}:`, patientError);
          failed++;
          errors.push(`Row ${lead.rowNumber}: ${patientError.message}`);
          continue;
        }

        // Create deal record
        const { data: deal, error: dealError } = await supabaseAdmin
          .from("deals")
          .insert({
            patient_id: patient.id,
            title: `${firstName} ${lastName} - ${service}`,
            pipeline: "Lead to Surgery",
            stage_id: defaultStageId,
            service_interest: service,
            source: lead.source || "Lead Import",
            deal_value: null,
            notes: `Imported from ${filename}\nLabels: ${lead.labels.join(", ")}`,
          })
          .select("id")
          .single();

        if (dealError) {
          console.error(`Failed to create deal for ${lead.name}:`, dealError);
          // Continue - patient was created
        }

        // Trigger workflow for "Request for Information"
        if (deal?.id && patient.id) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/workflows/deal-stage-changed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dealId: deal.id,
                patientId: patient.id,
                fromStageId: null,
                toStageId: defaultStageId,
                pipeline: "Lead to Surgery",
              }),
            });
          } catch (workflowError) {
            console.error("Failed to trigger workflow:", workflowError);
            // Don't fail the import for workflow errors
          }
        }

        imported++;
      } catch (error) {
        console.error(`Error importing lead row ${lead.rowNumber}:`, error);
        failed++;
        errors.push(`Row ${lead.rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported} leads${failed > 0 ? `, ${failed} failed` : ""}`,
    });
  } catch (error) {
    console.error("Lead import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
