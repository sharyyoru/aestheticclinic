import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SINGLE SOURCE OF TRUTH for online-booking availability.
 *
 * Both the "which slots are free" endpoint (/api/appointments/check-availability)
 * and the "actually create the booking" validator (/api/public/book-appointment,
 * /api/retell/book-appointment) MUST use these helpers so the two can never
 * diverge. Divergence is what produced the bug where a slot was shown as
 * available and then rejected at confirmation with "fully booked (2/1)" (409).
 */

// Doctors that can see multiple patients concurrently (e.g. with assistants).
export const MULTI_CAPACITY_DOCTORS = ["xavier-tenorio", "cesar-rodriguez"];

// Online bookings are first consultations, which are 30 minutes long.
export const CONSULTATION_DURATION_MS = 30 * 60 * 1000;

export function getMaxCapacity(doctorSlug?: string | null): number {
  if (!doctorSlug) return 1;
  return MULTI_CAPACITY_DOCTORS.includes(doctorSlug) ? 3 : 1;
}

export interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  status?: string | null;
  reason?: string | null;
  no_patient?: boolean | null;
  provider_id?: string | null;
}

/** Normalise a doctor display name ("Dr. Yulia Raspertova") for matching. */
function cleanDoctorName(doctorName?: string | null): string {
  return (doctorName || "").replace(/^Dr\.\s*/i, "").trim();
}

/**
 * Resolve a provider's UUID from a doctor display name. Returns null if the
 * lookup is ambiguous (more than one match) or not found — callers then fall
 * back to the [Doctor: Name] reason tag for attribution.
 */
export async function resolveProviderId(
  supabase: SupabaseClient,
  doctorName?: string | null,
): Promise<string | null> {
  const clean = cleanDoctorName(doctorName);
  if (!clean) return null;
  const { data } = await supabase
    .from("providers")
    .select("id")
    .or(`name.ilike.*${clean}*,name.ilike.*${clean.split(" ")[0]}*`)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Whether an appointment belongs to the given doctor. Matches by provider_id
 * (most reliable) and falls back to the "[Doctor: Name]" tag in `reason`.
 */
export function appointmentBelongsToDoctor(
  apt: AppointmentRow,
  providerId: string | null,
  doctorName?: string | null,
): boolean {
  if (providerId && apt.provider_id === providerId) return true;
  if (apt.reason) {
    const match = apt.reason.match(/\[Doctor:\s*(.+?)\s*\]/i);
    const clean = cleanDoctorName(doctorName).toLowerCase();
    if (match && clean && match[1].toLowerCase().includes(clean)) return true;
  }
  return false;
}

/** True if an appointment overlaps the [slotStart, slotEnd) window. */
export function overlapsSlot(apt: AppointmentRow, slotStart: Date, slotEnd: Date): boolean {
  const s = new Date(apt.start_time);
  const e = new Date(apt.end_time);
  // Overlap: existing starts before slot ends AND existing ends after slot starts.
  return s < slotEnd && e > slotStart;
}

/**
 * Fetch every non-cancelled appointment that overlaps the [rangeStart, rangeEnd)
 * window. PAUSE/no_patient appointments ARE included — a doctor's break blocks
 * online bookings.
 */
export async function fetchOverlappingAppointments(
  supabase: SupabaseClient,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, reason, no_patient, provider_id")
    .lt("start_time", rangeEndIso) // starts before range ends
    .gt("end_time", rangeStartIso) // ends after range starts
    .neq("status", "cancelled");
  if (error) {
    console.error("[availability] fetchOverlappingAppointments error:", error);
    return [];
  }
  return (data as AppointmentRow[]) || [];
}

/**
 * From a pool of appointments, return the ones that block a specific slot for a
 * specific doctor (i.e. belong to the doctor AND overlap the slot).
 */
export function getBlockingAppointments(
  appointments: AppointmentRow[],
  opts: {
    providerId: string | null;
    doctorName?: string | null;
    slotStart: Date;
    slotEnd: Date;
  },
): AppointmentRow[] {
  return appointments.filter(
    (apt) =>
      appointmentBelongsToDoctor(apt, opts.providerId, opts.doctorName) &&
      overlapsSlot(apt, opts.slotStart, opts.slotEnd),
  );
}

/** Compact, non-PII description of a blocking appointment for diagnostics. */
export function describeBlocking(apt: AppointmentRow, providerId: string | null) {
  return {
    id: apt.id,
    start_time: apt.start_time,
    end_time: apt.end_time,
    no_patient: apt.no_patient ?? false,
    has_provider_id: Boolean(apt.provider_id),
    matched_by: providerId && apt.provider_id === providerId ? "provider_id" : "reason_tag",
  };
}
