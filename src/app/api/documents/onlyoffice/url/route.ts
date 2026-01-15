import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Generate a signed URL for OnlyOffice to access a document
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");
    const bucket = searchParams.get("bucket") || "templates";

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    console.log(`Generating signed URL for ${bucket}/${filePath}`);

    // Generate a signed URL that OnlyOffice can access
    // The URL needs to be publicly accessible or accessible via the signed token
    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error("Error generating signed URL:", error);
      return NextResponse.json(
        { error: "Failed to generate document URL", details: error.message },
        { status: 500 }
      );
    }

    // Generate a unique document key for OnlyOffice
    // The key should change when the document changes to force reload
    const timestamp = Date.now();
    const documentKey = `doc_${filePath.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

    return NextResponse.json({
      url: data.signedUrl,
      key: documentKey,
      fileName: filePath,
      fileType: filePath.split(".").pop() || "docx",
    });
  } catch (error) {
    console.error("Error in OnlyOffice URL API:", error);
    return NextResponse.json(
      { error: "Failed to generate document URL" },
      { status: 500 }
    );
  }
}
