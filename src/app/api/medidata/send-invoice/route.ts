import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  generateTardocServicesFromDuration,
  type BillingType,
  type SwissLawType,
} from "@/lib/medidata";
import {
  uploadInvoiceXml,
} from "@/lib/medidataProxy";
import {
  buildInvoiceRequest,
  mapLawType as mapSumexLaw,
  mapTiersMode as mapSumexTiers,
  mapSex as mapSumexSex,
  RoleType,
  PlaceType,
  RequestType,
  RequestSubtype,
  DiagnosisType,
  EsrType,
  YesNo,
  type SumexInvoiceInput,
  type InvoiceServiceInput as SumexServiceInput,
  type InvoiceDiagnosis as SumexDiagnosis,
} from "@/lib/sumexInvoice";

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
  medidata_password_encrypted: string | null;
  is_test_mode: boolean;
};

// MediData intermediate (clearing house) GLN — required in XML transport <via>
const MEDIDATA_INTERMEDIATE_GLN = "7601001304307";
// Per MediData: TG invoices must use this GLN as transport "To" (no transmission to insurance)
const TG_NO_TRANSMISSION_GLN = "2000000000008";

// MediData sender GLN — must match the GLN registered with MediData for routing
const MEDIDATA_SENDER_GLN = process.env.MEDIDATA_SENDER_GLN || "";

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
  medidata_password_encrypted: null,
  is_test_mode: true,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      invoiceId,
      consultationId, // legacy fallback
      patientId: bodyPatientId,
      billingType: bodyBillingType = 'TP',
      lawType: bodyLawType = 'KVG',
      reminderLevel = 0,
      diagnosisCodes = [],
      treatmentReason = 'disease',
      insurerGln,
      insurerName,
      policyNumber,
      avsNumber,
      caseNumber,
      accidentDate,
      durationMinutes,
    } = body as {
      invoiceId?: string;
      consultationId?: string;
      patientId?: string;
      billingType?: string;
      lawType?: string;
      reminderLevel?: number;
      diagnosisCodes?: string[];
      treatmentReason?: string;
      insurerGln?: string;
      insurerName?: string;
      policyNumber?: string;
      avsNumber?: string;
      caseNumber?: string;
      accidentDate?: string;
      durationMinutes?: number;
    };

    // ── Resolve the invoice (primary) or fall back to consultation ──
    let invoiceRecord: any = null;
    let consultationData: ConsultationData | null = null;
    let resolvedInvoiceId: string | null = invoiceId || null;

    if (invoiceId) {
      const { data: inv, error: invErr } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
      if (invErr || !inv) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      invoiceRecord = inv;
    } else if (consultationId) {
      // Legacy path: look up invoice by consultation_id, or fall back to consultation table
      const { data: inv } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("consultation_id", consultationId)
        .limit(1)
        .single();
      if (inv) {
        invoiceRecord = inv;
        resolvedInvoiceId = inv.id;
      } else {
        const { data: cons } = await supabaseAdmin
          .from("consultations")
          .select("*")
          .eq("id", consultationId)
          .eq("record_type", "invoice")
          .single();
        if (!cons) {
          return NextResponse.json({ error: "Invoice or consultation not found" }, { status: 404 });
        }
        consultationData = cons as unknown as ConsultationData;
      }
    } else {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    const patientId = bodyPatientId
      || invoiceRecord?.patient_id
      || consultationData?.patient_id;

    // Derive billing fields from invoice record when available
    const billingType = bodyBillingType || invoiceRecord?.billing_type || 'TP';
    const lawType = bodyLawType || invoiceRecord?.health_insurance_law || 'KVG';

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

    // Derive invoice metadata
    const invoiceNumber = invoiceRecord?.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`;
    const invoiceDate = invoiceRecord?.invoice_date
      ? String(invoiceRecord.invoice_date).split('T')[0]
      : new Date().toISOString().split('T')[0];
    const dueDate = invoiceRecord?.due_date
      ? String(invoiceRecord.due_date).split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const treatmentDate = invoiceRecord?.treatment_date
      ? new Date(invoiceRecord.treatment_date).toISOString().split('T')[0]
      : consultationData?.scheduled_at?.split('T')[0]
        || new Date().toISOString().split('T')[0];

    // Load line items
    let services: import("@/lib/medidata").InvoiceServiceLine[] = [];
    const lineItemLookupId = resolvedInvoiceId || consultationId;
    const { data: dbLineItems } = await supabaseAdmin
      .from("invoice_line_items")
      .select("code, name, quantity, unit_price, total_price, tariff_code, tariff_type, external_factor_mt, side_type, session_number, ref_code, date_begin, provider_gln, responsible_gln, catalog_name")
      .eq("invoice_id", lineItemLookupId)
      .order("sort_order", { ascending: true });

    if (dbLineItems && dbLineItems.length > 0) {
      // Map actual line items to InvoiceServiceLine for XML generation
      services = dbLineItems.map((item: any) => {
        const isAcf = item.tariff_code === 5 || item.catalog_name === "ACF";
        const isTardoc = item.tariff_code === 7 || item.catalog_name === "TARDOC";
        // Use stored tariff_type if available, otherwise derive from tariff_code/catalog_name
        const tariffType = item.tariff_type || (isAcf ? "005" : isTardoc ? "001" : "999");
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
          // ACF/TARDOC-specific fields
          externalFactor: (isAcf || isTardoc) ? (item.external_factor_mt ?? 1) : undefined,
          sideType: isAcf ? (item.side_type ?? 0) : undefined,
          sessionNumber: item.session_number ?? 1,
          refCode: item.ref_code || undefined,
        };
      });
    } else {
      // Fallback: generate TARDOC services from duration (backward compatibility)
      const duration = durationMinutes || extractDurationFromContent(consultationData?.content || null);
      services = generateTardocServicesFromDuration(
        duration,
        treatmentDate,
        config.clinic_gln
      );
    }

    // Calculate totals
    const subtotal = services.reduce((sum, s) => sum + s.total, 0);
    const total = invoiceRecord?.total_amount || consultationData?.invoice_total_amount || subtotal;
    const resolvedInsurerGln = insurerGln || invoiceRecord?.insurance_gln || insuranceData?.gln || '7601003000016';
    const resolvedReceiverGln = swissInsurer?.receiver_gln || resolvedInsurerGln;
    const resolvedInsurerName = insurerName || invoiceRecord?.insurance_name || insuranceData?.provider_name || 'Unknown Insurer';

    console.log(`[SendInvoice] Building Sumex1 invoice: id=${invoiceNumber}, patient=${patientData.first_name} ${patientData.last_name}, services=${services.length}, total=${total}`);

    // Build Sumex1 input — Sumex1 server is the ONLY XML generation path
    const sumexServices: SumexServiceInput[] = services.map(s => ({
      tariffType: s.tariffType || "999",
      code: s.code,
      referenceCode: s.refCode || "",
      quantity: s.quantity,
      sessionNumber: s.sessionNumber ?? 1,
      dateBegin: s.date,
      providerGln: s.providerGln || config.clinic_gln,
      responsibleGln: s.providerGln || config.clinic_gln,
      side: (s.sideType as 0 | 1 | 2 | 3) ?? 0,
      serviceName: s.description || "",
      unit: s.unitPrice || 0,
      unitFactor: 1,
      externalFactor: s.externalFactor ?? 1,
      amount: s.total || 0,
      vatRate: 0,
      ignoreValidate: YesNo.Yes,
    }));

    const sumexDiagnoses: SumexDiagnosis[] = (diagnosisCodes || []).map((code: string) => ({
      type: DiagnosisType.ICD,
      code,
    }));

    const canton = config.clinic_canton || "GE";
    const sumexInput: SumexInvoiceInput = {
      language: 2,
      roleType: RoleType.Physician,
      placeType: PlaceType.Practice,
      requestType: RequestType.Invoice,
      requestSubtype: RequestSubtype.Normal,
      tiersMode: mapSumexTiers(billingType),
      vatNumber: "",
      invoiceId: invoiceNumber,
      invoiceDate,
      reminderLevel: reminderLevel || 0,
      lawType: mapSumexLaw(lawType),
      insuredId: insuranceData?.card_number || "",
      esrType: EsrType.QR,
      iban: 'CH0930788000050249289',
      paymentPeriod: 30,
      billerGln: config.clinic_gln,
      billerZsr: config.clinic_zsr || undefined,
      billerAddress: {
        companyName: config.clinic_name,
        street: config.clinic_address_street || "",
        zip: config.clinic_address_postal_code || "",
        city: config.clinic_address_city || "",
        stateCode: canton,
      },
      providerGln: invoiceRecord?.doctor_gln || invoiceRecord?.provider_gln || config.clinic_gln,
      providerZsr: invoiceRecord?.doctor_zsr || invoiceRecord?.provider_zsr || config.clinic_zsr || undefined,
      providerAddress: {
        familyName: invoiceRecord?.doctor_name || consultationData?.doctor_name || config.clinic_name,
        givenName: "",
        street: config.clinic_address_street || "",
        zip: config.clinic_address_postal_code || "",
        city: config.clinic_address_city || "",
        stateCode: canton,
      },
      insuranceGln: resolvedInsurerGln,
      insuranceAddress: {
        companyName: resolvedInsurerName,
        street: "",
        zip: "",
        city: "",
        stateCode: "",
      },
      patientSex: mapSumexSex(patientData.gender || "male"),
      patientBirthdate: patientData.dob || "1990-01-01",
      patientSsn: avsNumber || insuranceData?.avs_number || "",
      patientAddress: {
        familyName: patientData.last_name,
        givenName: patientData.first_name,
        street: patientData.street_address || "",
        zip: patientData.postal_code || "",
        city: patientData.town || "",
        stateCode: canton,
      },
      treatmentCanton: canton,
      treatmentDateBegin: treatmentDate,
      treatmentDateEnd: treatmentDate,
      ...(accidentDate ? { acid: accidentDate } : {}),
      ...(caseNumber ? { apid: caseNumber } : {}),
      diagnoses: sumexDiagnoses,
      services: sumexServices,
      transportFrom: MEDIDATA_SENDER_GLN || config.clinic_gln,
      transportViaGln: MEDIDATA_INTERMEDIATE_GLN,
      // Per MediData (Vladimir): TG uses GLN 2000000000008 (no direct transmission to insurance)
      transportTo: billingType === 'TG' ? TG_NO_TRANSMISSION_GLN : resolvedReceiverGln,
    };

    // Generate XML + PDF via Sumex1 server (no fallback — this is the only path)
    const sumexResult = await buildInvoiceRequest(sumexInput, { generatePdf: true });

    if (!sumexResult.success || !sumexResult.xmlContent) {
      console.error(`[SendInvoice] Sumex1 XML generation FAILED for ${invoiceNumber}: error=${sumexResult.error}, abort=${sumexResult.abortInfo}, validErr=${sumexResult.validationError}`);
      return NextResponse.json(
        {
          error: "Sumex1 XML generation failed",
          details: sumexResult.error,
          abortInfo: sumexResult.abortInfo,
          validationError: sumexResult.validationError,
        },
        { status: 500 }
      );
    }

    const xmlContent = sumexResult.xmlContent;
    console.log(`[SendInvoice] Sumex1 XML generated: schema=${sumexResult.usedSchema}, validErr=${sumexResult.validationError}, pdfSize=${sumexResult.pdfContent?.length ?? 0}`);

    // Upload PDF to Supabase storage if generated
    let pdfStoragePath: string | null = null;
    if (sumexResult.pdfContent) {
      const pdfFileName = `invoice-sumex-${invoiceNumber}-${Date.now()}.pdf`;
      const pdfPath = `${patientData.id}/${pdfFileName}`;
      const { error: pdfUploadErr } = await supabaseAdmin.storage
        .from("invoice-pdfs")
        .upload(pdfPath, sumexResult.pdfContent, {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: true,
        });
      if (pdfUploadErr) {
        console.warn(`[SendInvoice] PDF upload to storage failed: ${pdfUploadErr.message}`);
      } else {
        pdfStoragePath = pdfPath;
        console.log(`[SendInvoice] PDF uploaded to storage: ${pdfPath}`);
      }
    }

    // Create submission record
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("medidata_submissions")
      .insert({
        invoice_id: resolvedInvoiceId,
        patient_id: patientData.id,
        insurer_id: insuranceData?.insurer_id || null,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_amount: total,
        billing_type: billingType,
        law_type: lawType,
        xml_content: xmlContent,
        xml_version: '5.00',
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

    // Send XML to MediData via proxy
    let medidataTransmissionStatus = 'draft';
    let medidataTransmissionError: string | null = null;
    let medidataTransmissionRef: string | null = null;

    const canTransmit = !!process.env.MEDIDATA_PROXY_API_KEY;

    if (canTransmit) {
      try {
        console.log(`[SendInvoice] Uploading to MediData proxy: invoice=${invoiceNumber}`);

        const uploadReceiverGln = billingType === 'TG' ? TG_NO_TRANSMISSION_GLN : resolvedReceiverGln;
        const uploadResult = await uploadInvoiceXml(
          xmlContent,
          `${invoiceNumber}.xml`,
          {
            source: "aestheticclinic",
            invoiceNumber,
            senderGln: config.clinic_gln,
            receiverGln: uploadReceiverGln,
            lawType,
            billingType,
          },
        );

        if (uploadResult.success) {
          medidataTransmissionStatus = 'pending';
          medidataTransmissionRef = uploadResult.transmissionReference;

          // Update submission with transmission details
          await supabaseAdmin
            .from("medidata_submissions")
            .update({
              status: 'pending',
              medidata_message_id: uploadResult.transmissionReference,
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
            notes: `Transmitted via proxy. Ref: ${uploadResult.transmissionReference || 'unknown'}`,
          });

          console.log(`[SendInvoice] Invoice ${invoiceNumber} transmitted. Ref: ${uploadResult.transmissionReference}`);

          // ── Send patient copy for TP invoices (LAMal Art. 42 para. 3) ──
          if (billingType === "TP") {
            try {
              const copyInput: SumexInvoiceInput = {
                ...sumexInput,
                requestSubtype: RequestSubtype.Copy,
              };
              const copyResult = await buildInvoiceRequest(copyInput, { generatePdf: false });
              if (copyResult.success && copyResult.xmlContent) {
                const copyUpload = await uploadInvoiceXml(copyResult.xmlContent, `${invoiceNumber}-copy.xml`, {
                  source: "send-invoice-patient-copy",
                  invoiceNumber,
                  senderGln: config.clinic_gln,
                  receiverGln: resolvedReceiverGln,
                  requestSubtype: "copy",
                });
                if (copyUpload.success) {
                  console.log(`[SendInvoice] Patient copy sent for ${invoiceNumber}: ref=${copyUpload.transmissionReference}`);
                } else {
                  console.warn(`[SendInvoice] Patient copy upload failed for ${invoiceNumber}: ${copyUpload.errorMessage}`);
                }
              } else {
                console.warn(`[SendInvoice] Patient copy XML failed for ${invoiceNumber}: ${copyResult.error}`);
              }
            } catch (copyErr) {
              console.warn(`[SendInvoice] Patient copy error for ${invoiceNumber}:`, copyErr);
            }
          }
        } else {
          medidataTransmissionError = uploadResult.errorMessage || `Proxy upload failed (${uploadResult.statusCode})`;
          console.error("[SendInvoice] Proxy transmission failed:", medidataTransmissionError, uploadResult.rawResponse);

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
        medidataTransmissionError = `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error("[SendInvoice] Proxy transmission error:", error);

        // Record the error in history
        await supabaseAdmin.from("medidata_submission_history").insert({
          submission_id: submission.id,
          previous_status: 'draft',
          new_status: 'draft',
          changed_by: null,
          notes: `Proxy error: ${medidataTransmissionError}`,
        });
      }
    } else {
      console.warn("[SendInvoice] MEDIDATA_PROXY_API_KEY not set — skipping transmission");
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        invoiceNumber,
        status: medidataTransmissionStatus,
        messageId: medidataTransmissionRef,
        xmlGenerated: true,
        xmlVersion: '5.00',
        sumex1Schema: sumexResult.usedSchema,
        pdfGenerated: !!pdfStoragePath,
        pdfStoragePath,
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
