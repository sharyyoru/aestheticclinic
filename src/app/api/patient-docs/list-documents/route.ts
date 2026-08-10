import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET_NAME = "patient-docs";
const PATIENT_DOCUMENTS_BUCKET = "patient_document";

// ============================================================
// In-memory folder cache (30-minute TTL)
// ============================================================
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let folderCache: { folders: { name: string; id: string | null }[]; expiresAt: number } | null = null;

async function getCachedFolders(): Promise<{ name: string; id: string | null }[]> {
  if (folderCache && Date.now() < folderCache.expiresAt) {
    return folderCache.folders;
  }

  const folders = await fetchAllFolders();
  folderCache = { folders, expiresAt: Date.now() + CACHE_TTL_MS };
  return folders;
}

type DocumentFile = {
  name: string;
  path: string;
  size: number | null;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: "patient-docs";
  publicUrl?: string;
};

// Parse folder name pattern to extract first/last name
function parseFolderName(folderName: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const cleanName = folderName.replace(/\.[^.]+$/, "");
  const underscoreParts = cleanName.split("_");
  
  if (underscoreParts.length >= 4) {
    return { firstName: underscoreParts[1], lastName: underscoreParts[2] };
  }
  if (underscoreParts.length === 3) {
    return { firstName: underscoreParts[1], lastName: underscoreParts[2] };
  }
  if (underscoreParts.length === 2) {
    return { firstName: underscoreParts[0], lastName: underscoreParts[1] };
  }
  
  const hyphenParts = cleanName.split("-");
  if (hyphenParts.length >= 2) {
    return { firstName: hyphenParts[0], lastName: hyphenParts[1] };
  }
  
  const spaceParts = cleanName.split(/\s+/);
  if (spaceParts.length >= 2) {
    return { firstName: spaceParts[0], lastName: spaceParts[spaceParts.length - 1] };
  }
  
  return { firstName: null, lastName: null };
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

// Helper to fetch all file names from patient_document bucket recursively
async function fetchAllPatientDocumentKeys(patientId: string): Promise<Set<string>> {
  const keys = new Set<string>();

  async function listRecursive(prefix: string) {
    const { data, error } = await supabaseAdmin.storage
      .from(PATIENT_DOCUMENTS_BUCKET)
      .list(prefix, { limit: 1000 });

    if (error || !data) return;

    for (const item of data as any[]) {
      if (item.name === ".keep") continue;

      // Folder detection: be safer than item.id === null
      const isFolder = item.id == null && item.metadata == null;

      if (isFolder) {
        const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
        await listRecursive(folderPath);
        continue;
      }

      const normalizedName = normalizeForMatch(item.name);
      keys.add(normalizedName);
    }
  }

  await listRecursive(patientId);
  return keys;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, patientId, skipDedup } = body;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
    }

    // Run dedup key fetch and folder cache lookup in PARALLEL
    const [existingKeys, folders] = await Promise.all([
      patientId && !skipDedup
        ? fetchAllPatientDocumentKeys(patientId)
        : Promise.resolve(new Set<string>()),
      getCachedFolders(),
    ]);

    if (folders.length === 0) {
      return NextResponse.json({ files: [] });
    }

    const searchFirstNameLower = firstName.toLowerCase().trim();
    const searchLastNameLower = lastName.toLowerCase().trim();

    // Find matching folders (CPU-only, fast)
    const matchingFolders: string[] = [];

    for (const folder of folders) {
      if (/\.(pdf|jpg|jpeg|png|gif|txt|doc|docx)$/i.test(folder.name)) continue;

      const folderInfo = parseFolderName(folder.name);
      const folderFirstName = folderInfo.firstName?.toLowerCase().trim() || "";
      const folderLastName = folderInfo.lastName?.toLowerCase().trim() || "";

      const directMatch = 
        (folderFirstName.includes(searchFirstNameLower) || searchFirstNameLower.includes(folderFirstName)) &&
        (folderLastName.includes(searchLastNameLower) || searchLastNameLower.includes(folderLastName));
      
      const reverseMatch = 
        (folderFirstName.includes(searchLastNameLower) || searchLastNameLower.includes(folderFirstName)) &&
        (folderLastName.includes(searchFirstNameLower) || searchFirstNameLower.includes(folderLastName));
      
      const folderNameLower = folder.name.toLowerCase();
      const containsBothNames = folderNameLower.includes(searchFirstNameLower) && folderNameLower.includes(searchLastNameLower);

      if (directMatch || reverseMatch || containsBothNames) {
        matchingFolders.push(folder.name);
      }
    }

    if (matchingFolders.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // Fetch 5_Documents contents for ALL matching folders in PARALLEL
    const folderResults = await Promise.all(
      matchingFolders.map(async (folderName) => {
        const documentsPath = `${folderName}/5_Documents`;
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .list(documentsPath, { limit: 200 });

        if (listError || !files) return [];

        return files
          .filter((file) => file.name !== ".keep" && file.name !== ".emptyFolderPlaceholder")
          .map((file) => ({ file, documentsPath }));
      })
    );

    // Flatten and deduplicate
    const documentFiles: DocumentFile[] = [];
    const allRawFiles = folderResults.flat();

    for (const { file, documentsPath } of allRawFiles) {
      const filePath = `${documentsPath}/${file.name}`;
      const legacyDisplayName = file.name.replace(/_/g, "-");
      const normalizedLegacyName = normalizeForMatch(legacyDisplayName);

      if (existingKeys.has(normalizedLegacyName)) {
        continue;
      }

      documentFiles.push({
        name: legacyDisplayName,
        path: filePath,
        size: (file as any).metadata?.size ?? null,
        mimeType: (file as any).metadata?.mimetype || null,
        createdAt: (file as any).created_at || null,
        updatedAt: (file as any).updated_at || null,
        source: "patient-docs",
      });
    }

    // Batch-generate signed URLs for all files (Supabase supports batch signing)
    if (documentFiles.length > 0) {
      const paths = documentFiles.map((f) => f.path);
      const { data: signedData } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrls(paths, 86400); // 24 hours

      if (signedData) {
        for (let i = 0; i < signedData.length; i++) {
          if (signedData[i]?.signedUrl) {
            documentFiles[i].publicUrl = signedData[i].signedUrl;
          }
        }
      }
    }

    return NextResponse.json({ files: documentFiles });
  } catch (error: any) {
    console.error("Error in list-documents POST:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

function normalizeForMatch(fileName: string): string {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}
