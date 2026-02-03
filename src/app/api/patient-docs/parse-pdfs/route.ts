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

type DebugInfo = {
  bucket: string;
  searchFirstName: string | null;
  searchLastName: string | null;
  foldersFound: number;
  folderNames: string[];
  parsedFolders: Array<{ name: string; firstName: string | null; lastName: string | null; matched: boolean }>;
};

// Parse folder name pattern: axenita-id_firstname_lastname_dd-mm-yyyy
// Also try other patterns like firstname_lastname or lastname_firstname
function parseFolderName(folderName: string): {
  firstName: string | null;
  lastName: string | null;
} {
  // Remove file extensions if any
  const cleanName = folderName.replace(/\.[^.]+$/, "");
  
  // Try splitting by underscore
  const underscoreParts = cleanName.split("_");
  
  // Pattern: axenita-id_firstname_lastname_dd-mm-yyyy (4+ parts)
  if (underscoreParts.length >= 4) {
    return {
      firstName: underscoreParts[1],
      lastName: underscoreParts[2],
    };
  }
  
  // Pattern: axenita-id_firstname_lastname (3 parts)
  if (underscoreParts.length === 3) {
    return {
      firstName: underscoreParts[1],
      lastName: underscoreParts[2],
    };
  }
  
  // Pattern: firstname_lastname (2 parts)
  if (underscoreParts.length === 2) {
    return {
      firstName: underscoreParts[0],
      lastName: underscoreParts[1],
    };
  }
  
  // Try splitting by hyphen
  const hyphenParts = cleanName.split("-");
  if (hyphenParts.length >= 2) {
    return {
      firstName: hyphenParts[0],
      lastName: hyphenParts[1],
    };
  }
  
  // Try splitting by space
  const spaceParts = cleanName.split(/\s+/);
  if (spaceParts.length >= 2) {
    return {
      firstName: spaceParts[0],
      lastName: spaceParts[spaceParts.length - 1],
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

// Helper to fetch all folders with pagination
async function fetchAllFolders(): Promise<{ name: string; id: string | null }[]> {
  const allFolders: { name: string; id: string | null }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: folders, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list("", { limit: PAGE_SIZE, offset });

    if (error) {
      console.error("Error listing folders at offset", offset, error);
      break;
    }

    if (!folders || folders.length === 0) {
      hasMore = false;
    } else {
      allFolders.push(...folders.map(f => ({ name: f.name, id: f.id })));
      offset += folders.length;
      hasMore = folders.length === PAGE_SIZE;
    }
  }

  return allFolders;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");

    console.log("DEBUG GET - Bucket:", BUCKET_NAME);

    // Fetch ALL folders with pagination
    const folders = await fetchAllFolders();

    console.log("DEBUG GET - Total folders found:", folders.length);

    if (folders.length === 0) {
      return NextResponse.json({ documents: [], debug: { bucket: BUCKET_NAME, foldersFound: 0 } });
    }

    const parsedDocuments: ParsedPdfDocument[] = [];

    for (const folder of folders) {
      // Skip files at root level (folders typically don't have common file extensions)
      if (/\.(pdf|jpg|jpeg|png|gif|txt|doc|docx)$/i.test(folder.name)) continue;

      const folderInfo = parseFolderName(folder.name);

      if (firstName && lastName) {
        const folderFirstName = folderInfo.firstName?.toLowerCase().trim() || "";
        const folderLastName = folderInfo.lastName?.toLowerCase().trim() || "";
        const searchFirstNameLower = firstName.toLowerCase().trim();
        const searchLastNameLower = lastName.toLowerCase().trim();

        // More flexible matching - check if names match in either order
        const directMatch = 
          (folderFirstName.includes(searchFirstNameLower) || searchFirstNameLower.includes(folderFirstName)) &&
          (folderLastName.includes(searchLastNameLower) || searchLastNameLower.includes(folderLastName));
        
        const reverseMatch = 
          (folderFirstName.includes(searchLastNameLower) || searchLastNameLower.includes(folderFirstName)) &&
          (folderLastName.includes(searchFirstNameLower) || searchFirstNameLower.includes(folderLastName));
        
        // Also check if the full folder name contains both names
        const folderNameLower = folder.name.toLowerCase();
        const containsBothNames = folderNameLower.includes(searchFirstNameLower) && folderNameLower.includes(searchLastNameLower);

        if (!directMatch && !reverseMatch && !containsBothNames) continue;
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

    console.log("DEBUG POST - Searching for:", { firstName, lastName });

    // Fetch ALL folders with pagination
    const folders = await fetchAllFolders();

    console.log("DEBUG POST - Bucket:", BUCKET_NAME);
    console.log("DEBUG POST - Total folders found:", folders.length);

    const debugInfo: DebugInfo = {
      bucket: BUCKET_NAME,
      searchFirstName: firstName,
      searchLastName: lastName,
      foldersFound: folders.length,
      folderNames: [], // Don't include all folder names in debug to avoid huge response
      parsedFolders: [],
    };

    if (folders.length === 0) {
      return NextResponse.json({ documents: [], debug: debugInfo });
    }

    const parsedDocuments: ParsedPdfDocument[] = [];
    const searchFirstNameLower = firstName.toLowerCase().trim();
    const searchLastNameLower = lastName.toLowerCase().trim();

    for (const folder of folders) {
      // Skip files at root level (folders typically don't have common file extensions)
      if (/\.(pdf|jpg|jpeg|png|gif|txt|doc|docx)$/i.test(folder.name)) continue;

      const folderInfo = parseFolderName(folder.name);
      const folderFirstName = folderInfo.firstName?.toLowerCase().trim() || "";
      const folderLastName = folderInfo.lastName?.toLowerCase().trim() || "";

      // More flexible matching - check if names match in either order
      const directMatch = 
        (folderFirstName.includes(searchFirstNameLower) || searchFirstNameLower.includes(folderFirstName)) &&
        (folderLastName.includes(searchLastNameLower) || searchLastNameLower.includes(folderLastName));
      
      const reverseMatch = 
        (folderFirstName.includes(searchLastNameLower) || searchLastNameLower.includes(folderFirstName)) &&
        (folderLastName.includes(searchFirstNameLower) || searchFirstNameLower.includes(folderLastName));
      
      // Also check if the full folder name contains both names
      const folderNameLower = folder.name.toLowerCase();
      const containsBothNames = folderNameLower.includes(searchFirstNameLower) && folderNameLower.includes(searchLastNameLower);

      const matched = directMatch || reverseMatch || containsBothNames;

      debugInfo.parsedFolders.push({
        name: folder.name,
        firstName: folderInfo.firstName,
        lastName: folderInfo.lastName,
        matched,
      });

      console.log("DEBUG POST - Folder:", folder.name, "Parsed:", folderInfo, "Matched:", matched);

      if (!matched) continue;

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

    return NextResponse.json({ documents: parsedDocuments, debug: debugInfo });
  } catch (error: any) {
    console.error("Error in parse-pdfs POST:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
