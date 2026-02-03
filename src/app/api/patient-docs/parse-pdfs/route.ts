import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force Node.js runtime and dynamic rendering
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET_NAME = "patient-docs";

type ParsedPdfDocument = {
  folderName: string;
  fileName: string;
  fileType: "ap" | "consultation";
  content: string;
  firstName: string | null;
  lastName: string | null;
};

// Parse folder name pattern: axenita-id_firstname_lastname_dd-mm-yyyy
function parseFolderName(folderName: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = folderName.split("_");
  
  if (parts.length >= 3) {
    return {
      firstName: parts[1],
      lastName: parts[2],
    };
  }
  
  return { firstName: null, lastName: null };
}

// Determine file type from filename
function getFileType(fileName: string): "ap" | "consultation" | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName === "ap.pdf") return "ap";
  if (lowerName.startsWith("consultation") && lowerName.endsWith(".pdf")) return "consultation";
  return null;
}

// Simple PDF text extraction without external library
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Convert buffer to string and look for text content
    const content = buffer.toString("utf8");
    
    // Simple extraction: find text between stream...endstream or BT...ET
    const textMatches: string[] = [];
    
    // Look for text objects (simplified approach)
    const btEtRegex = /BT[\s\S]*?ET/g;
    const matches = content.match(btEtRegex) || [];
    
    for (const match of matches) {
      // Extract text from Tj and TJ operators
      const tjMatches = match.match(/\(([^)]*)\)\s*Tj/g) || [];
      for (const tj of tjMatches) {
        const text = tj.match(/\(([^)]*)\)/)?.[1] || "";
        if (text) textMatches.push(text);
      }
    }
    
    // If no text found with PDF parsing, try to find readable strings
    if (textMatches.length === 0) {
      // Look for readable text patterns
      const readableText = content.match(/[\x20-\x7E]{10,}/g) || [];
      return readableText.slice(0, 20).join(" ").substring(0, 500);
    }
    
    return textMatches.join(" ").substring(0, 1000);
  } catch {
    return "[PDF content - unable to extract text]";
  }
}

async function processPdfFile(
  folderPath: string,
  fileName: string,
  folderInfo: ReturnType<typeof parseFolderName>,
  parsedDocuments: ParsedPdfDocument[]
) {
  const fileType = getFileType(fileName);
  if (!fileType) return;

  const filePath = `${folderPath}/${fileName}`;

  try {
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error(`Error downloading ${filePath}:`, downloadError);
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const content = await extractPdfText(buffer);

    const singleLineContent = content
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    parsedDocuments.push({
      folderName: folderPath.split("/")[0],
      fileName,
      fileType,
      content: singleLineContent || `[${fileType === "ap" ? "Medical Notes" : "Consultation"} document]`,
      firstName: folderInfo.firstName,
      lastName: folderInfo.lastName,
    });
  } catch (parseError: any) {
    console.error(`Error processing PDF ${filePath}:`, parseError.message);
    // Still add the document with placeholder content
    parsedDocuments.push({
      folderName: folderPath.split("/")[0],
      fileName,
      fileType,
      content: `[${fileType === "ap" ? "Medical Notes" : "Consultation"} document]`,
      firstName: folderInfo.firstName,
      lastName: folderInfo.lastName,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");

    const { data: folders, error: listError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list("", { limit: 1000 });

    if (listError) {
      console.error("Error listing folders:", listError);
      return NextResponse.json({ error: "Failed to list folders" }, { status: 500 });
    }

    if (!folders || folders.length === 0) {
      return NextResponse.json({ documents: [] });
    }

    const parsedDocuments: ParsedPdfDocument[] = [];

    for (const folder of folders) {
      if (!folder.id || folder.name.includes(".")) continue;

      const folderInfo = parseFolderName(folder.name);

      if (firstName && lastName) {
        const folderFirstName = folderInfo.firstName?.toLowerCase() || "";
        const folderLastName = folderInfo.lastName?.toLowerCase() || "";
        const searchFirstName = firstName.toLowerCase();
        const searchLastName = lastName.toLowerCase();

        const firstNameMatch = folderFirstName.includes(searchFirstName) || searchFirstName.includes(folderFirstName);
        const lastNameMatch = folderLastName.includes(searchLastName) || searchLastName.includes(folderLastName);

        if (!firstNameMatch || !lastNameMatch) continue;
      }

      const { data: subItems, error: subError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .list(folder.name, { limit: 100 });

      if (subError || !subItems) continue;

      for (const item of subItems) {
        if (item.name.endsWith(".pdf")) {
          await processPdfFile(folder.name, item.name, folderInfo, parsedDocuments);
        } else if (!item.name.includes(".")) {
          const subfolderPath = `${folder.name}/${item.name}`;
          const { data: subfolderFiles } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(subfolderPath, { limit: 100 });

          if (subfolderFiles) {
            for (const file of subfolderFiles) {
              if (file.name.endsWith(".pdf")) {
                await processPdfFile(subfolderPath, file.name, folderInfo, parsedDocuments);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ documents: parsedDocuments });
  } catch (error: any) {
    console.error("Error in parse-pdfs GET:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName } = body;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
    }

    const { data: folders, error: listError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list("", { limit: 1000 });

    if (listError) {
      console.error("Error listing folders:", listError);
      return NextResponse.json({ error: "Failed to list folders" }, { status: 500 });
    }

    if (!folders || folders.length === 0) {
      return NextResponse.json({ documents: [] });
    }

    const parsedDocuments: ParsedPdfDocument[] = [];

    for (const folder of folders) {
      if (!folder.id || folder.name.includes(".")) continue;

      const folderInfo = parseFolderName(folder.name);

      const folderFirstName = folderInfo.firstName?.toLowerCase() || "";
      const folderLastName = folderInfo.lastName?.toLowerCase() || "";
      const searchFirstName = firstName.toLowerCase();
      const searchLastName = lastName.toLowerCase();

      const firstNameMatch = folderFirstName === searchFirstName || 
        folderFirstName.includes(searchFirstName) || 
        searchFirstName.includes(folderFirstName);
      const lastNameMatch = folderLastName === searchLastName || 
        folderLastName.includes(searchLastName) || 
        searchLastName.includes(folderLastName);

      if (!firstNameMatch || !lastNameMatch) continue;

      const { data: subItems, error: subError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .list(folder.name, { limit: 100 });

      if (subError || !subItems) continue;

      for (const item of subItems) {
        if (item.name.endsWith(".pdf")) {
          await processPdfFile(folder.name, item.name, folderInfo, parsedDocuments);
        } else if (!item.name.includes(".")) {
          const subfolderPath = `${folder.name}/${item.name}`;
          const { data: subfolderFiles } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(subfolderPath, { limit: 100 });

          if (subfolderFiles) {
            for (const file of subfolderFiles) {
              if (file.name.endsWith(".pdf")) {
                await processPdfFile(subfolderPath, file.name, folderInfo, parsedDocuments);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ documents: parsedDocuments });
  } catch (error: any) {
    console.error("Error in parse-pdfs POST:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
