import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  generateSumexXml,
  createMediDataUploadInfo,
  generateTardocServicesFromDuration,
  type MediDataInvoiceRequest,
  type BillingType,
  type SwissLawType,
} from "@/lib/medidata";
import { calculateSumexTardocPrice, type SwissCanton, DEFAULT_CANTON } from "@/lib/tardoc";

type ConsultationData = {
  id: string;
  patient_id: string;
  title: string;
  content: string | null;
  scheduled_at: string;
  invoice_total_amount: number | null;
  doctor_name: string | null;
};

type PatientData = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  gender: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  avs_number?: string | null;
};

type InsuranceData = {
  id: string;
  provider_name: string;
  card_number: string;
  insurance_type: string;
  gln: string | null;
  avs_number: string | null;
  policy_number: string | null;
  law_type: string | null;
  billing_type: string | null;
  case_number: string | null;
  insurer_id: string | null;
};

type MediDataConfig = {
  clinic_gln: string;
  clinic_zsr: string;
  clinic_name: string;
  clinic_address_street: string | null;
  clinic_address_postal_code: string | null;
  clinic_address_city: string | null;
  clinic_canton: string | null;
  medidata_client_id: string | null;
  medidata_endpoint_url: string | null;
  is_test_mode: boolean;
};

// Default clinic configuration (can be overridden from database)
const DEFAULT_CLINIC_CONFIG: MediDataConfig = {
  clinic_gln: "7601003000115",
  clinic_zsr: "H123456",
  clinic_name: "Aesthetics Clinic XT SA",
  clinic_address_street: "chemin Rieu 18",
  clinic_address_postal_code: "1208",
  clinic_address_city: "Genève",
  clinic_canton: "GE",
  medidata_client_id: null,
  medidata_endpoint_url: "https://medidata.ch/md/ela",
  is_test_mode: true,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      consultationId,
      patientId: bodyPatientId,
      billingType = 'TG',
      lawType = 'KVG',
      durationMinutes,
      diagnosisCodes = [],
      treatmentReason = 'disease',
      insurerGln,
      insurerName,
      policyNumber,
      avsNumber,
    } = body;

    if (!consultationId) {
      return NextResponse.json(
        { error: "Consultation ID is required" },
        { status: 400 }
      );
    }

    // Verify user authentication
    const { data: authData } = await supabaseClient.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get consultation data
    const { data: consultation, error: consultationError } = await supabaseClient
      .from("consultations")
      .select("*")
      .eq("id", consultationId)
      .eq("record_type", "invoice")
      .single();

    if (consultationError || !consultation) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const consultationData = consultation as unknown as ConsultationData;

    // Get patient data
    const { data: patient, error: patientError } = await supabaseClient
      .from("patients")
      .select("*")
      .eq("id", consultationData.patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const patientData = patient as PatientData;

    // Get patient insurance
    const { data: insurances } = await supabaseClient
      .from("patient_insurances")
      .select("*")
      .eq("patient_id", patientData.id)
      .order("is_primary", { ascending: false })
      .limit(1);

    const insurance = insurances?.[0] as InsuranceData | undefined;

    // Get detailed Swiss insurer data if available
    let swissInsurer: { receiver_gln: string | null; tp_allowed: boolean | null } | null = null;

    if (insurance?.insurer_id) {
      const { data } = await supabaseClient
        .from("swiss_insurers")
        .select("receiver_gln, tp_allowed")
        .eq("id", insurance.insurer_id)
        .single();

      if (data) swissInsurer = data;
    }

    // Get clinic configuration
    const { data: configData } = await supabaseClient
      .from("medidata_config")
      .select("*")
      .limit(1)
      .single();

    const config = (configData as MediDataConfig) || DEFAULT_CLINIC_CONFIG;

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const treatmentDate = consultationData.scheduled_at.split('T')[0];

    // Calculate services based on duration (TARDOC - valid from 01.01.2026)
    const duration = durationMinutes || extractDurationFromContent(consultationData.content);
    const services = generateTardocServicesFromDuration(
      duration,
      treatmentDate,
      config.clinic_gln
    );

    // Calculate totals
    const subtotal = services.reduce((sum, s) => sum + s.total, 0);
    const total = consultationData.invoice_total_amount || subtotal;

    // Build invoice request
    const invoiceRequest: MediDataInvoiceRequest = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      treatmentStart: treatmentDate,
      treatmentEnd: treatmentDate,
      treatmentReason,
      diagnosisCodes,
      billingType: billingType as BillingType,
      lawType: lawType as SwissLawType,
      canton: (config.clinic_canton || 'GE') as SwissCanton,
      patient: {
        id: patientData.id,
        firstName: patientData.first_name,
        lastName: patientData.last_name,
        dob: patientData.dob,
        gender: patientData.gender as 'male' | 'female' | 'other' | null,
        avsNumber: avsNumber || insurance?.avs_number || null,
        address: {
          street: patientData.street_address,
          postalCode: patientData.postal_code,
          city: patientData.town,
        },
        insurance: {
          insurerId: insurance?.insurer_id || null,
          insurerGln: insurerGln || insurance?.gln || '7601003000016',
          receiverGln: swissInsurer?.receiver_gln || null,
          insurerName: insurerName || insurance?.provider_name || 'Unknown Insurer',
          policyNumber: policyNumber || insurance?.policy_number || null,
          cardNumber: insurance?.card_number || null,
          lawType: lawType as SwissLawType,
          billingType: billingType as BillingType,
          caseNumber: insurance?.case_number || null,
        },
      },
      provider: {
        id: config.clinic_gln,
        name: consultationData.doctor_name || config.clinic_name,
        gln: config.clinic_gln,
        zsr: config.clinic_zsr,
        specialty: 'Plastic Surgery',
      },
      clinic: {
        name: config.clinic_name,
        gln: config.clinic_gln,
        zsr: config.clinic_zsr,
        address: {
          street: config.clinic_address_street || '',
          postalCode: config.clinic_address_postal_code || '',
          city: config.clinic_address_city || '',
          canton: (config.clinic_canton || 'GE') as SwissCanton,
        },
        iban: 'CH09 3078 8000 0502 4928 9',
        vatNumber: null,
      },
      services,
      subtotal,
      vatAmount: 0, // Medical services are VAT exempt in Switzerland
      total,
    };

    // Generate XML
    const xmlContent = generateSumexXml(invoiceRequest);

    // Create submission record
    const { data: submission, error: submissionError } = await supabaseClient
      .from("medidata_submissions")
      .insert({
        consultation_id: consultationId,
        patient_id: patientData.id,
        insurer_id: insurance?.insurer_id || null,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_amount: total,
        billing_type: billingType,
        law_type: lawType,
        xml_content: xmlContent,
        xml_version: '4.50',
        status: 'draft',
        created_by: authData.user.id,
      })
      .select()
      .single();

    if (submissionError) {
      console.error("Error creating submission:", submissionError);
      return NextResponse.json(
        { error: "Failed to create invoice submission" },
        { status: 500 }
      );
    }

    // Record initial status in history
    await supabaseClient.from("medidata_submission_history").insert({
      submission_id: submission.id,
      previous_status: null,
      new_status: 'draft',
      changed_by: authData.user.id,
    });

    // If not in test mode and MediData is configured, attempt to send
    if (!config.is_test_mode && config.medidata_client_id) {
      // TODO: Implement actual MediData API call
      // This would require the MediData Virtual Appliance setup
      // For now, we just create the draft
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        invoiceNumber,
        status: 'draft',
        xmlGenerated: true,
        total,
        services: services.map(s => ({
          code: s.code,
          description: s.description,
          quantity: s.quantity,
          total: s.total,
        })),
      },
    });
  } catch (error) {
    console.error("Error in MediData send-invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to extract duration from content
function extractDurationFromContent(content: string | null): number {
  if (!content) return 15; // Default 15 minutes

  const durationMatch = content.match(/Duration[:\s]*(\d+)\s*min/i) ||
    content.match(/Durée[:\s]*(\d+)\s*min/i) ||
    content.match(/(\d+)\s*minutes?/i);

  return durationMatch ? parseInt(durationMatch[1]) : 15;
}
