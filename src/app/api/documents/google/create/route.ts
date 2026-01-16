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
    const { documentId, title, content } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Initialize Google Docs API
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

    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Create a new Google Doc
    const doc = await docs.documents.create({
      requestBody: {
        title: title || 'Untitled Document',
      },
    });

    const googleDocId = doc.data.documentId;

    if (!googleDocId) {
      throw new Error("Failed to create Google Doc");
    }

    // Make the document publicly editable (or share with specific users)
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
