import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

// Use service role key for storage access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch template content and convert DOCX to HTML
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");
    const templateId = searchParams.get("templateId");

    let actualFilePath = filePath;

    // If templateId is provided, fetch file_path from database
    if (templateId && !filePath) {
      const { data: template } = await supabaseAdmin
        .from("document_templates")
        .select("file_path")
        .eq("id", templateId)
        .single();

      if (template?.file_path) {
        actualFilePath = template.file_path;
      }
    }

    if (!actualFilePath) {
      return NextResponse.json(
        { error: "No file path provided" },
        { status: 400 }
      );
    }

    console.log("Fetching template from storage:", actualFilePath);

    // Try to download the file - handle paths with or without encoding
    let fileData: Blob | null = null;
    let downloadError: Error | null = null;

    // First try with the path as-is
    const result1 = await supabaseAdmin
      .storage
      .from("templates")
      .download(actualFilePath);
    
    if (result1.data) {
      fileData = result1.data;
    } else {
      console.log("First download attempt failed:", result1.error?.message);
      
      // Try listing files to find the correct path
      const { data: files } = await supabaseAdmin
        .storage
        .from("templates")
        .list("", { limit: 500 });
      
      if (files) {
        // Find matching file (case-insensitive, handle spaces)
        const targetName = actualFilePath.toLowerCase().replace(/\s+/g, " ");
        const matchingFile = files.find(f => 
          f.name.toLowerCase() === targetName ||
          f.name.toLowerCase().replace(/\s+/g, " ") === targetName
        );
        
        if (matchingFile) {
          console.log("Found matching file:", matchingFile.name);
          const result2 = await supabaseAdmin
            .storage
            .from("templates")
            .download(matchingFile.name);
          
          if (result2.data) {
            fileData = result2.data;
          } else {
            downloadError = result2.error as Error;
          }
        } else {
          console.log("Available files:", files.map(f => f.name).slice(0, 10));
          downloadError = new Error(`File not found: ${actualFilePath}`);
        }
      } else {
        downloadError = result1.error as Error;
      }
    }

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
    const ext = actualFilePath.split(".").pop()?.toLowerCase();
    console.log("File extension:", ext, "File size:", fileData.size);

    let htmlContent = "";

    if (ext === "docx") {
      // Convert DOCX to HTML using mammoth
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log("Buffer size:", buffer.length);
      
      const result = await mammoth.convertToHtml({ buffer });
      htmlContent = result.value;
      
      console.log("Mammoth conversion result length:", htmlContent.length);
      
      if (result.messages && result.messages.length > 0) {
        console.log("Mammoth conversion messages:", result.messages);
      }

      // If content is empty, try to extract raw text
      if (!htmlContent || htmlContent.trim() === "") {
        const textResult = await mammoth.extractRawText({ buffer });
        if (textResult.value) {
          htmlContent = textResult.value
            .split("\n\n")
            .filter((p: string) => p.trim())
            .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("");
          console.log("Extracted raw text, result length:", htmlContent.length);
        }
      }
    } else if (ext === "txt") {
      // Plain text - wrap in paragraphs
      const text = await fileData.text();
      htmlContent = text
        .split("\n\n")
        .filter((p) => p.trim())
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
    } else if (ext === "html" || ext === "htm") {
      // Already HTML
      htmlContent = await fileData.text();
    } else if (ext === "doc") {
      // Old DOC format - not supported by mammoth, return message
      return NextResponse.json({
        content: "<p><strong>Note:</strong> This is an older .doc format file. Please convert it to .docx for full editing support.</p>",
        filePath: actualFilePath,
        format: ext,
        warning: "Old .doc format not fully supported",
      });
    } else {
      return NextResponse.json(
        { error: `Unsupported file format: ${ext}`, supportedFormats: ["docx", "txt", "html"] },
        { status: 400 }
      );
    }

    // Ensure we have some content
    if (!htmlContent || htmlContent.trim() === "") {
      htmlContent = "<p>This template appears to be empty or contains only formatting without text content.</p>";
    }

    return NextResponse.json({
      content: htmlContent,
      filePath: actualFilePath,
      format: ext,
    });
  } catch (error) {
    console.error("Error in template content API:", error);
    return NextResponse.json(
      { error: "Failed to fetch template content", details: String(error) },
      { status: 500 }
    );
  }
}
