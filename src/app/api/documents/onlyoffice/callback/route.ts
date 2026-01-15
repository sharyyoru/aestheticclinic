import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// OnlyOffice callback statuses
const STATUS = {
  EDITING: 1,           // Document is being edited
  READY_FOR_SAVE: 2,    // Document is ready for saving
  SAVE_ERROR: 3,        // Document saving error
  CLOSED_NO_CHANGES: 4, // Document closed with no changes
  SAVE_COMPLETE: 6,     // Document save complete
  FORCE_SAVE: 7,        // Force save while editing
};

interface OnlyOfficeCallback {
  key: string;
  status: number;
  url?: string;
  changesurl?: string;
  history?: object;
  users?: string[];
  actions?: Array<{ type: number; userid: string }>;
  lastsave?: string;
  notmodified?: boolean;
  forcesavetype?: number;
}

// POST - Handle OnlyOffice callback for document saves
export async function POST(request: NextRequest) {
  try {
    const body: OnlyOfficeCallback = await request.json();
    
    console.log("OnlyOffice callback received:", {
      key: body.key,
      status: body.status,
      url: body.url,
    });

    // Parse the document key to extract info (format: patientId_documentId_timestamp)
    const keyParts = body.key.split("_");
    const documentId = keyParts.length >= 2 ? keyParts[1] : body.key;

    switch (body.status) {
      case STATUS.EDITING:
        // Document is being edited - no action needed
        console.log("Document is being edited:", body.key);
        break;

      case STATUS.READY_FOR_SAVE:
      case STATUS.FORCE_SAVE:
        // Document needs to be saved
        if (body.url) {
          console.log("Saving document from URL:", body.url);
          
          try {
            // Download the document from OnlyOffice
            const response = await fetch(body.url);
            if (!response.ok) {
              throw new Error(`Failed to download document: ${response.statusText}`);
            }
            
            const fileBuffer = await response.arrayBuffer();
            const fileName = `${documentId}_${Date.now()}.docx`;
            
            // Upload to Supabase storage
            const { error: uploadError } = await supabaseAdmin
              .storage
              .from("patient-documents")
              .upload(fileName, fileBuffer, {
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                upsert: true,
              });

            if (uploadError) {
              console.error("Error uploading document:", uploadError);
            } else {
              // Update document record in database
              const { error: updateError } = await supabaseAdmin
                .from("patient_documents")
                .update({
                  file_path: fileName,
                  updated_at: new Date().toISOString(),
                  last_edited_at: new Date().toISOString(),
                })
                .eq("id", documentId);

              if (updateError) {
                console.error("Error updating document record:", updateError);
              } else {
                console.log("Document saved successfully:", fileName);
              }
            }
          } catch (saveError) {
            console.error("Error saving document:", saveError);
          }
        }
        break;

      case STATUS.SAVE_COMPLETE:
        console.log("Document save completed:", body.key);
        break;

      case STATUS.CLOSED_NO_CHANGES:
        console.log("Document closed without changes:", body.key);
        break;

      case STATUS.SAVE_ERROR:
        console.error("Document save error:", body.key);
        break;
    }

    // OnlyOffice expects a JSON response with error code 0 for success
    return NextResponse.json({ error: 0 });
  } catch (error) {
    console.error("Error in OnlyOffice callback:", error);
    // Return error 0 anyway to prevent OnlyOffice from retrying
    return NextResponse.json({ error: 0 });
  }
}
