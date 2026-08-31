# Document Editing

## Overview

The system supports multiple document formats:
- **DOCX**: Templates with variable substitution
- **PDF**: Generated invoices, reports
- **Images**: Photo annotation with Fabric.js

## DOCX Templates

### Placeholder Syntax

Two placeholder formats are supported:

1. **Simple placeholders**: `${variableName}`
2. **Content controls**: Word XML content controls with tags

```xml
<!-- Simple placeholder -->
${patient.firstName} ${patient.lastName}

<!-- Content control (Word XML) -->
<w:sdt>
  <w:sdtPr>
    <w:tag w:val="patientInfo.firstName"/>
  </w:sdtPr>
  <w:sdtContent>
    <w:t>John</w:t>
  </w:sdtContent>
</w:sdt>
```

### Template Variables

```typescript
interface TemplateVariables {
  // Patient info
  patientInfo: {
    firstName: string;
    lastName: string;
    fullName: string;
    dob: string;
    email: string;
    phone: string;
    address: string;
    ahvNumber?: string;
  };
  
  // Clinic/mandator info
  mandatorInfo: {
    clinicName: string;
    address: string;
    phone: string;
    email: string;
    glnNumber: string;
  };
  
  // Dynamic values
  currentDate: string;
  invoiceNumber?: string;
}
```

### Server-Side Template Processing

```typescript
// src/lib/docxTemplate.ts
import JSZip from "jszip";

export async function processDocxTemplate(
  templateBuffer: ArrayBuffer,
  variables: TemplateVariables
): Promise<{ buffer: ArrayBuffer; missingFields: string[] }> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const missingFields: string[] = [];
  
  // Process document.xml
  let documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("Invalid DOCX");

  // Replace ${...} placeholders
  documentXml = documentXml.replace(
    /\$\{([^}]+)\}/g,
    (match, path) => {
      const value = getNestedValue(variables, path);
      if (value === undefined) {
        missingFields.push(path);
        return `[Missing: ${path}]`;
      }
      return escapeXml(value);
    }
  );

  // Process content controls
  documentXml = processContentControls(documentXml, variables, missingFields);

  zip.file("word/document.xml", documentXml);
  
  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  return { buffer, missingFields };
}

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

### API Route for Template Processing

```typescript
// src/app/api/documents/patient/create-from-template/route.ts
export async function POST(request: NextRequest) {
  const { templatePath, patientId } = await request.json();

  // Fetch template
  const { data: templateData } = await supabaseAdmin.storage
    .from("document-templates")
    .download(templatePath);

  // Fetch patient data
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  // Process template
  const variables = buildTemplateVariables(patient);
  const { buffer, missingFields } = await processDocxTemplate(
    await templateData.arrayBuffer(),
    variables
  );

  // Upload processed document
  const fileName = `${patient.last_name}_${Date.now()}.docx`;
  await supabaseAdmin.storage
    .from("patient-documents")
    .upload(`${patientId}/${fileName}`, buffer);

  return NextResponse.json({ fileName, missingFields });
}
```

## PDF Generation

### Using jsPDF

```typescript
import { jsPDF } from "jspdf";

export function generateInvoicePdf(invoice: Invoice): ArrayBuffer {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text("INVOICE", 105, 20, { align: "center" });
  
  // Invoice details
  doc.setFontSize(12);
  doc.text(`Invoice #: ${invoice.number}`, 20, 40);
  doc.text(`Date: ${invoice.date}`, 20, 50);
  
  // Line items table
  let y = 70;
  invoice.items.forEach(item => {
    doc.text(item.description, 20, y);
    doc.text(`CHF ${item.amount.toFixed(2)}`, 180, y, { align: "right" });
    y += 10;
  });
  
  // Total
  doc.setFont(undefined, "bold");
  doc.text(`Total: CHF ${invoice.total.toFixed(2)}`, 180, y + 10, { align: "right" });
  
  return doc.output("arraybuffer");
}
```

### Using pdf-lib (for manipulation)

```typescript
import { PDFDocument } from "pdf-lib";

export async function addWatermark(pdfBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  
  for (const page of pages) {
    page.drawText("CONFIDENTIAL", {
      x: 200,
      y: 400,
      size: 50,
      opacity: 0.3,
      rotate: degrees(45),
    });
  }
  
  return await pdfDoc.save();
}
```

## Storage Buckets

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('document-templates', 'document-templates', false),
  ('patient-documents', 'patient-documents', false),
  ('invoice-pdfs', 'invoice-pdfs', true);

-- RLS policies
CREATE POLICY "Authenticated users can read templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'document-templates');

CREATE POLICY "Authenticated users can manage patient docs"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'patient-documents');
```

## Document Database Schema

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  type document_type NOT NULL,          -- 'report', 'post_op', 'consent', etc.
  title TEXT NOT NULL,
  content TEXT,                          -- For text-based documents
  file_path TEXT,                        -- Storage path
  file_name TEXT,
  file_type TEXT,                        -- MIME type
  created_by UUID REFERENCES users(id),
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE document_type AS ENUM (
  'report',
  'post_op',
  'consent',
  'invoice',
  'other'
);
```

## Image Annotation (Fabric.js)

```typescript
// Client-side annotation component
"use client";
import { useEffect, useRef } from "react";
import { fabric } from "fabric";

export function ImageAnnotator({ imageSrc, onSave }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    fabricRef.current = new fabric.Canvas(canvasRef.current);
    
    fabric.Image.fromURL(imageSrc, (img) => {
      fabricRef.current?.setBackgroundImage(img, () => {
        fabricRef.current?.renderAll();
      });
    });

    return () => fabricRef.current?.dispose();
  }, [imageSrc]);

  const addText = () => {
    const text = new fabric.IText("Click to edit", {
      left: 100,
      top: 100,
      fontSize: 20,
    });
    fabricRef.current?.add(text);
  };

  const addCircle = () => {
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 30,
      fill: "transparent",
      stroke: "red",
      strokeWidth: 2,
    });
    fabricRef.current?.add(circle);
  };

  const save = () => {
    const dataUrl = fabricRef.current?.toDataURL({ format: "png" });
    onSave(dataUrl);
  };

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={600} />
      <button onClick={addText}>Add Text</button>
      <button onClick={addCircle}>Add Circle</button>
      <button onClick={save}>Save</button>
    </div>
  );
}
```

## External Editing (OnlyOffice)

```typescript
// OnlyOffice integration for collaborative editing
export function getOnlyOfficeConfig(document: Document, user: User) {
  return {
    document: {
      fileType: "docx",
      key: document.id,
      title: document.title,
      url: getDocumentUrl(document.file_path),
    },
    editorConfig: {
      callbackUrl: `${process.env.APP_URL}/api/onlyoffice/callback`,
      user: {
        id: user.id,
        name: user.full_name,
      },
    },
  };
}
```
