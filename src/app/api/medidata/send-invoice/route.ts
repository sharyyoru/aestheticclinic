import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  generateSumexXml,
  generateTardocServicesFromDuration,
  type MediDataInvoiceRequest,
  type BillingType,
  type SwissLawType,
} from "@/lib/medidata";
import { type SwissCanton } from "@/lib/tardoc";
import {
  MediDataClient,
  buildUploadInfo,
  type MediDataConfig as ClientConfig,
} from "@/lib/medidataClient";

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
  medidata_username: string | null;
  medidata_password: string | null;
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
  medidata_endpoint_url: null, // e.g., "http://192.168.1.100:8100" for MediData Box
  medidata_username: null,
  medidata_password: null,
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

    // Get consultation data (skip auth check - already authenticated via middleware)
    const { data: consultation, error: consultationError } = await supabaseAdmin
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

    const patientId = bodyPatientId || consultationData.patient_id;

    // Get patient data
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const patientData = patient as unknown as PatientData;

    // Get insurance data if available
    let insuranceData: InsuranceData | null = null;
    const { data: insurances } = await supabaseAdmin
      .from("patient_insurances")
      .select("*")
      .eq("patient_id", patientId)
      .limit(1);

    if (insurances && insurances.length > 0) {
      insuranceData = insurances[0] as unknown as InsuranceData;
    }

    // Get detailed Swiss insurer data if available
    let swissInsurer: { receiver_gln: string | null; tp_allowed: boolean | null } | null = null;

    if (insuranceData?.insurer_id) {
      const { data } = await supabaseAdmin
        .from("swiss_insurers")
        .select("receiver_gln, tp_allowed")
        .eq("id", insuranceData.insurer_id)
        .single();

      if (data) swissInsurer = data;
    }

    // Get clinic configuration
    const { data: configData } = await supabaseAdmin
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

    // Try to load actual invoice line items from the invoices table
    let services: import("@/lib/medidata").InvoiceServiceLine[] = [];

    // Find the invoice linked to this consultation
    const invoiceId = body.invoiceId || consultationId;
    const { data: dbLineItems } = await supabaseAdmin
      .from("invoice_line_items")
      .select("code, name, quantity, unit_price, total_price, tariff_code, external_factor_mt, side_type, session_number, ref_code, date_begin, provider_gln, catalog_name")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (dbLineItems && dbLineItems.length > 0) {
      // Map actual line items to InvoiceServiceLine for XML generation
      services = dbLineItems.map((item: any) => {
        const isAcf = item.tariff_code === 5 || item.catalog_name === "ACF";
        const isTardoc = item.tariff_code === 7 || item.catalog_name === "TARDOC";
        const tariffType = isAcf ? "005" : isTardoc ? "001" : "999";
        return {
          code: item.code || "",
          tariffType,
          description: item.name || "",
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          total: item.total_price || 0,
          date: item.date_begin || treatmentDate,
          providerId: item.provider_gln || config.clinic_gln,
          providerGln: item.provider_gln || config.clinic_gln,
          // ACF-specific fields
          externalFactor: isAcf ? (item.external_factor_mt ?? 1) : undefined,
          sideType: isAcf ? (item.side_type ?? 0) : undefined,
          sessionNumber: item.session_number ?? 1,
          refCode: item.ref_code || undefined,
        };
      });
    } else {
      // Fallback: generate TARDOC services from duration (backward compatibility)
      const duration = durationMinutes || extractDurationFromContent(consultationData.content);
      services = generateTardocServicesFromDuration(
        duration,
        treatmentDate,
        config.clinic_gln
      );
    }

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
        avsNumber: avsNumber || insuranceData?.avs_number || null,
        address: {
          street: patientData.street_address,
          postalCode: patientData.postal_code,
          city: patientData.town,
        },
        insurance: {
          insurerId: insuranceData?.insurer_id || null,
          insurerGln: insurerGln || insuranceData?.gln || '7601003000016',
          receiverGln: swissInsurer?.receiver_gln || null,
          insurerName: insurerName || insuranceData?.provider_name || 'Unknown Insurer',
          policyNumber: policyNumber || insuranceData?.policy_number || null,
          cardNumber: insuranceData?.card_number || null,
          lawType: lawType as SwissLawType,
          billingType: billingType as BillingType,
          caseNumber: insuranceData?.case_number || null,
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
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("medidata_submissions")
      .insert({
        consultation_id: consultationId,
        patient_id: patientData.id,
        insurer_id: insuranceData?.insurer_id || null,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_amount: total,
        billing_type: billingType,
        law_type: lawType,
        xml_content: xmlContent,
        xml_version: '4.50',
        status: 'draft',
        created_by: null,
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
    await supabaseAdmin.from("medidata_submission_history").insert({
      submission_id: submission.id,
      previous_status: null,
      new_status: 'draft',
      changed_by: null,
    });

    // If not in test mode and MediData is configured, attempt to send to MediData Box
    let medidataTransmissionStatus = 'draft';
    let medidataTransmissionError: string | null = null;
    let medidataMessageId: string | null = null;

    const canTransmit = !config.is_test_mode && 
      config.medidata_endpoint_url && 
      config.medidata_client_id && 
      config.medidata_username && 
      config.medidata_password;

    if (canTransmit) {
      try {
        // Create MediData client
        const medidataClient = new MediDataClient({
          baseUrl: config.medidata_endpoint_url!,
          clientId: config.medidata_client_id!,
          username: config.medidata_username!,
          password: config.medidata_password!,
          isTestMode: config.is_test_mode,
        });

        // Build upload info with proper metadata
        const receiverGln = invoiceRequest.patient.insurance?.receiverGln || 
                           invoiceRequest.patient.insurance?.insurerGln || 
                           '7601003000016';

        const uploadInfo = buildUploadInfo({
          senderGln: config.clinic_gln,
          receiverGln,
          invoiceNumber,
          lawType,
          billingType: billingType as "TG" | "TP",
          isReminder: false,
        });

        // Upload invoice to MediData
        const uploadResult = await medidataClient.uploadInvoice(xmlContent, uploadInfo);

        if (uploadResult.success) {
          medidataTransmissionStatus = 'pending';
          medidataMessageId = uploadResult.messageId;
          
          // Update submission with transmission details
          await supabaseAdmin
            .from("medidata_submissions")
            .update({
              status: 'pending',
              medidata_message_id: uploadResult.messageId,
              medidata_transmission_date: new Date().toISOString(),
              medidata_response_code: String(uploadResult.statusCode),
            })
            .eq("id", submission.id);

          // Record status change
          await supabaseAdmin.from("medidata_submission_history").insert({
            submission_id: submission.id,
            previous_status: 'draft',
            new_status: 'pending',
            response_code: String(uploadResult.statusCode),
            changed_by: null,
            notes: `Transmitted to MediData Box. Message ID: ${uploadResult.messageId || 'unknown'}`,
          });

          console.log(`Invoice ${invoiceNumber} transmitted to MediData. Message ID: ${uploadResult.messageId}`);
        } else {
          medidataTransmissionError = uploadResult.errorMessage || `MediData upload failed with status ${uploadResult.statusCode}`;
          console.error("MediData transmission failed:", medidataTransmissionError, uploadResult.rawResponse);

          // Record the error in history
          await supabaseAdmin.from("medidata_submission_history").insert({
            submission_id: submission.id,
            previous_status: 'draft',
            new_status: 'draft',
            response_code: String(uploadResult.statusCode),
            changed_by: null,
            notes: `Transmission failed: ${medidataTransmissionError}`,
          });
        }
      } catch (error) {
        medidataTransmissionError = `Failed to connect to MediData Box: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error("MediData transmission error:", error);

        // Record the error in history
        await supabaseAdmin.from("medidata_submission_history").insert({
          submission_id: submission.id,
          previous_status: 'draft',
          new_status: 'draft',
          changed_by: null,
          notes: `Connection error: ${medidataTransmissionError}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        invoiceNumber,
        status: medidataTransmissionStatus,
        messageId: medidataMessageId,
        xmlGenerated: true,
        transmitted: medidataTransmissionStatus === 'pending',
        transmissionError: medidataTransmissionError,
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
