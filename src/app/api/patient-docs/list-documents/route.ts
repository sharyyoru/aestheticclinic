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

// Helper to fetch all file names from patient_document bucket recursively
async function fetchAllPatientDocumentKeys(patientId: string): Promise<Set<string>> {
  const keys = new Set<string>();

  async function listRecursive(prefix: string) {
    const { data, error } = await supabaseAdmin.storage
      .from(PATIENT_DOCUMENTS_BUCKET)
      .list(prefix, { limit: 1000 });

    if (error || !data) return;

    for (const item of data) {
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
    const body = await request.json() as {
      firstName?: string;
      lastName?: string;
      patientId?: string;
      skipDedup?: boolean;
    };
    const { firstName, lastName, patientId, skipDedup } = body;

    if (!firstName || !lastName || !patientId) {
      return NextResponse.json(
        { error: "firstName, lastName, and patientId are required" },
        { status: 400 },
      );
    }

    // Resolve folders through the durable patient mapping. This indexed lookup
    // replaces paginating through every root folder in the storage bucket.
    const [existingKeys, { data: mappings, error: mappingError }] = await Promise.all([
      !skipDedup
        ? fetchAllPatientDocumentKeys(patientId)
        : Promise.resolve(new Set<string>()),
      supabaseAdmin
        .from("legacy_patient_doc_folders")
        .select("folder_name")
        .eq("patient_id", patientId),
    ]);

    if (mappingError) {
      console.error("Error loading legacy document folder mapping:", mappingError);
      return NextResponse.json(
        { error: "Failed to resolve legacy document folder" },
        { status: 500 },
      );
    }

    const matchingFolders = (mappings ?? []).map((mapping) => mapping.folder_name);
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
        size: file.metadata?.size ?? null,
        mimeType: file.metadata?.mimetype || null,
        createdAt: file.created_at || null,
        updatedAt: file.updated_at || null,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error in list-documents POST:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeForMatch(fileName: string): string {
  return fileName
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}
