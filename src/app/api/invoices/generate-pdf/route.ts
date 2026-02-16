import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { generateSwissQrBillDataUrl, generateSwissReference, formatSwissReferenceWithSpaces, type SwissQrBillData } from "@/lib/swissQrBill";
import type { Invoice, InvoiceLineItem } from "@/lib/invoiceTypes";

type PatientData = {
  first_name: string;
  last_name: string;
  dob: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  gender: string | null;
};

type ProviderData = {
  id: string;
  name: string;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  gln: string | null;
  zsr: string | null;
  street: string | null;
  street_no: string | null;
  zip_code: string | null;
  city: string | null;
  canton: string | null;
  iban: string | null;
  salutation: string | null;
  title: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Fetch invoice with line items
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const invoiceData = invoice as Invoice;

    // Fetch line items
    const { data: lineItemsRaw, error: lineItemsError } = await supabaseAdmin
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (lineItemsError) {
      return NextResponse.json(
        { error: "Failed to fetch line items" },
        { status: 500 }
      );
    }

    const lineItems = (lineItemsRaw || []) as InvoiceLineItem[];

    // Fetch patient
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

    // Fetch provider data if available
    let providerData: ProviderData | null = null;
    if (invoiceData.provider_id) {
      const { data: providerRow } = await supabaseAdmin
        .from("providers")
        .select("id, name, specialty, email, phone, gln, zsr, street, street_no, zip_code, city, canton, iban, salutation, title")
        .eq("id", invoiceData.provider_id)
        .single();
      if (providerRow) providerData = providerRow as ProviderData;
    }

    // Resolve provider details: prefer live provider data, fall back to invoice snapshot, then defaults
    const provName = providerData?.name || invoiceData.provider_name || "Aesthetics Clinic XT SA";
    const provTitle = providerData?.title || "Chirurgie Plastique, Esthétique et Reconstructrice";
    const provStreet = providerData?.street || "chemin Rieu";
    const provBuildingNumber = providerData?.street_no || "18";
    const provPostalCode = providerData?.zip_code || "1208";
    const provTown = providerData?.city || "Genève";
    const provCountry = "CH";
    const provIban = providerData?.iban || "CH0930788000050249289";
    const provIbanFormatted = provIban.replace(/(.{4})/g, "$1 ").trim();
    const provRcc = providerData?.zsr || invoiceData.provider_zsr || "";
    const provPhone = providerData?.phone || "022 732 22 23";
    const provClinicName = "Aesthetics Clinic XT SA";

    // Ensure payment link token exists
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
        .from("invoices")
        .update({
          payment_link_token: paymentLinkToken,
          payment_link_expires_at: expiresAt.toISOString(),
        })
        .eq("id", invoiceId);

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
      const paymentUrl = invoiceData.payrexx_payment_link;
      isPayrexxPayment = true;
      qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
    } else if (invoiceData.payment_method === "Bank transfer") {
      isBankTransferQr = true;
      const swissReference = generateSwissReference(invoiceData.invoice_number);
      // Parse patient street address into street + building number
      const patientStreetParts = (patientData.street_address || "").match(/^(.+?)\s+(\d+\S*)$/);
      const patientStreet = patientStreetParts ? patientStreetParts[1] : (patientData.street_address || "");
      const patientBuildingNumber = patientStreetParts ? patientStreetParts[2] : "";

      const qrBillData: SwissQrBillData = {
        iban: provIban,
        creditorName: provClinicName,
        creditorStreet: provStreet,
        creditorBuildingNumber: provBuildingNumber,
        creditorPostalCode: provPostalCode,
        creditorTown: provTown,
        creditorCountry: provCountry,
        amount: invoiceData.total_amount || undefined,
        currency: "CHF",
        debtorName: patientData.first_name && patientData.last_name ? `${patientData.first_name} ${patientData.last_name}` : undefined,
        debtorStreet: patientStreet || undefined,
        debtorBuildingNumber: patientBuildingNumber || undefined,
        debtorPostalCode: patientData.postal_code || undefined,
        debtorTown: patientData.town || undefined,
        debtorCountry: "CH",
        referenceType: "QRR",
        reference: swissReference,
        unstructuredMessage: `Invoice ${invoiceData.invoice_number} - Medical Services`,
      };
      qrCodeDataUrl = await generateSwissQrBillDataUrl(qrBillData);
    } else {
      const paymentUrl = `${baseUrl}/invoice/pay/${paymentLinkToken}`;
      qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(220, 220, 220);
    pdf.rect(0, 0, pageWidth, 40, "F");

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(provName, 15, 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(provTitle, 15, 20);
    pdf.text(provClinicName, 15, 25);
    pdf.text(`${provStreet} ${provBuildingNumber}`, 15, 30);
    pdf.text(`${provPostalCode} ${provTown}`, 15, 35);

    pdf.setFontSize(9);
    if (provRcc) pdf.text(`RCC ${provRcc}`, pageWidth - 15, 15, { align: "right" });
    pdf.text(`Tél. ${provPhone}`, pageWidth - 15, 20, { align: "right" });

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Facture d'honoraires", 15, 55);

    const invoiceDate = new Date(invoiceData.invoice_date);
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
    pdf.text(invoiceData.invoice_number, 20, yPos + 4);
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

    // Doctor info
    pdf.setFont("helvetica", "bold");
    pdf.text("Mandant exécutant", 20, yPos + 4);
    yPos += 5;
    pdf.setFont("helvetica", "normal");
    pdf.text(invoiceData.doctor_name || "Xavier Tenorio", 20, yPos + 4);
    yPos += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Médecin traitant", 20, yPos + 4);
    yPos += 10;

    // Service lines table header
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
    const prestationDate = invoiceData.treatment_date
      ? new Date(invoiceData.treatment_date).toLocaleDateString("fr-CH")
      : formattedDate;
    
    if (lineItems.length > 0) {
      lineItems.forEach((item: InvoiceLineItem) => {
        pdf.text(prestationDate, 17, yPos + 4);
        pdf.text(item.code || "-", 40, yPos + 4);
        const maxNameLength = 30;
        const displayName = (item.name || "Service").length > maxNameLength 
          ? (item.name || "Service").substring(0, maxNameLength) + "..." 
          : (item.name || "Service");
        pdf.text(displayName, 70, yPos + 4);
        pdf.text(String(item.quantity || 1), 125, yPos + 4);
        pdf.text((item.unit_price || 0).toFixed(2), 140, yPos + 4);
        pdf.text((item.total_price || 0).toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
        yPos += 5;
      });
    } else {
      // Fallback if no line items
      pdf.text(prestationDate, 17, yPos + 4);
      pdf.text("-", 40, yPos + 4);
      pdf.text("Service", 70, yPos + 4);
      pdf.text("1", 130, yPos + 4);
      const fallbackTotal = invoiceData.total_amount || 0;
      pdf.text(fallbackTotal.toFixed(2), 150, yPos + 4);
      pdf.text(fallbackTotal.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
      yPos += 5;
    }

    const totalAmount = invoiceData.total_amount || 0;
    const paidAmount = invoiceData.paid_amount || 0;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const invoiceStatus = invoiceData.status || "OPEN";
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Autres prestations", 70, yPos + 4);
    pdf.text(totalAmount.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Total de la facture", 20, yPos + 4);
    pdf.text("Total facture", 130, yPos + 4);
    pdf.text(totalAmount.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
    yPos += 6;
    
    // Show paid amount if any payment has been made
    if (paidAmount > 0) {
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 128, 0);
      pdf.text("Montant payé", 20, yPos + 4);
      pdf.text("Payé", 130, yPos + 4);
      pdf.text(`-${paidAmount.toFixed(2)}`, pageWidth - 20, yPos + 4, { align: "right" });
      yPos += 6;
      pdf.setTextColor(0, 0, 0);
    }
    
    // Show remaining balance
    pdf.setFont("helvetica", "bold");
    if (invoiceStatus === "PARTIAL_PAID" && remainingAmount > 0) {
      pdf.setTextColor(200, 100, 0);
      pdf.text("Solde restant à payer", 20, yPos + 4);
      pdf.text("Reste à payer", 130, yPos + 4);
      pdf.text(remainingAmount.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
      pdf.setTextColor(0, 0, 0);
    } else if (invoiceStatus === "PAID" || remainingAmount <= 0) {
      pdf.setTextColor(0, 128, 0);
      pdf.text("PAYÉ EN TOTALITÉ", 20, yPos + 4);
      pdf.text("Reste à payer", 130, yPos + 4);
      pdf.text("0.00", pageWidth - 20, yPos + 4, { align: "right" });
      pdf.setTextColor(0, 0, 0);
    } else {
      pdf.text("Total à payer dès réception", 20, yPos + 4);
      pdf.text("Total à payer", 130, yPos + 4);
      pdf.text(totalAmount.toFixed(2), pageWidth - 20, yPos + 4, { align: "right" });
    }
    yPos += 15;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("©Adresse", 20, yPos);
    pdf.text("Section paiement", 80, yPos);
    pdf.text("Compte / Payable à", 140, yPos);
    yPos += 5;

    pdf.setFont("helvetica", "normal");
    pdf.text("Compte / Payable à", 20, yPos);
    pdf.text(provIbanFormatted, 80, yPos);
    yPos += 4;
    pdf.text(provIbanFormatted, 20, yPos);
    pdf.text(provClinicName, 80, yPos);
    pdf.text(provClinicName, 140, yPos);
    yPos += 4;
    pdf.text(provClinicName, 20, yPos);
    pdf.text(`${provStreet} ${provBuildingNumber}`, 80, yPos);
    pdf.text(`${provStreet} ${provBuildingNumber}`, 140, yPos);
    yPos += 4;
    pdf.text(`${provStreet} ${provBuildingNumber}`, 20, yPos);
    pdf.text(`${provPostalCode} ${provTown}`, 80, yPos);
    pdf.text(`${provPostalCode} ${provTown}`, 140, yPos);
    yPos += 4;
    pdf.text(`${provPostalCode} ${provTown}`, 20, yPos);
    yPos += 6;

    pdf.setFont("helvetica", "bold");
    pdf.text("Référence", 20, yPos);
    pdf.text("Référence", 140, yPos);
    yPos += 4;
    pdf.setFont("helvetica", "normal");
    
    const displayReference = formatSwissReferenceWithSpaces(generateSwissReference(invoiceData.invoice_number));
    
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
    const fileName = `invoice-${invoiceData.invoice_number}-${Date.now()}.pdf`;
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
      .from("invoices")
      .update({ pdf_path: filePath, pdf_generated_at: new Date().toISOString() })
      .eq("id", invoiceId);

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
      pdfPath: filePath,
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
