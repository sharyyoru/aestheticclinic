import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type RecoverRequest = {
  patientId: string; // The patient ID whose files we want to check/recover
  targetPatientId?: string; // Optional: If provided, copy files to this patient
  dryRun?: boolean; // If true, only list files without copying
};

type FileInfo = {
  bucket: string;
  path: string;
  name: string;
  size: number | null;
  createdAt: string | null;
};

const STORAGE_BUCKETS = [
  "patient-documents",
  "patient_document",
  "patient-intake-photos",
  "invoice-pdfs",
  "patient-avatars",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecoverRequest;
    const { patientId, targetPatientId, dryRun = true } = body;

    if (!patientId) {
      return NextResponse.json(
        { error: "Missing required field: patientId" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Checking for files belonging to patient ${patientId}...`);

    const foundFiles: FileInfo[] = [];
    const recoveredFiles: { from: string; to: string; bucket: string }[] = [];
    const errors: string[] = [];

    // Helper function to recursively list all files
    async function listAllFilesRecursive(
      bucket: string,
      prefix: string
    ): Promise<FileInfo[]> {
      const files: FileInfo[] = [];

      const { data: items, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 1000 });

      if (error || !items) return files;

      for (const item of items) {
        if (item.name === ".emptyFolderPlaceholder") continue;

        const fullPath = `${prefix}/${item.name}`;

        // Check if it's a folder (id is null for folders)
        if (item.id === null) {
          const subFiles = await listAllFilesRecursive(bucket, fullPath);
          files.push(...subFiles);
        } else {
          files.push({
            bucket,
            path: fullPath,
            name: item.name,
            size: item.metadata?.size || null,
            createdAt: item.created_at || null,
          });
        }
      }

      return files;
    }

    // Check each bucket for files belonging to this patient
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const files = await listAllFilesRecursive(bucket, patientId);
        foundFiles.push(...files);
        
        if (files.length > 0) {
          console.log(`Found ${files.length} files in ${bucket} for patient ${patientId}`);
        }
      } catch (err) {
        const errorMsg = `Error checking bucket ${bucket}: ${err instanceof Error ? err.message : String(err)}`;
        console.log(errorMsg);
        errors.push(errorMsg);
      }
    }

    // If targetPatientId is provided and not a dry run, copy the files
    if (targetPatientId && !dryRun && foundFiles.length > 0) {
      console.log(`Recovering ${foundFiles.length} files to patient ${targetPatientId}...`);

      for (const file of foundFiles) {
        try {
          // Calculate new path by replacing old patient ID with new one
          const relativePath = file.path.replace(`${patientId}/`, "");
          const newPath = `${targetPatientId}/${relativePath}`;

          const { error: copyError } = await supabase.storage
            .from(file.bucket)
            .copy(file.path, newPath);

          if (copyError) {
            errors.push(`Failed to copy ${file.path}: ${copyError.message}`);
          } else {
            recoveredFiles.push({
              from: file.path,
              to: newPath,
              bucket: file.bucket,
            });
            console.log(`Recovered: ${file.path} → ${newPath}`);
          }
        } catch (err) {
          errors.push(`Error copying ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Update database references for recovered files
      if (recoveredFiles.length > 0) {
        console.log("Updating database references...");

        for (const recovered of recoveredFiles) {
          // Update invoices.pdf_path
          if (recovered.bucket === "invoice-pdfs") {
            await supabase
              .from("invoices")
              .update({ pdf_path: recovered.to })
              .eq("pdf_path", recovered.from);

            await supabase
              .from("invoices")
              .update({ cash_receipt_path: recovered.to })
              .eq("cash_receipt_path", recovered.from);
          }

          // Update patient_intake_photos.storage_path
          if (recovered.bucket === "patient-intake-photos") {
            await supabase
              .from("patient_intake_photos")
              .update({ storage_path: recovered.to })
              .eq("storage_path", recovered.from);
          }

          // Update patient_documents.file_path
          if (recovered.bucket === "patient_document" || recovered.bucket === "patient-documents") {
            await supabase
              .from("patient_documents")
              .update({ file_path: recovered.to })
              .eq("file_path", recovered.from);
          }
        }
      }
    }

    // Check if the patient still exists in the database
    const { data: patientData } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("id", patientId)
      .maybeSingle();

    const patientExists = !!patientData;

    return NextResponse.json({
      success: true,
      patientId,
      patientExists,
      patientName: patientData ? `${patientData.first_name} ${patientData.last_name}` : null,
      filesFound: foundFiles.length,
      files: foundFiles,
      dryRun,
      targetPatientId: targetPatientId || null,
      filesRecovered: recoveredFiles.length,
      recoveredFiles: dryRun ? [] : recoveredFiles,
      errors: errors.length > 0 ? errors : null,
      message: dryRun
        ? `Found ${foundFiles.length} files. Set dryRun=false and provide targetPatientId to recover.`
        : `Recovered ${recoveredFiles.length} of ${foundFiles.length} files.`,
    });
  } catch (error) {
    console.error("Error in file recovery:", error);
    return NextResponse.json(
      { error: "Failed to check/recover files", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET endpoint to quickly check for orphaned files
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json(
      { error: "Missing patientId query parameter" },
      { status: 400 }
    );
  }

  // Create a mock request for the POST handler
  const mockRequest = {
    json: async () => ({ patientId, dryRun: true }),
  } as Request;

  return POST(mockRequest);
}
