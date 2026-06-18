import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Keep the CRM deal in sync when an appointment is booked online or via the
 * chatbot (Retell).
 *
 * Problem this solves:
 * - Previously, booking an appointment did NOT move the patient's deal. Staff
 *   had to drag the deal into "Appointment Set" manually, and doing so opens the
 *   appointment modal which creates a SECOND appointment (a duplicate).
 *
 * Behaviour:
 * - If the patient has an existing deal, move the most recent one to the
 *   "Appointment Set" stage (no duplicate appointment is created).
 * - If the patient has no deal, create one directly in "Appointment Set" so it
 *   reflects the booked appointment instead of sitting in an earlier stage.
 *
 * The deal board groups by stage (pipeline is display-only), so a moved/created
 * deal shows up under "Appointment Set" with its booked appointment attached.
 */
export async function syncDealToAppointmentSet(
  supabase: SupabaseClient,
  params: {
    patientId: string;
    title: string;
    serviceId?: string | null;
    notes?: string | null;
    location?: string | null;
  }
): Promise<{ dealId: string | null; moved: boolean; created: boolean }> {
  const { patientId, title, serviceId = null, notes = null, location = null } = params;

  // Locate the "Appointment Set" stage (matched the same way the deal board does).
  const { data: stage } = await supabase
    .from("deal_stages")
    .select("id, name")
    .ilike("name", "%appointment set%")
    .limit(1)
    .maybeSingle();

  if (!stage) {
    console.warn("[dealSync] No 'Appointment Set' stage found — leaving deal untouched");
    return { dealId: null, moved: false, created: false };
  }

  // Find the patient's most recent deal (any stage).
  const { data: existingDeals } = await supabase
    .from("deals")
    .select("id, stage_id")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1);

  const existingDeal = existingDeals?.[0];

  if (existingDeal) {
    // Already there — nothing to do.
    if (existingDeal.stage_id === stage.id) {
      return { dealId: existingDeal.id, moved: false, created: false };
    }

    const updatePayload: Record<string, unknown> = {
      stage_id: stage.id,
      updated_at: new Date().toISOString(),
    };
    if (serviceId) updatePayload.service_id = serviceId;

    const { error } = await supabase
      .from("deals")
      .update(updatePayload)
      .eq("id", existingDeal.id);

    if (error) {
      console.error("[dealSync] Failed to move deal to Appointment Set:", error);
      return { dealId: existingDeal.id, moved: false, created: false };
    }

    return { dealId: existingDeal.id, moved: true, created: false };
  }

  // No deal yet — create one directly in "Appointment Set".
  const insertPayload: Record<string, unknown> = {
    patient_id: patientId,
    stage_id: stage.id,
    title,
  };
  if (serviceId) insertPayload.service_id = serviceId;
  if (notes) insertPayload.notes = notes;
  if (location) insertPayload.location = location;

  const { data: created, error } = await supabase
    .from("deals")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !created) {
    console.error("[dealSync] Failed to create Appointment Set deal:", error);
    return { dealId: null, moved: false, created: false };
  }

  return { dealId: created.id, moved: false, created: true };
}
