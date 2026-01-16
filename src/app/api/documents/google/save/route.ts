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
    const { documentId, googleDocId, patientId } = body;

    if (!documentId || !googleDocId || !patientId) {
      return NextResponse.json(
        { error: "Document ID, Google Doc ID, and Patient ID are required" },
        { status: 400 }
      );
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Export Google Doc as DOCX
    const response = await drive.files.export(
      {
        fileId: googleDocId,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      { responseType: 'arraybuffer' }
    );

    const docxBuffer = Buffer.from(response.data as ArrayBuffer);

    // Save to Supabase patient-docs bucket
    const filePath = `${patientId}/${documentId}.docx`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('patient-docs')
      .upload(filePath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to save document: ${uploadError.message}`);
    }

    // Update document metadata
    await supabaseAdmin
      .from("patient_documents")
      .update({
        updated_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // Optionally delete the Google Doc to save space
    // await drive.files.delete({ fileId: googleDocId });

    return NextResponse.json({
      success: true,
      filePath,
    });
  } catch (error) {
    console.error("Error saving Google Doc:", error);
    return NextResponse.json(
      { error: "Failed to save document", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
