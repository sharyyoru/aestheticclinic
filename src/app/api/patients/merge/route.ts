import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type MergeRequest = {
  primaryPatientId: string;
  patientIdsToMerge: string[];
  mergedData: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    contact_owner_name: string | null;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MergeRequest;
    const { primaryPatientId, patientIdsToMerge, mergedData } = body;

    if (!primaryPatientId || !patientIdsToMerge || patientIdsToMerge.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Start a transaction-like operation by doing all updates in sequence
    console.log(`Merging ${patientIdsToMerge.length} patients into primary patient ${primaryPatientId}`);

    // 1. Update the primary patient with the merged data
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

    // 2. Merge all related data from other patients to primary patient
    for (const patientId of patientIdsToMerge) {
      console.log(`Merging data from patient ${patientId} to ${primaryPatientId}`);

      // Update appointments
      const { error: appointmentsError } = await supabase
        .from("appointments")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (appointmentsError) {
        console.error("Error merging appointments:", appointmentsError);
      }

      // Update deals
      const { error: dealsError } = await supabase
        .from("deals")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (dealsError) {
        console.error("Error merging deals:", dealsError);
      }

      // Update patient documents
      const { error: documentsError } = await supabase
        .from("patient_documents")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (documentsError) {
        console.error("Error merging documents:", documentsError);
      }

      // Update patient consultation data
      const { error: consultationError } = await supabase
        .from("patient_consultation_data")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (consultationError) {
        console.error("Error merging consultation data:", consultationError);
      }

      // Update patient insurances
      const { error: insuranceError } = await supabase
        .from("patient_insurances")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (insuranceError) {
        console.error("Error merging insurances:", insuranceError);
      }

      // Update invoices
      const { error: invoicesError } = await supabase
        .from("invoices")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (invoicesError) {
        console.error("Error merging invoices:", invoicesError);
      }

      // Update tasks
      const { error: tasksError } = await supabase
        .from("tasks")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (tasksError) {
        console.error("Error merging tasks:", tasksError);
      }

      // Update activities
      const { error: activitiesError } = await supabase
        .from("activities")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (activitiesError) {
        console.error("Error merging activities:", activitiesError);
      }

      // Update notes
      const { error: notesError } = await supabase
        .from("notes")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (notesError) {
        console.error("Error merging notes:", notesError);
      }

      // Update medical records
      const { error: medicalRecordsError } = await supabase
        .from("medical_records")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (medicalRecordsError) {
        console.error("Error merging medical records:", medicalRecordsError);
      }

      // Update prescriptions
      const { error: prescriptionsError } = await supabase
        .from("prescriptions")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (prescriptionsError) {
        console.error("Error merging prescriptions:", prescriptionsError);
      }

      // Update patient photos
      const { error: photosError } = await supabase
        .from("patient_photos")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (photosError) {
        console.error("Error merging photos:", photosError);
      }

      // Update Crisalix simulations
      const { error: crisalixError } = await supabase
        .from("crisalix_simulations")
        .update({ patient_id: primaryPatientId })
        .eq("patient_id", patientId);

      if (crisalixError) {
        console.error("Error merging Crisalix simulations:", crisalixError);
      }
    }

    // 3. Delete the merged patients
    const { error: deleteError } = await supabase
      .from("patients")
      .delete()
      .in("id", patientIdsToMerge);

    if (deleteError) {
      console.error("Error deleting merged patients:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete merged patients" },
        { status: 500 }
      );
    }

    console.log(`Successfully merged ${patientIdsToMerge.length} patients into ${primaryPatientId}`);

    return NextResponse.json({
      success: true,
      primaryPatientId,
      mergedCount: patientIdsToMerge.length,
    });
  } catch (error) {
    console.error("Error merging patients:", error);
    return NextResponse.json(
      { error: "Failed to merge patients", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
