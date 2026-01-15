import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

// Use service role key for storage access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch template content and convert DOCX to HTML
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // The id could be a template ID from DB or a file path
    let filePath = id;
    
    // If it looks like a UUID, fetch the file_path from database
    if (id.includes("-") && id.length > 30) {
      const { data: template } = await supabaseAdmin
        .from("document_templates")
        .select("file_path")
        .eq("id", id)
        .single();
      
      if (template?.file_path) {
        filePath = template.file_path;
      }
    }

    // Decode the file path if it was URL encoded
    filePath = decodeURIComponent(filePath);

    console.log("Fetching template:", filePath);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from("templates")
      .download(filePath);

    if (downloadError) {
      console.error("Error downloading template:", downloadError);
      return NextResponse.json(
        { error: "Failed to download template", details: downloadError.message },
        { status: 404 }
      );
    }

    if (!fileData) {
      return NextResponse.json(
        { error: "Template file not found" },
        { status: 404 }
      );
    }

    // Get file extension
    const ext = filePath.split(".").pop()?.toLowerCase();

    let htmlContent = "";

    if (ext === "docx") {
      // Convert DOCX to HTML using mammoth
      const arrayBuffer = await fileData.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      htmlContent = result.value;
      
      // Add some basic styling to the HTML
      htmlContent = htmlContent
        .replace(/<p>/g, '<p style="margin-bottom: 0.5em;">')
        .replace(/<h1>/g, '<h1 style="font-size: 1.5em; font-weight: bold; margin-bottom: 0.5em;">')
        .replace(/<h2>/g, '<h2 style="font-size: 1.25em; font-weight: bold; margin-bottom: 0.5em;">')
        .replace(/<h3>/g, '<h3 style="font-size: 1.1em; font-weight: bold; margin-bottom: 0.5em;">');

      if (result.messages && result.messages.length > 0) {
        console.log("Mammoth conversion messages:", result.messages);
      }
    } else if (ext === "txt") {
      // Plain text - wrap in paragraphs
      const text = await fileData.text();
      htmlContent = text
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
    } else if (ext === "html" || ext === "htm") {
      // Already HTML
      htmlContent = await fileData.text();
    } else {
      // Unsupported format
      return NextResponse.json(
        { error: `Unsupported file format: ${ext}`, supportedFormats: ["docx", "txt", "html"] },
        { status: 400 }
      );
    }

    return NextResponse.json({
      content: htmlContent,
      filePath,
      format: ext,
    });
  } catch (error) {
    console.error("Error in template content API:", error);
    return NextResponse.json(
      { error: "Failed to fetch template content" },
      { status: 500 }
    );
  }
}
