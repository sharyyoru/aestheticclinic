import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { generateSwissQrBillDataUrl, generateSwissReference, formatSwissReferenceWithSpaces, type SwissQrBillData } from "@/lib/swissQrBill";
import { 
  TARDOC_TARIFF_ITEMS, 
  DEFAULT_CANTON, 
  CANTON_TAX_POINT_VALUES,
  COST_NEUTRALITY_FACTOR,
  calculateTardocPrice,
  calculateSumexTardocPrice,
  SUMEX_TARDOC_CODES,
  formatChf,
  formatSwissReference,
  type SwissCanton,
} from "@/lib/tardoc";

type InvoiceData = {
  id: string;
  consultation_id: string;
  patient_id: string;
  title: string;
  content: string | null;
  scheduled_at: string;
  invoice_total_amount: number | null;
  payment_method: string | null;
  doctor_name: string | null;
  invoice_is_complimentary: boolean;
  invoice_is_paid: boolean;
  payment_link_token: string | null;
  // Payrexx payment fields
  payrexx_payment_link: string | null;
  payrexx_gateway_id: number | null;
  payrexx_payment_status: string | null;
};

type PatientData = {
  first_name: string;
  last_name: string;
  dob: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  gender: string | null;
};

// TARDOC service line with Swiss billing compliance
type TardocServiceLine = {
  code: string;
  tardocCode: string | null;
  name: string;
  quantity: number;
  taxPoints: number;
  unitPrice: number;
  total: number;
};

function parseInvoiceContent(content: string | null, canton: SwissCanton = DEFAULT_CANTON): {
  services: TardocServiceLine[];
  diagnosis: string;
  treatingDoctor: string;
  taxPointValue: number;
  durationMinutes: number;
  isTarmedInvoice: boolean;
} {
  const taxPointValue = CANTON_TAX_POINT_VALUES[canton];
  
  if (!content) {
    return { services: [], diagnosis: "", treatingDoctor: "", taxPointValue, durationMinutes: 0, isTarmedInvoice: false };
  }

  const services: TardocServiceLine[] = [];
  let diagnosis = "";
  let treatingDoctor = "";
  let durationMinutes = 0;
  let isTarmedInvoice = false;

  // Check if this is a TARMED invoice (contains duration or TARMED indicator)
  const durationMatch = content.match(/Duration[:\s]*(\d+)\s*min/i) || 
                        content.match(/Durée[:\s]*(\d+)\s*min/i) ||
                        content.match(/(\d+)\s*minutes?/i);
  if (durationMatch) {
    durationMinutes = parseInt(durationMatch[1]);
  }

  // Check for TARMED mode indicator
  if (content.toLowerCase().includes("tarmed") || content.toLowerCase().includes("tardoc")) {
    isTarmedInvoice = true;
  }

  const serviceMatches = content.matchAll(/<li[^>]*>(.*?)<\/li>/gs);
  for (const match of serviceMatches) {
    const text = match[1].replace(/<[^>]+>/g, "");
    const parts = text.split("×");
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const quantityMatch = parts[1].match(/(\d+)/);
      const priceMatch = parts[1].match(/CHF\s*([0-9.]+)/);
      
      if (quantityMatch && priceMatch) {
        const quantity = parseInt(quantityMatch[1]);
        const unitPrice = parseFloat(priceMatch[1]);
        
        // Only try to find TARDOC code for actual TARDOC invoices
        // For regular invoices (promotions, packages, etc.), just use the service name
        services.push({
          code: "-", // No code for regular services
          tardocCode: null,
          name,
          quantity,
          taxPoints: 0,
          unitPrice,
          total: quantity * unitPrice
        });
      }
    }
  }

  const diagnosisMatch = content.match(/Diagnosis:<\/strong>\s*([^<]+)/);
  if (diagnosisMatch) {
    diagnosis = diagnosisMatch[1].trim();
  }

  const doctorMatch = content.match(/Doctor:<\/strong>\s*([^<]+)/);
  if (doctorMatch) {
    treatingDoctor = doctorMatch[1].trim();
  }

  return { services, diagnosis, treatingDoctor, taxPointValue, durationMinutes, isTarmedInvoice };
}

export async function POST(request: NextRequest) {
  try {
    const { consultationId } = await request.json();

    if (!consultationId) {
      return NextResponse.json(
        { error: "Consultation ID is required" },
        { status: 400 }
      );
    }

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

    const invoiceData = consultation as unknown as InvoiceData;

    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("first_name, last_name, dob, street_address, postal_code, town, gender")
      .eq("id", invoiceData.patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    const patientData = patient as PatientData;

    let paymentLinkToken = invoiceData.payment_link_token;
    if (!paymentLinkToken) {
      const { data: tokenData, error: tokenError } = await supabaseAdmin.rpc(
        "generate_payment_link_token"
      );

      if (tokenError || !tokenData) {
        return NextResponse.json(
          { error: "Failed to generate payment link token" },
          { status: 500 }
        );
      }

      paymentLinkToken = tokenData as string;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      const { error: updateError } = await supabaseAdmin
        .from("consultations")
        .update({
          payment_link_token: paymentLinkToken,
          payment_link_expires_at: expiresAt.toISOString(),
        })
        .eq("id", consultationId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update payment link" },
          { status: 500 }
        );
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
    
    // Generate QR code based on payment method
    let qrCodeDataUrl: string;
    let isPayrexxPayment = false;
    let isBankTransferQr = false;
    
    if ((invoiceData.payment_method === "Online Payment" || invoiceData.payment_method === "Cash") && invoiceData.payrexx_payment_link) {
      // Use Payrex QR code for Online Payment and Cash
      const paymentUrl = invoiceData.payrexx_payment_link;
      isPayrexxPayment = true;
      qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
    } else if (invoiceData.payment_method === "Bank transfer") {
      // Generate Swiss QR-bill for Bank Transfer
      isBankTransferQr = true;
      const swissReference = generateSwissReference(invoiceData.consultation_id);
      const qrBillData: SwissQrBillData = {
        iban: "CH09 3078 8000 0502 4928 9",
        creditorName: "Aesthetics Clinic XT SA",
        creditorAddressLine1: "Chemin Rieu 18",
        creditorAddressLine2: "1208 Genève",
        creditorCountry: "CH",
        amount: invoiceData.invoice_total_amount || undefined,
        currency: "CHF",
        debtorName: patientData.first_name && patientData.last_name ? `${patientData.first_name} ${patientData.last_name}` : undefined,
        debtorAddressLine1: patientData.street_address || undefined,
        debtorAddressLine2: patientData.postal_code && patientData.town ? `${patientData.postal_code} ${patientData.town}` : undefined,
        debtorCountry: "CH",
        referenceType: "QRR",
        reference: swissReference,
        unstructuredMessage: `Invoice ${invoiceData.consultation_id} - ${invoiceData.title || "Medical Services"}`,
      };
      qrCodeDataUrl = await generateSwissQrBillDataUrl(qrBillData);
    } else {
      // Fallback to internal payment link for other payment methods
      const paymentUrl = `${baseUrl}/invoice/pay/${paymentLinkToken}`;
      qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(220, 220, 220);
    pdf.rect(0, 0, pageWidth, 40, "F");

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text("Xavier Tenorio", 15, 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Chirurgie Plastique, Esthétique et Reconstructrice", 15, 20);
    pdf.text("Aesthetics Clinic XT SA", 15, 25);
    pdf.text("chemin Rieu 18", 15, 30);
    pdf.text("1208 Genève", 15, 35);

    pdf.setFontSize(9);
    pdf.text(`No RICC : 2270625`, pageWidth - 15, 15, { align: "right" });
    pdf.text(`Tél. 022 732 22 23`, pageWidth - 15, 20, { align: "right" });

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Facture d'honoraires", 15, 55);

    const invoiceDate = new Date(invoiceData.scheduled_at);
    const formattedDate = invoiceDate.toLocaleDateString("fr-CH");

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Madame/Sir`, pageWidth - 15, 55, { align: "right" });
    pdf.text(`${patientData.first_name} ${patientData.last_name}`, pageWidth - 15, 60, { align: "right" });

    let yPos = 70;
    pdf.setFillColor(200, 200, 200);
    pdf.rect(15, yPos, pageWidth - 30, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("No de facture", 20, yPos + 4);
    pdf.text("Date de facture", 80, yPos + 4);
    yPos += 6;

    pdf.setFont("helvetica", "normal");
    pdf.text(invoiceData.consultation_id, 20, yPos + 4);
    pdf.text(formattedDate, 80, yPos + 4);
    yPos += 10;

    pdf.setFillColor(200, 200, 200);
    pdf.rect(15, yPos, pageWidth - 30, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("Patient", 20, yPos + 4);
    yPos += 6;

    pdf.setFont("helvetica", "normal");
    pdf.text(`${patientData.first_name} ${patientData.last_name}`, 20, yPos + 4);
    yPos += 5;

    if (patientData.dob) {
      const dob = new Date(patientData.dob);
      pdf.text(`${dob.toLocaleDateString("fr-CH")}`, 80, yPos + 4);
      yPos += 5;
    }

    if (patientData.gender) {
      pdf.text(patientData.gender === "male" ? "Male" : patientData.gender === "female" ? "Female" : "Other", 120, yPos + 4);
      yPos += 5;
    }

    pdf.setFont("helvetica", "bold");
    pdf.text("Adresse", 20, yPos + 4);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    if (patientData.street_address) {
      pdf.text(patientData.street_address, 20, yPos + 4);
      yPos += 5;
    }

    const { services, diagnosis, treatingDoctor, taxPointValue, durationMinutes, isTarmedInvoice } = parseInvoiceContent(invoiceData.content, DEFAULT_CANTON);

    // For TARDOC invoices, calculate using Sumex codes based on duration
    // TARDOC valid from 01.01.2026 (replaced TARMED)
    let tardocServices: TardocServiceLine[] = [];
    let calculatedTotal = 0;
    
    if (isTarmedInvoice && durationMinutes > 0) {
      const sumexResult = calculateSumexTardocPrice(durationMinutes);
      tardocServices = sumexResult.lines.map((line: { code: string; description: string; quantity: number; unitPrice: number; total: number }) => ({
        code: line.code,
        tardocCode: line.code,
        name: line.description,
        quantity: line.quantity,
        taxPoints: 0,
        unitPrice: line.unitPrice,
        total: line.total,
      }));
      calculatedTotal = sumexResult.totalPrice;
    }

    // Only use TARDOC services if explicitly a TARDOC invoice with duration
    // Otherwise use the parsed services (regular invoices like promotions)
    const finalServices = (isTarmedInvoice && tardocServices.length > 0) ? tardocServices : services;

    pdf.setFont("helvetica", "bold");
    pdf.text("Diagnostic", 20, yPos + 4);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    pdf.text(diagnosis || "Durée du consultation", 20, yPos + 4);
    yPos += 5;

    if (durationMinutes > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Durée", 20, yPos + 4);
      yPos += 5;
      pdf.setFont("helvetica", "normal");
      pdf.text(`${durationMinutes} minutes`, 20, yPos + 4);
      yPos += 5;
    }

    pdf.setFont("helvetica", "bold");
    pdf.text("Mandant exécutant", 20, yPos + 4);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    pdf.text(treatingDoctor || invoiceData.doctor_name || "Xavier Tenorio", 20, yPos + 4);
    yPos += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Médecin traitant", 20, yPos + 4);
    yPos += 10;

    pdf.setFillColor(200, 200, 200);
    pdf.rect(15, yPos, pageWidth - 30, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text("Date", 17, yPos + 4);
    pdf.text("Code", 40, yPos + 4);
    pdf.text("Prestation", 70, yPos + 4);
    pdf.text("Qté", 125, yPos + 4);
    pdf.text("Prix unitaire", 140, yPos + 4);
    pdf.text("Total", pageWidth - 20, yPos + 4, { align: "right" });
    yPos += 6;

    pdf.setFont("helvetica", "normal");
    const serviceDate = new Date(invoiceData.scheduled_at);
    const prestationDate = serviceDate.toLocaleDateString("fr-CH");
    
    if (finalServices.length > 0) {
      finalServices.forEach((service) => {
        pdf.text(prestationDate, 17, yPos + 4);
        // Only show code for TARDOC invoices, otherwise show "-"
        pdf.text(isTarmedInvoice ? service.code : "-", 40, yPos + 4);
        // Truncate long service names
        const maxNameLength = 30;
        const displayName = service.name.length > maxNameLength 
          ? service.name.substring(0, maxNameLength) + "..." 
          : service.name;
        pdf.text(displayName, 70, yPos + 4);
        pdf.text(service.quantity.toString(), 125, yPos + 4);
        pdf.text(service.unitPrice.toFixed(2), 140, yPos + 4);
        pdf.text(service.total.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
        yPos += 5;
      });
    } else {
      // Fallback: use invoice title as service name
      pdf.text(prestationDate, 17, yPos + 4);
      pdf.text("-", 40, yPos + 4);
      pdf.text(invoiceData.title || "Service", 70, yPos + 4);
      pdf.text("1", 130, yPos + 4);
      const fallbackTotal = invoiceData.invoice_total_amount || 0;
      pdf.text(fallbackTotal.toFixed(2), 150, yPos + 4);
      pdf.text(fallbackTotal.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
      yPos += 5;
    }

    const totalAmount = invoiceData.invoice_total_amount || 123123;
    pdf.setFont("helvetica", "bold");
    pdf.text("Autres prestations", 70, yPos + 4);
    pdf.text(totalAmount.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
    yPos += 10;

    pdf.setFontSize(10);
    pdf.text("Total de la facture à payer dès réception.", 20, yPos + 4);
    pdf.text("Total à payer", 130, yPos + 4);
    pdf.text(totalAmount.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
    yPos += 15;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("©Adresse", 20, yPos);
    pdf.text("Section paiement", 80, yPos);
    pdf.text("Compte / Payable à", 140, yPos);
    yPos += 5;

    pdf.setFont("helvetica", "normal");
    pdf.text("Compte / Payable à", 20, yPos);
    pdf.text("CH09 3078 8000 0502 4928 9", 80, yPos);
    yPos += 4;
    pdf.text("CH09 3078 8000 0502 4928 9", 20, yPos);
    pdf.text("Aesthetics Clinic XT SA", 80, yPos);
    pdf.text("Aesthetics Clinic XT SA", 140, yPos);
    yPos += 4;
    pdf.text("Aesthetics Clinic XT SA", 20, yPos);
    pdf.text("Chemin Rieu 18", 80, yPos);
    pdf.text("Chemin Rieu 18", 140, yPos);
    yPos += 4;
    pdf.text("Chemin Rieu 18", 20, yPos);
    pdf.text("1208 Genève", 80, yPos);
    pdf.text("1208 Genève", 140, yPos);
    yPos += 4;
    pdf.text("1208 Genève", 20, yPos);
    yPos += 6;

    pdf.setFont("helvetica", "bold");
    pdf.text("Référence", 20, yPos);
    pdf.text("Référence", 140, yPos);
    yPos += 4;
    pdf.setFont("helvetica", "normal");
    
    // Use Swiss QR Reference for bank transfers, static reference for others
    const displayReference = isBankTransferQr 
      ? formatSwissReferenceWithSpaces(generateSwissReference(invoiceData.consultation_id))
      : "00 00000 00000 00000 05870 40016";
    
    pdf.text(displayReference, 20, yPos);
    pdf.text(displayReference, 140, yPos);
    yPos += 6;

    pdf.setFont("helvetica", "bold");
    pdf.text("Payable par", 20, yPos);
    pdf.text("Payable par", 140, yPos);
    yPos += 4;
    pdf.setFont("helvetica", "normal");
    pdf.text("No address available", 20, yPos);
    pdf.text("No address available", 140, yPos);
    yPos += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Monnaie", 20, yPos);
    pdf.text("Montant", 40, yPos);
    pdf.text("Monnaie", 100, yPos);
    pdf.text("Montant", 120, yPos);
    yPos += 4;
    pdf.setFont("helvetica", "normal");
    pdf.text("CHF", 20, yPos);
    pdf.text(totalAmount.toFixed(2), 40, yPos);
    pdf.text("CHF", 100, yPos);
    pdf.text(totalAmount.toFixed(2), 120, yPos);
    yPos += 6;

    pdf.setFont("helvetica", "bold");
    pdf.text("Point de dépôt", 60, yPos);

    pdf.setDrawColor(255, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(80, yPos - 30, 40, 40);

    pdf.addImage(qrCodeDataUrl, "PNG", 85, yPos - 28, 30, 30);

    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));
    const fileName = `invoice-${invoiceData.consultation_id}-${Date.now()}.pdf`;
    const filePath = `${invoiceData.patient_id}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("invoice-pdfs")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload PDF" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("consultations")
      .update({ invoice_pdf_path: filePath })
      .eq("id", consultationId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update invoice PDF path" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("invoice-pdfs")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      pdfUrl: publicUrlData.publicUrl,
      paymentUrl: isPayrexxPayment ? invoiceData.payrexx_payment_link : `${baseUrl}/invoice/pay/${paymentLinkToken}`,
      paymentLinkToken,
      qrCodeType: isBankTransferQr ? "swiss-qr-bill" : isPayrexxPayment ? "payrex" : "internal",
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
