import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

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
  axenitaId: string | null;
  firstName: string | null;
  lastName: string | null;
  date: string | null;
};

// Parse folder name pattern: axenita-id_firstname_lastname_dd-mm-yyyy
// Only extract firstName and lastName for matching (axenitaId and date not used for DB matching)
function parseFolderName(folderName: string): {
  axenitaId: string | null;
  firstName: string | null;
  lastName: string | null;
  date: string | null;
} {
  // Pattern: 10009_Arlette_Menoud_02-01-2025
  // We only use firstName (parts[1]) and lastName (parts[2]) for matching
  const parts = folderName.split("_");
  
  if (parts.length >= 3) {
    // Only extract firstName and lastName - these are used for matching
    const firstName = parts[1];
    const lastName = parts[2];
    
    return {
      axenitaId: null, // Not used for matching
      firstName,
      lastName,
      date: null, // Not used for matching
    };
  }
  
  return {
    axenitaId: null,
    firstName: null,
    lastName: null,
    date: null,
  };
}

// Determine file type from filename
function getFileType(fileName: string): "ap" | "consultation" | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName === "ap.pdf") {
    return "ap";
  }
  if (lowerName.startsWith("consultation") && lowerName.endsWith(".pdf")) {
    return "consultation";
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");

    // List all folders in the bucket
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

    // Process each folder
    for (const folder of folders) {
      // Skip files at root level, only process folders
      if (!folder.id || folder.name.includes(".")) continue;

      const folderInfo = parseFolderName(folder.name);

      // If filtering by patient name, check if this folder matches
      if (firstName && lastName) {
        const folderFirstName = folderInfo.firstName?.toLowerCase() || "";
        const folderLastName = folderInfo.lastName?.toLowerCase() || "";
        const searchFirstName = firstName.toLowerCase();
        const searchLastName = lastName.toLowerCase();

        // Match by name (case-insensitive, partial match)
        const firstNameMatch = folderFirstName.includes(searchFirstName) || searchFirstName.includes(folderFirstName);
        const lastNameMatch = folderLastName.includes(searchLastName) || searchLastName.includes(folderLastName);

        if (!firstNameMatch || !lastNameMatch) {
          continue;
        }
      }

      // List files in this folder (could have subfolders like 2_Consultati...)
      const { data: subItems, error: subError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .list(folder.name, { limit: 100 });

      if (subError || !subItems) continue;

      // Process items - could be files or subfolders
      for (const item of subItems) {
        if (item.name.endsWith(".pdf")) {
          // Direct PDF file in the folder
          await processPdfFile(folder.name, item.name, folderInfo, parsedDocuments);
        } else if (!item.name.includes(".")) {
          // This is a subfolder, list its contents
          const subfolderPath = `${folder.name}/${item.name}`;
          const { data: subfolderFiles, error: subfolderError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(subfolderPath, { limit: 100 });

          if (!subfolderError && subfolderFiles) {
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
    console.error("Error in parse-pdfs:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
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
    // Download the PDF file
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error(`Error downloading ${filePath}:`, downloadError);
      return;
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Parse PDF content
    const pdfData = await pdfParse(buffer);
    const content = pdfData.text.trim();

    // Create single-line content by replacing multiple newlines and whitespace
    const singleLineContent = content
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    parsedDocuments.push({
      folderName: folderPath.split("/")[0], // Get the root folder name
      fileName,
      fileType,
      content: singleLineContent,
      axenitaId: folderInfo.axenitaId,
      firstName: folderInfo.firstName,
      lastName: folderInfo.lastName,
      date: folderInfo.date,
    });
  } catch (parseError: any) {
    console.error(`Error parsing PDF ${filePath}:`, parseError.message);
  }
}

// POST endpoint to get documents for a specific patient by matching name
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, patientId } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 }
      );
    }

    // Redirect to GET with params
    const url = new URL(request.url);
    url.searchParams.set("firstName", firstName);
    url.searchParams.set("lastName", lastName);
    if (patientId) url.searchParams.set("patientId", patientId);

    // Call GET handler logic directly
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

    // Process each folder
    for (const folder of folders) {
      if (!folder.id || folder.name.includes(".")) continue;

      const folderInfo = parseFolderName(folder.name);

      // Match by name (case-insensitive)
      const folderFirstName = folderInfo.firstName?.toLowerCase() || "";
      const folderLastName = folderInfo.lastName?.toLowerCase() || "";
      const searchFirstName = firstName.toLowerCase();
      const searchLastName = lastName.toLowerCase();

      // Exact or partial match
      const firstNameMatch = folderFirstName === searchFirstName || 
        folderFirstName.includes(searchFirstName) || 
        searchFirstName.includes(folderFirstName);
      const lastNameMatch = folderLastName === searchLastName || 
        folderLastName.includes(searchLastName) || 
        searchLastName.includes(folderLastName);

      if (!firstNameMatch || !lastNameMatch) {
        continue;
      }

      // List files in this folder
      const { data: subItems, error: subError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .list(folder.name, { limit: 100 });

      if (subError || !subItems) continue;

      for (const item of subItems) {
        if (item.name.endsWith(".pdf")) {
          await processPdfFile(folder.name, item.name, folderInfo, parsedDocuments);
        } else if (!item.name.includes(".")) {
          const subfolderPath = `${folder.name}/${item.name}`;
          const { data: subfolderFiles, error: subfolderError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list(subfolderPath, { limit: 100 });

          if (!subfolderError && subfolderFiles) {
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
