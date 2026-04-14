import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type MergeRequest = {
  primaryPatientId: string;
  patientIdsToMerge: string[];
  mergedData?: {
    first_name?: string;
    last_name?: string;
    email?: string | null;
    phone?: string | null;
    dob?: string | null;
    street_address?: string | null;
    town?: string | null;
    postal_code?: string | null;
    contact_owner_name?: string | null;
  };
  // New options
  preview?: boolean; // If true, only return what would be merged without executing
  performedByUserId?: string; // User ID of who is performing the merge
  performedByName?: string; // Name of who is performing the merge
};

type MergePreview = {
  primaryPatient: {
    id: string;
    name: string;
    email: string | null;
  };
  patientsToMerge: {
    id: string;
    name: string;
    email: string | null;
  }[];
  recordCounts: Record<string, number>;
  fileCounts: Record<string, number>;
  totalFiles: number;
  totalRecords: number;
};

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();
  let mergeLogId: string | null = null;
  
  try {
    const body = (await request.json()) as MergeRequest;
    const { primaryPatientId, patientIdsToMerge, mergedData, preview, performedByUserId, performedByName } = body;

    if (!primaryPatientId || !patientIdsToMerge || patientIdsToMerge.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List of all tables with patient_id foreign key
    const tablesToUpdate = [
      "appointments",
      "chat_conversations",
      "consultations",
      "crisalix_reconstructions",
      "deals",
      "documents",
      "email_reply_notifications",
      "emails",
      "invoices",
      "medidata_submissions",
      "patient_consultation_data",
      "patient_documents",
      "patient_health_background",
      "patient_insurances",
      "patient_intake_photos",
      "patient_intake_preferences",
      "patient_intake_submissions",
      "patient_measurements",
      "patient_note_mentions",
      "patient_notes",
      "patient_prescriptions",
      "patient_simulations",
      "patient_treatment_areas",
      "patient_treatment_preferences",
      "scheduled_emails",
      "tasks",
      "whatsapp_conversations",
      "whatsapp_messages",
    ];

    // Storage buckets to check
    const storageBucketsToMerge = [
      "patient-documents",
      "patient_document",
      "patient-intake-photos",
      "invoice-pdfs",
      "patient-avatars",
    ];

    // Helper function to recursively list all files
    async function listAllFilesRecursive(
      bucket: string, 
      prefix: string
    ): Promise<{ name: string; fullPath: string; relativePath: string }[]> {
      const allFiles: { name: string; fullPath: string; relativePath: string }[] = [];
      
      const { data: items, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 1000 });
      
      if (error || !items) return allFiles;
      
      for (const item of items) {
        if (item.name === '.emptyFolderPlaceholder') continue;
        
        const fullPath = `${prefix}/${item.name}`;
        
        if (item.id === null) {
          const subFiles = await listAllFilesRecursive(bucket, fullPath);
          allFiles.push(...subFiles);
        } else {
          const patientFolder = prefix.split('/')[0];
          const relativePath = fullPath.replace(`${patientFolder}/`, '');
          allFiles.push({ name: item.name, fullPath, relativePath });
        }
      }
      
      return allFiles;
    }

    // ============ PREVIEW MODE ============
    if (preview) {
      console.log(`Preview mode: Checking what would be merged for ${patientIdsToMerge.length} patients into ${primaryPatientId}`);
      
      // Fetch patient info
      const allPatientIds = [primaryPatientId, ...patientIdsToMerge];
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .in("id", allPatientIds);

      const patientMap = new Map(
        (patients || []).map(p => [p.id, p])
      );

      const primaryPatient = patientMap.get(primaryPatientId);
      const patientsToMerge = patientIdsToMerge.map(id => patientMap.get(id)).filter(Boolean);

      // Count records in each table
      const recordCounts: Record<string, number> = {};
      let totalRecords = 0;

      for (const tableName of tablesToUpdate) {
        let tableCount = 0;
        for (const patientId of patientIdsToMerge) {
          const { count } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .eq("patient_id", patientId);
          tableCount += count || 0;
        }
        if (tableCount > 0) {
          recordCounts[tableName] = tableCount;
          totalRecords += tableCount;
        }
      }

      // Count files in each bucket
      const fileCounts: Record<string, number> = {};
      let totalFiles = 0;

      for (const bucket of storageBucketsToMerge) {
        let bucketCount = 0;
        for (const patientId of patientIdsToMerge) {
          try {
            const files = await listAllFilesRecursive(bucket, patientId);
            bucketCount += files.length;
          } catch {
            // Bucket might not exist
          }
        }
        if (bucketCount > 0) {
          fileCounts[bucket] = bucketCount;
          totalFiles += bucketCount;
        }
      }

      const previewResult: MergePreview = {
        primaryPatient: {
          id: primaryPatientId,
          name: primaryPatient ? `${primaryPatient.first_name} ${primaryPatient.last_name}` : "Unknown",
          email: primaryPatient?.email || null,
        },
        patientsToMerge: patientsToMerge.map(p => ({
          id: p!.id,
          name: `${p!.first_name} ${p!.last_name}`,
          email: p!.email || null,
        })),
        recordCounts,
        fileCounts,
        totalRecords,
        totalFiles,
      };

      return NextResponse.json({
        success: true,
        preview: true,
        data: previewResult,
        message: `Preview: Would merge ${totalRecords} records and ${totalFiles} files from ${patientIdsToMerge.length} patient(s) into ${previewResult.primaryPatient.name}`,
      });
    }

    // ============ ACTUAL MERGE ============
    console.log(`Merging ${patientIdsToMerge.length} patients into primary patient ${primaryPatientId}`);

    // Fetch patient names for logging
    const { data: allPatients } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .in("id", [primaryPatientId, ...patientIdsToMerge]);

    const patientNameMap = new Map(
      (allPatients || []).map(p => [p.id, `${p.first_name} ${p.last_name}`])
    );

    const primaryPatientName = patientNameMap.get(primaryPatientId) || "Unknown";
    const mergedPatientNames = patientIdsToMerge.map(id => patientNameMap.get(id) || "Unknown");

    // Create merge log entry
    const { data: logEntry, error: logError } = await supabase
      .from("patient_merge_logs")
      .insert({
        primary_patient_id: primaryPatientId,
        primary_patient_name: primaryPatientName,
        merged_patient_ids: patientIdsToMerge,
        merged_patient_names: mergedPatientNames,
        performed_by_user_id: performedByUserId || null,
        performed_by_name: performedByName || null,
        status: "partial", // Will be updated to success on completion
        started_at: startedAt,
      })
      .select("id")
      .single();

    if (!logError && logEntry) {
      mergeLogId = logEntry.id;
      console.log(`Created merge log entry: ${mergeLogId}`);
    }

    const tablesUpdated: string[] = [];

    // 1. Update the primary patient with the merged data (if provided)
    if (mergedData && Object.keys(mergedData).length > 0) {
      const { error: updateError } = await supabase
        .from("patients")
        .update({
          ...mergedData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primaryPatientId);

      if (updateError) {
        console.error("Error updating primary patient:", updateError);
        return NextResponse.json(
          { error: "Failed to update primary patient" },
          { status: 500 }
        );
      }
    }

    // 2. Merge all related data from other patients to primary patient
    // Tables where patient_id is the primary key (need to delete, not update)
    const tablesToDeleteFrom = [
      "patient_edit_locks",
    ];

    // Track file path mappings for database updates
    const filePathMappings: { bucket: string; oldPath: string; newPath: string }[] = [];

    for (const patientId of patientIdsToMerge) {
      console.log(`Merging data from patient ${patientId} to ${primaryPatientId}`);

      // Update all tables with patient_id foreign key
      for (const tableName of tablesToUpdate) {
        const { data, error } = await supabase
          .from(tableName)
          .update({ patient_id: primaryPatientId })
          .eq("patient_id", patientId)
          .select("id");

        if (error) {
          // Log but continue - table might not exist or have no records
          console.log(`Note: Could not update ${tableName}:`, error.message);
        } else if (data && data.length > 0 && !tablesUpdated.includes(tableName)) {
          tablesUpdated.push(tableName);
        }
      }

      // Delete from tables where patient_id is the primary key
      for (const tableName of tablesToDeleteFrom) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("patient_id", patientId);

        if (error) {
          console.log(`Note: Could not delete from ${tableName}:`, error.message);
        }
      }
    }

    // 3. Copy files from ALL storage buckets that store patient files
    for (const patientId of patientIdsToMerge) {
      console.log(`Copying storage files from patient ${patientId} to ${primaryPatientId}`);
      
      for (const bucketName of storageBucketsToMerge) {
        try {
          // Get all existing files in primary patient's folder (for duplicate checking)
          const existingFilePaths = new Set<string>();
          const existingFiles = await listAllFilesRecursive(bucketName, primaryPatientId);
          for (const f of existingFiles) {
            existingFilePaths.add(f.relativePath);
          }

          // List all files for this patient (including subfolders)
          const filesToCopy = await listAllFilesRecursive(bucketName, patientId);

          if (filesToCopy.length === 0) {
            console.log(`No files found in ${bucketName} for patient ${patientId}`);
            continue;
          }

          console.log(`Found ${filesToCopy.length} files in ${bucketName} for patient ${patientId}`);

          // Copy each file to the primary patient's folder
          for (const file of filesToCopy) {
            let newRelativePath = file.relativePath;

            // Handle duplicate filenames by appending a counter
            if (existingFilePaths.has(newRelativePath)) {
              const parts = newRelativePath.split('/');
              const fileName = parts.pop() || file.name;
              const folderPath = parts.join('/');
              
              const nameParts = fileName.split('.');
              const extension = nameParts.length > 1 ? nameParts.pop() : '';
              const baseName = nameParts.join('.');
              
              let counter = 1;
              do {
                const newFileName = extension 
                  ? `${baseName}_merged${counter}.${extension}`
                  : `${baseName}_merged${counter}`;
                newRelativePath = folderPath ? `${folderPath}/${newFileName}` : newFileName;
                counter++;
              } while (existingFilePaths.has(newRelativePath));
              
              console.log(`File name conflict in ${bucketName}: ${file.relativePath} → ${newRelativePath}`);
            }

            const newPath = `${primaryPatientId}/${newRelativePath}`;

            // Copy file to new location (keeping original)
            const { error: copyError } = await supabase.storage
              .from(bucketName)
              .copy(file.fullPath, newPath);

            if (copyError) {
              console.log(`Note: Could not copy file ${file.fullPath} in ${bucketName}:`, copyError.message);
              continue;
            }

            // Track the mapping for database updates
            filePathMappings.push({ bucket: bucketName, oldPath: file.fullPath, newPath });

            // Add to existing files set to prevent duplicates in this batch
            existingFilePaths.add(newRelativePath);
            console.log(`Copied file in ${bucketName}: ${file.fullPath} → ${newPath}`);
          }
        } catch (storageError) {
          console.log(`Note: Error processing ${bucketName} for patient ${patientId}:`, storageError);
        }
      }
    }

    // 3b. Update file paths in database records that reference the moved files
    console.log(`Updating ${filePathMappings.length} file path references in database...`);
    
    // Update invoices.pdf_path and cash_receipt_path for moved invoice PDFs
    for (const mapping of filePathMappings) {
      if (mapping.bucket === "invoice-pdfs") {
        // Update pdf_path
        const { error: pdfError } = await supabase
          .from("invoices")
          .update({ pdf_path: mapping.newPath })
          .eq("pdf_path", mapping.oldPath);
        
        if (pdfError) {
          console.log(`Note: Could not update invoice pdf_path ${mapping.oldPath}:`, pdfError.message);
        } else {
          console.log(`Updated invoice pdf_path: ${mapping.oldPath} → ${mapping.newPath}`);
        }

        // Also update cash_receipt_path (same bucket)
        const { error: receiptError } = await supabase
          .from("invoices")
          .update({ cash_receipt_path: mapping.newPath })
          .eq("cash_receipt_path", mapping.oldPath);
        
        if (!receiptError) {
          console.log(`Updated invoice cash_receipt_path: ${mapping.oldPath} → ${mapping.newPath}`);
        }
      }
    }

    // Update patient_intake_photos.storage_path for moved intake photos
    for (const mapping of filePathMappings) {
      if (mapping.bucket === "patient-intake-photos") {
        const { error: updateError } = await supabase
          .from("patient_intake_photos")
          .update({ storage_path: mapping.newPath })
          .eq("storage_path", mapping.oldPath);
        
        if (updateError) {
          console.log(`Note: Could not update intake photo storage_path ${mapping.oldPath}:`, updateError.message);
        } else {
          console.log(`Updated intake photo storage_path: ${mapping.oldPath} → ${mapping.newPath}`);
        }
      }
    }

    // Update patient_documents.file_path for moved documents (if it contains patient_id path)
    for (const mapping of filePathMappings) {
      if (mapping.bucket === "patient_document" || mapping.bucket === "patient-documents") {
        const { error: updateError } = await supabase
          .from("patient_documents")
          .update({ file_path: mapping.newPath })
          .eq("file_path", mapping.oldPath);
        
        if (updateError) {
          console.log(`Note: Could not update patient_documents file_path ${mapping.oldPath}:`, updateError.message);
        }
      }
    }

    // Update patients.avatar_url for moved avatars
    for (const mapping of filePathMappings) {
      if (mapping.bucket === "patient-avatars") {
        // Get the public URL for the new path
        const { data: urlData } = supabase.storage.from("patient-avatars").getPublicUrl(mapping.newPath);
        if (urlData?.publicUrl) {
          const { error: updateError } = await supabase
            .from("patients")
            .update({ avatar_url: urlData.publicUrl })
            .eq("id", primaryPatientId);
          
          if (updateError) {
            console.log(`Note: Could not update patient avatar_url:`, updateError.message);
          }
        }
      }
    }

    // 4. Delete the merged patients
    const { error: deleteError } = await supabase
      .from("patients")
      .delete()
      .in("id", patientIdsToMerge);

    if (deleteError) {
      console.error("Error deleting merged patients:", deleteError);
      // Provide more context about the error - likely a foreign key constraint
      const errorMessage = deleteError.message?.includes("violates foreign key constraint")
        ? `Failed to delete merged patients: A related record still references this patient. Details: ${deleteError.message}`
        : `Failed to delete merged patients: ${deleteError.message || "Unknown error"}`;
      return NextResponse.json(
        { error: errorMessage, details: deleteError },
        { status: 500 }
      );
    }

    console.log(`Successfully merged ${patientIdsToMerge.length} patients into ${primaryPatientId}`);

    // Update merge log with success status
    if (mergeLogId) {
      await supabase
        .from("patient_merge_logs")
        .update({
          status: "success",
          tables_updated: tablesUpdated,
          files_copied: filePathMappings.length,
          file_mappings: filePathMappings,
          completed_at: new Date().toISOString(),
        })
        .eq("id", mergeLogId);
    }

    return NextResponse.json({
      success: true,
      primaryPatientId,
      mergedCount: patientIdsToMerge.length,
      tablesUpdated,
      filesCopied: filePathMappings.length,
      mergeLogId,
    });
  } catch (error) {
    console.error("Error merging patients:", error);

    // Update merge log with failed status if we have a log entry
    if (mergeLogId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from("patient_merge_logs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", mergeLogId);
    }

    return NextResponse.json(
      { error: "Failed to merge patients", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
