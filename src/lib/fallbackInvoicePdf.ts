import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Invoice, InvoiceLineItem } from "@/lib/invoiceTypes";
import { generateSwissQrBillDataUrl, generateSwissReference, type SwissQrBillData } from "@/lib/swissQrBill";

type Party = {
  name: string;
  street?: string | null;
  streetNo?: string | null;
  postalCode?: string | null;
  town?: string | null;
  iban?: string | null;
  phone?: string | null;
};

type Patient = {
  first_name: string;
  last_name: string;
  dob: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
};

type FallbackInvoicePdfInput = {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  patient: Patient;
  biller: Party;
};

const money = (value: number | null | undefined) => `${(Number(value) || 0).toFixed(2)} CHF`;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("fr-CH") : "";

export async function buildFallbackInvoicePdf({ invoice, lineItems, patient, biller }: FallbackInvoicePdfInput): Promise<Buffer> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const total = Number(invoice.total_amount) || 0;
  const paid = Number(invoice.paid_amount) || 0;
  const remaining = Math.max(0, total - paid);

  pdf.setFillColor(35, 45, 60);
  pdf.rect(0, 0, width, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(biller.name, margin, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text([`${biller.street || ""} ${biller.streetNo || ""}`.trim(), `${biller.postalCode || ""} ${biller.town || ""}`.trim(), biller.phone || ""].filter(Boolean), margin, 21);

  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(paid >= total - 0.01 ? "QUITTANCE" : "FACTURE", margin, 53);
  pdf.setFontSize(10);
  pdf.text(`N° ${invoice.invoice_number}`, width - margin, 49, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.text(`Date: ${date(invoice.invoice_date)}`, width - margin, 55, { align: "right" });
  if (invoice.due_date) pdf.text(`Échéance: ${date(invoice.due_date)}`, width - margin, 61, { align: "right" });

  pdf.setFont("helvetica", "bold");
  pdf.text("Patient", margin, 70);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${patient.first_name} ${patient.last_name}`, margin, 76);
  const patientAddress = [patient.street_address, `${patient.postal_code || ""} ${patient.town || ""}`.trim()].filter(Boolean) as string[];
  if (patientAddress.length) pdf.text(patientAddress, margin, 82);
  if (patient.dob) pdf.text(`Date de naissance: ${date(patient.dob)}`, width - margin, 76, { align: "right" });

  let y = 101;
  pdf.setFillColor(232, 235, 239);
  pdf.rect(margin, y - 6, width - margin * 2, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Date", margin + 2, y - 1);
  pdf.text("Code", margin + 25, y - 1);
  pdf.text("Prestation", margin + 48, y - 1);
  pdf.text("Qté", width - 63, y - 1, { align: "right" });
  pdf.text("Prix", width - 35, y - 1, { align: "right" });
  pdf.text("Total", width - margin - 2, y - 1, { align: "right" });
  y += 5;
  pdf.setFont("helvetica", "normal");

  for (const item of lineItems) {
    if (y > 245) {
      pdf.addPage();
      y = 20;
    }
    const serviceDate = date(item.date_begin || invoice.treatment_date || invoice.invoice_date);
    const description = pdf.splitTextToSize(item.name || "Prestation", 61);
    pdf.text(serviceDate, margin + 2, y);
    pdf.text(item.code || item.tardoc_code || "-", margin + 25, y);
    pdf.text(description, margin + 48, y);
    pdf.text(String(Number(item.quantity) || 1), width - 63, y, { align: "right" });
    pdf.text((Number(item.unit_price) || 0).toFixed(2), width - 35, y, { align: "right" });
    pdf.text((Number(item.total_price) || 0).toFixed(2), width - margin - 2, y, { align: "right" });
    y += Math.max(7, description.length * 4);
  }

  y = Math.max(y + 4, 155);
  if (y > 205) {
    pdf.addPage();
    y = 20;
  }
  pdf.setDrawColor(200, 200, 200);
  pdf.line(width - 82, y, width - margin, y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Total", width - 55, y + 7, { align: "right" });
  pdf.text(money(total), width - margin, y + 7, { align: "right" });
  if (paid > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Déjà payé", width - 55, y + 14, { align: "right" });
    pdf.text(`-${money(paid)}`, width - margin, y + 14, { align: "right" });
  }
  pdf.setFont("helvetica", "bold");
  pdf.text("Solde", width - 55, y + 22, { align: "right" });
  pdf.text(money(remaining), width - margin, y + 22, { align: "right" });

  if (remaining > 0 && biller.iban) {
    let qrDataUrl: string | null = null;
    if (invoice.payrexx_payment_link) {
      qrDataUrl = await QRCode.toDataURL(invoice.payrexx_payment_link, { width: 300, margin: 1 });
    } else {
      const addressMatch = (patient.street_address || "").match(/^(.+?)\s+(\d+\S*)$/);
      const qrData: SwissQrBillData = {
        iban: biller.iban.replace(/\s/g, ""),
        creditorName: biller.name,
        creditorStreet: biller.street || "",
        creditorBuildingNumber: biller.streetNo || "",
        creditorPostalCode: biller.postalCode || "",
        creditorTown: biller.town || "",
        creditorCountry: "CH",
        amount: remaining,
        currency: "CHF",
        debtorName: `${patient.first_name} ${patient.last_name}`,
        debtorStreet: addressMatch?.[1] || patient.street_address || undefined,
        debtorBuildingNumber: addressMatch?.[2] || undefined,
        debtorPostalCode: patient.postal_code || undefined,
        debtorTown: patient.town || undefined,
        debtorCountry: "CH",
        referenceType: "QRR",
        reference: generateSwissReference(invoice.invoice_number),
        unstructuredMessage: `Facture ${invoice.invoice_number}`,
      };
      qrDataUrl = await generateSwissQrBillDataUrl(qrData);
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`IBAN: ${biller.iban}`, margin, y + 38);
    pdf.addImage(qrDataUrl, "PNG", margin, y + 43, 38, 38);
  }

  pdf.setTextColor(110, 110, 110);
  pdf.setFontSize(7);
  pdf.text("Document de secours généré localement pendant l’indisponibilité du service de facturation.", margin, 289);
  return Buffer.from(pdf.output("arraybuffer"));
}
