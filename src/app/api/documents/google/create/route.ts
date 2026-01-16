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

    // Check environment variables
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKey) {
      console.error('Missing Google credentials:', {
        hasEmail: !!serviceAccountEmail,
        hasKey: !!privateKey,
      });
      return NextResponse.json(
        { error: "Google service account credentials not configured" },
        { status: 500 }
      );
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
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
      console.log('Downloading template:', templatePath);
      // Download template from 'templates' bucket
      const { data: templateData, error: templateError } = await supabaseAdmin.storage
        .from('templates')
        .download(templatePath);

      if (templateError || !templateData) {
        console.error('Template download error:', templateError);
        throw new Error(`Failed to download template: ${templateError?.message || 'Unknown error'}`);
      }

      docxBuffer = Buffer.from(await templateData.arrayBuffer());
      console.log('Template downloaded, size:', docxBuffer.length);
    } else {
      // Check if document already exists in patient-docs
      const docPath = `${patientId}/${documentId}.docx`;
      console.log('Checking for existing document:', docPath);
      
      const { data: existingDoc, error: existingError } = await supabaseAdmin.storage
        .from('patient-docs')
        .download(docPath);

      if (existingDoc) {
        docxBuffer = Buffer.from(await existingDoc.arrayBuffer());
        console.log('Existing document found, size:', docxBuffer.length);
      } else {
        // Create blank document
        console.log('Creating blank document');
        docxBuffer = Buffer.from(''); // Will create empty Google Doc
      }
    }

    // Upload DOCX to Google Drive and convert to Google Docs format
    let googleDocId: string;

    // IMPORTANT: Set appDataFolder to avoid using service account's storage quota
    // Documents will be temporary and accessible via link only
    if (docxBuffer.length > 0) {
      // Upload and convert DOCX to Google Docs
      console.log('Uploading DOCX to Google Drive...');
      try {
        const file = await drive.files.create({
          requestBody: {
            name: title || 'Untitled Document',
            mimeType: 'application/vnd.google-apps.document',
            // Don't specify parents - creates in root but with link-only access
          },
          media: {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            body: Readable.from(docxBuffer),
          },
          fields: 'id,webViewLink',
          supportsAllDrives: true,
        });
        googleDocId = file.data.id!;
        console.log('Google Doc created:', googleDocId);
        
        // Immediately set to delete after 30 days to manage quota
        try {
          await drive.files.update({
            fileId: googleDocId,
            requestBody: {
              trashed: false,
              // Add metadata to track creation
              description: `Created: ${new Date().toISOString()} - Patient: ${patientId}`,
            },
          });
        } catch (metaError) {
          console.log('Could not set metadata:', metaError);
        }
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload document: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
      }
    } else {
      // Create blank Google Doc
      console.log('Creating blank Google Doc...');
      try {
        const file = await drive.files.create({
          requestBody: {
            name: title || 'Untitled Document',
            mimeType: 'application/vnd.google-apps.document',
            description: `Created: ${new Date().toISOString()} - Patient: ${patientId}`,
          },
          fields: 'id,webViewLink',
          supportsAllDrives: true,
        });
        googleDocId = file.data.id!;
        console.log('Blank Google Doc created:', googleDocId);
      } catch (createError) {
        console.error('Create error:', createError);
        throw new Error(`Failed to create document: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
      }
    }

    // Make the document editable by anyone with the link
    console.log('Setting permissions...');
    try {
      await drive.permissions.create({
        fileId: googleDocId,
        requestBody: {
          role: 'writer',
          type: 'anyone',
        },
      });
      console.log('Permissions set successfully');
    } catch (permError) {
      console.error('Permission error:', permError);
      // Continue anyway, document is created
    }

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
