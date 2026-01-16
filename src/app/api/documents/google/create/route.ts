import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, title, templateId, patientId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
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

    let googleDocId: string;
    let patientFolderId: string;

    // Create or get patient folder
    const patientFolderName = `Patient_${patientId}`;
    const folderQuery = await drive.files.list({
      q: `name='${patientFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (folderQuery.data.files && folderQuery.data.files.length > 0) {
      patientFolderId = folderQuery.data.files[0].id!;
    } else {
      // Create patient folder
      const folder = await drive.files.create({
        requestBody: {
          name: patientFolderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      patientFolderId = folder.data.id!;
    }

    if (templateId) {
      // Copy template to patient folder
      const copiedFile = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: title || 'Untitled Document',
          parents: [patientFolderId],
        },
      });
      googleDocId = copiedFile.data.id!;
    } else {
      // Create blank document in patient folder
      const file = await drive.files.create({
        requestBody: {
          name: title || 'Untitled Document',
          mimeType: 'application/vnd.google-apps.document',
          parents: [patientFolderId],
        },
        fields: 'id',
      });
      googleDocId = file.data.id!;
    }

    // Make the document editable
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
        google_drive_folder_id: patientFolderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return NextResponse.json({
      googleDocId,
      folderId: patientFolderId,
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
