import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, title, templatePath, patientId } = body;

    if (!documentId || !patientId) {
      return NextResponse.json(
        { error: "Document ID and Patient ID are required" },
        { status: 400 }
      );
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    let docxBuffer: Buffer;

    // Download template or existing document from Supabase
    if (templatePath) {
      // Download template from 'templates' bucket
      const { data: templateData, error: templateError } = await supabaseAdmin.storage
        .from('templates')
        .download(templatePath);

      if (templateError || !templateData) {
        throw new Error(`Failed to download template: ${templateError?.message}`);
      }

      docxBuffer = Buffer.from(await templateData.arrayBuffer());
    } else {
      // Check if document already exists in patient-docs
      const docPath = `${patientId}/${documentId}.docx`;
      const { data: existingDoc, error: existingError } = await supabaseAdmin.storage
        .from('patient-docs')
        .download(docPath);

      if (existingDoc) {
        docxBuffer = Buffer.from(await existingDoc.arrayBuffer());
      } else {
        // Create blank document
        docxBuffer = Buffer.from(''); // Will create empty Google Doc
      }
    }

    // Upload DOCX to Google Drive and convert to Google Docs format
    let googleDocId: string;

    if (docxBuffer.length > 0) {
      // Upload and convert DOCX to Google Docs
      const file = await drive.files.create({
        requestBody: {
          name: title || 'Untitled Document',
          mimeType: 'application/vnd.google-apps.document',
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: Readable.from(docxBuffer),
        },
        fields: 'id',
      });
      googleDocId = file.data.id!;
    } else {
      // Create blank Google Doc
      const file = await drive.files.create({
        requestBody: {
          name: title || 'Untitled Document',
          mimeType: 'application/vnd.google-apps.document',
        },
        fields: 'id',
      });
      googleDocId = file.data.id!;
    }

    // Make the document editable by anyone with the link
    await drive.permissions.create({
      fileId: googleDocId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    });

    // Update the patient document with Google Doc ID
    await supabaseAdmin
      .from("patient_documents")
      .update({
        google_doc_id: googleDocId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return NextResponse.json({
      googleDocId,
      url: `https://docs.google.com/document/d/${googleDocId}/edit`,
    });
  } catch (error) {
    console.error("Error creating Google Doc:", error);
    return NextResponse.json(
      { error: "Failed to create Google Doc", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
