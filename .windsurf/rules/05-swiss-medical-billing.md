# Swiss Medical Billing

## Overview

Swiss medical billing follows specific standards for insurance claims and patient invoicing:

- **SUMEX**: XML format for electronic billing to Swiss insurance companies
- **TarDoc/TarMed**: Medical procedure codes and pricing
- **Swiss QR Bill**: Standard payment slip format with QR code

## Key Libraries

```typescript
// src/lib/
├── sumexInvoice.ts    // SUMEX XML generation
├── tardoc.ts          // TarDoc code lookup
├── medidata.ts        // Medidata patient/provider lookup
└── swissQrBill.ts     // Swiss QR Bill generation
```

## SUMEX Invoice Generation

```typescript
// src/lib/sumexInvoice.ts
export function generateSumexXml(invoice: Invoice): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<invoice:request 
  xmlns:invoice="http://www.forum-datenaustausch.ch/invoice"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <invoice:header>
    <invoice:sender>
      <invoice:ean_party>${provider.ean}</invoice:ean_party>
    </invoice:sender>
    <invoice:intermediate>
      <invoice:ean_party>${insurer.ean}</invoice:ean_party>
    </invoice:intermediate>
    <invoice:recipient>
      <invoice:ean_party>${insurer.ean}</invoice:ean_party>
    </invoice:recipient>
  </invoice:header>
  <invoice:body>
    <invoice:prolog>
      <invoice:package name="AestheticsCRM" version="1.0"/>
    </invoice:prolog>
    <invoice:balance 
      amount="${invoice.total}" 
      amount_due="${invoice.amountDue}"/>
    <invoice:services>
      ${invoice.services.map(s => `
        <invoice:record_tardoc 
          code="${s.tardocCode}" 
          quantity="${s.quantity}" 
          amount="${s.amount}"/>
      `).join('')}
    </invoice:services>
  </invoice:body>
</invoice:request>`;
  
  return xml;
}
```

## TarDoc Code Lookup

```typescript
// src/lib/tardoc.ts
export interface TarDocCode {
  code: string;
  description: string;
  technicalPoints: number;
  medicalPoints: number;
  chapter: string;
}

export async function lookupTarDocCode(code: string): Promise<TarDocCode | null> {
  const { data } = await supabaseAdmin
    .from("tardoc_codes")
    .select("*")
    .eq("code", code)
    .single();
  
  return data;
}

export function calculateTarDocPrice(
  code: TarDocCode,
  taxPointValue: number = 0.89  // Current Swiss tax point value
): number {
  const technicalAmount = code.technicalPoints * taxPointValue;
  const medicalAmount = code.medicalPoints * taxPointValue;
  return technicalAmount + medicalAmount;
}
```

## Swiss QR Bill Generation

```typescript
// src/lib/swissQrBill.ts
import QRCode from "qrcode";

export interface QrBillData {
  iban: string;
  creditorName: string;
  creditorAddress: string;
  creditorZip: string;
  creditorCity: string;
  amount: number;
  currency: "CHF" | "EUR";
  reference: string;  // QR reference number
  debtorName?: string;
  debtorAddress?: string;
}

export function generateQrPayload(data: QrBillData): string {
  return [
    "SPC",                          // Swiss Payment Code
    "0200",                         // Version
    "1",                            // Coding type
    data.iban,
    "K",                            // Address type (combined)
    data.creditorName,
    data.creditorAddress,
    `${data.creditorZip} ${data.creditorCity}`,
    "",                             // Country (empty for CH)
    "",
    "CH",
    data.amount.toFixed(2),
    data.currency,
    "K",
    data.debtorName || "",
    data.debtorAddress || "",
    "",
    "",
    "",
    "CH",
    "QRR",                          // Reference type
    data.reference,
    "",                             // Additional info
    "EPD",                          // End payment data
  ].join("\n");
}

export async function generateQrCode(data: QrBillData): Promise<string> {
  const payload = generateQrPayload(data);
  return await QRCode.toDataURL(payload, {
    width: 200,
    margin: 0,
    errorCorrectionLevel: "M",
  });
}
```

## Invoice PDF with QR Code

```typescript
// src/app/api/invoices/generate-pdf/route.ts
import { jsPDF } from "jspdf";
import { generateQrCode } from "@/lib/swissQrBill";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json();

  // Fetch invoice data
  const { data: invoice } = await supabaseAdmin
    .from("consultations")
    .select("*, patient:patients(*)")
    .eq("id", invoiceId)
    .single();

  // Generate QR code
  const qrDataUrl = await generateQrCode({
    iban: "CH09 3078 8000 0502 4628 9",
    creditorName: "Aesthetics Clinic SA",
    creditorAddress: "Rue du Rhône 100",
    creditorZip: "1204",
    creditorCity: "Geneva",
    amount: invoice.invoice_total_amount,
    currency: "CHF",
    reference: invoice.consultation_id,
    debtorName: `${invoice.patient.first_name} ${invoice.patient.last_name}`,
  });

  // Create PDF
  const doc = new jsPDF();
  
  // Add clinic header
  doc.setFontSize(20);
  doc.text("Aesthetics Clinic", 20, 20);
  
  // Add patient info
  doc.setFontSize(12);
  doc.text(`Patient: ${invoice.patient.first_name} ${invoice.patient.last_name}`, 20, 40);
  
  // Add invoice details
  doc.text(`Invoice: ${invoice.consultation_id}`, 20, 50);
  doc.text(`Amount: CHF ${invoice.invoice_total_amount}`, 20, 60);
  
  // Add QR code
  doc.addImage(qrDataUrl, "PNG", 20, 200, 50, 50);

  // Upload to storage
  const pdfBuffer = doc.output("arraybuffer");
  await supabaseAdmin.storage
    .from("invoice-pdfs")
    .upload(`${invoiceId}.pdf`, pdfBuffer);

  return NextResponse.json({ success: true });
}
```

## Insurance Integration (Medidata)

```typescript
// src/lib/medidata.ts
export async function lookupInsurer(glnNumber: string) {
  const { data } = await supabaseAdmin
    .from("swiss_insurers")
    .select("*")
    .eq("gln", glnNumber)
    .single();
  
  return data;
}

export async function verifyPatientCoverage(
  patientAhv: string,  // Swiss AHV/AVS number
  insurerGln: string
): Promise<CoverageResult> {
  // Integration with Medidata API
  const response = await fetch("https://api.medidata.ch/coverage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MEDIDATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ahvNumber: patientAhv, insurerGln }),
  });
  
  return response.json();
}
```

## Database Schema

```sql
-- Swiss insurers
CREATE TABLE swiss_insurers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gln TEXT UNIQUE,                    -- Global Location Number
  bur_number TEXT,                    -- BUR number
  street TEXT,
  zip TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  receiver_email TEXT,                -- For SUMEX submissions
  accepts_electronic_billing BOOLEAN DEFAULT true
);

-- TarDoc codes
CREATE TABLE tardoc_codes (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  description_fr TEXT,
  description_it TEXT,
  technical_points DECIMAL(10,2),
  medical_points DECIMAL(10,2),
  chapter TEXT,
  valid_from DATE,
  valid_until DATE
);

-- Patient insurance
CREATE TABLE patient_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  insurer_id UUID REFERENCES swiss_insurers(id),
  policy_number TEXT,
  ahv_number TEXT,                    -- Swiss social security number
  is_primary BOOLEAN DEFAULT false
);
```

## Payment Methods

```typescript
// Supported Swiss payment methods
type PaymentMethod = 
  | "cash"
  | "bank_transfer"      // With Swiss QR Bill
  | "online_payment"     // Payrexx integration
  | "insurance_direct"   // Direct billing to insurance
  | "twint";             // Swiss mobile payment
```
