import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deal Deduplication Utility
 * 
 * Provides two strategies for preventing duplicate deals:
 * 1. By patient ID and service (for existing patients)
 * 2. By title and patient name (for new patients from leads - prevents duplicate patients)
 */

// Strategy 1: Check by patient ID (for existing patients)
export type DealCheckByPatientParams = {
  patientId: string;
  serviceId?: string | null;
  withinHours?: number; // Default: 6 hours
};

// Strategy 2: Check by title and name (for new patients from leads)
export type DealCheckByNameParams = {
  title: string;
  patientFirstName: string;
  patientLastName: string;
  withinHours?: number; // Default: 24 hours
};

export type DealCheckParams = DealCheckByPatientParams | DealCheckByNameParams;

export type ExistingDeal = {
  id: string;
  title: string;
  created_at: string;
  patient_id: string;
  service_id: string | null;
  patient_first_name: string;
  patient_last_name: string;
};

/**
 * Check if a deal already exists by patient ID.
 * Used when patient already exists in the system.
 */
async function findRecentDealByPatient(
  supabase: SupabaseClient,
  params: DealCheckByPatientParams
): Promise<ExistingDeal | null> {
  const { patientId, serviceId, withinHours = 6 } = params;

  const cutoffDate = new Date();
  cutoffDate.setTime(cutoffDate.getTime() - withinHours * 60 * 60 * 1000);
  const cutoffIso = cutoffDate.toISOString();

  let query = supabase
    .from("deals")
    .select(`
      id, 
      title, 
      created_at, 
      patient_id, 
      service_id,
      patients!inner (
        first_name,
        last_name
      )
    `)
    .eq("patient_id", patientId)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(1);

  if (serviceId) {
    query = query.eq("service_id", serviceId);
  }

  const { data } = await query.returns<Array<{
    id: string;
    title: string;
    created_at: string;
    patient_id: string;
    service_id: string | null;
    patients: {
      first_name: string;
      last_name: string;
    };
  }>>();

  if (!data || data.length === 0) {
    return null;
  }

  const deal = data[0];
  return {
    id: deal.id,
    title: deal.title,
    created_at: deal.created_at,
    patient_id: deal.patient_id,
    service_id: deal.service_id,
    patient_first_name: deal.patients.first_name,
    patient_last_name: deal.patients.last_name,
  };
}

/**
 * Check if a deal with this exact title AND matching patient name already exists.
 * Used for lead imports to prevent both duplicate deals AND duplicate patients.
 * 
 * A deal is considered duplicate if:
 * 1. Same title (exact match)
 * 2. Patient has same first_name AND last_name (case-insensitive)
 * 3. Created within the specified time window (default 24 hours)
 */
async function findRecentDealByName(
  supabase: SupabaseClient,
  params: DealCheckByNameParams
): Promise<ExistingDeal | null> {
  const { title, patientFirstName, patientLastName, withinHours = 24 } = params;

  if (!title || title.trim() === '') {
    console.log(`[DealDeduplication] No title provided, skipping check`);
    return null;
  }

  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setTime(cutoffDate.getTime() - withinHours * 60 * 60 * 1000);
  const cutoffIso = cutoffDate.toISOString();

  // Build query: same title, within time window, join with patients table
  const { data } = await supabase
    .from("deals")
    .select(`
      id, 
      title, 
      created_at, 
      patient_id, 
      service_id,
      patients!inner (
        first_name,
        last_name
      )
    `)
    .eq("title", title)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(10) // Get multiple to check patient names
    .returns<Array<{
      id: string;
      title: string;
      created_at: string;
      patient_id: string;
      service_id: string | null;
      patients: {
        first_name: string;
        last_name: string;
      };
    }>>();

  if (!data || data.length === 0) {
    console.log(`[DealDeduplication] No existing deal found with title:`, {
      title,
      withinHours
    });
    return null;
  }

  // Find a deal where patient name matches (case-insensitive)
  const matchingDeal = data.find(deal => 
    deal.patients.first_name.toLowerCase() === patientFirstName.toLowerCase() &&
    deal.patients.last_name.toLowerCase() === patientLastName.toLowerCase()
  );

  if (matchingDeal) {
    console.log(`[DealDeduplication] Found existing deal with same title AND patient name:`, {
      dealId: matchingDeal.id,
      title: matchingDeal.title,
      patientId: matchingDeal.patient_id,
      patientName: `${matchingDeal.patients.first_name} ${matchingDeal.patients.last_name}`,
      serviceId: matchingDeal.service_id || 'none',
      createdAt: matchingDeal.created_at
    });

    return {
      id: matchingDeal.id,
      title: matchingDeal.title,
      created_at: matchingDeal.created_at,
      patient_id: matchingDeal.patient_id,
      service_id: matchingDeal.service_id,
      patient_first_name: matchingDeal.patients.first_name,
      patient_last_name: matchingDeal.patients.last_name,
    };
  }

  console.log(`[DealDeduplication] Found deals with same title but different patient names:`, {
    title,
    searchingFor: `${patientFirstName} ${patientLastName}`,
    foundPatients: data.map(d => `${d.patients.first_name} ${d.patients.last_name}`)
  });

  return null;
}

/**
 * Main entry point - routes to appropriate deduplication strategy
 */
export async function findRecentDeal(
  supabase: SupabaseClient,
  params: DealCheckParams
): Promise<ExistingDeal | null> {
  if ('patientId' in params) {
    return findRecentDealByPatient(supabase, params);
  } else {
    return findRecentDealByName(supabase, params);
  }
}

/**
 * Check if a deal should be created or if it's a duplicate.
 * Returns { shouldCreate: true } or { shouldCreate: false, existingDeal }
 * 
 * RACE CONDITION PROTECTION:
 * When multiple requests arrive simultaneously, we use a small delay
 * and retry logic to reduce the chance of duplicate creation.
 */
export async function shouldCreateDeal(
  supabase: SupabaseClient,
  params: DealCheckParams
): Promise<{ shouldCreate: true } | { shouldCreate: false; existingDeal: ExistingDeal }> {
  // First check
  let existingDeal = await findRecentDeal(supabase, params);

  if (existingDeal) {
    return { shouldCreate: false, existingDeal };
  }

  // Add a small random delay (0-500ms) to stagger concurrent requests
  // This helps prevent race conditions when multiple webhooks arrive simultaneously
  const randomDelay = Math.floor(Math.random() * 500);
  await new Promise(resolve => setTimeout(resolve, randomDelay));

  // Check again after delay to catch deals created by concurrent requests
  existingDeal = await findRecentDeal(supabase, params);

  if (existingDeal) {
    return { shouldCreate: false, existingDeal };
  }

  return { shouldCreate: true };
}
