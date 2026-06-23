/**
 * Single source of truth for deciding whether an appointment is still eligible
 * for patient-facing communications (day-before reminders and booking
 * confirmations).
 *
 * Background / why this exists
 * ────────────────────────────
 * The agenda "booking status" (e.g. "Déplacé" = moved, "Annulé" = cancelled,
 * "fait" = done) is NOT stored in the database `appointments.status` column.
 * Instead it is embedded as a tag inside the free-text `appointments.reason`
 * field, e.g.:
 *
 *     "Filler / HA [Doctor: Yulia] [Category: Injection] [Status: Déplacé]"
 *
 * The DB `status` column meanwhile usually stays "scheduled" even after staff
 * "move" an appointment (the clinic's reschedule workflow creates a NEW row for
 * the new slot and tags the OLD row as "Déplacé", rather than changing the old
 * row's start_time or status).
 *
 * Historically the reminder cron filtered only on `status = "scheduled"`, so a
 * moved/cancelled-by-tag appointment still received a "your appointment is
 * tomorrow" reminder. This module centralises the rule so every send path
 * (live reminder cron, booking-confirmation cron, scheduled-email sender)
 * agrees and the bug can never silently reappear in one path.
 */

/** Matches the `[Status: ...]` tag embedded in `appointments.reason`. */
const STATUS_TAG_REGEX = /\[Status:\s*([^\]]+?)\s*\]/i;

/**
 * Agenda statuses (normalised, accent-free) that mean the appointment will NOT
 * be attended at this slot and therefore MUST NOT trigger patient reminders or
 * confirmations.
 *
 * To extend: add the normalised form (lowercase, no accents) of any other
 * terminal agenda status here and every send path picks it up automatically.
 */
export const REMINDER_BLOCKING_AGENDA_STATUSES: ReadonlySet<string> = new Set([
  "deplace", // "Déplacé"  – appointment moved to another slot
  "annule", // "Annulé"   – appointment cancelled via the agenda tag
]);

/**
 * Exact (accented) `reason` substrings used for an optional DB-side `ilike`
 * pre-filter. The app always writes these exact French labels, so an `ilike`
 * on the accented string is reliable. This is only an optimisation — the
 * authoritative check is always {@link isEligibleForPatientComms} in JS, which
 * is accent/case/whitespace tolerant.
 */
export const REMINDER_BLOCKING_REASON_ILIKE_PATTERNS: readonly string[] = [
  "%[Status: Déplacé]%",
  "%[Status: Annulé]%",
];

/** Extract the raw agenda status label from a `reason` string (or null). */
export function parseAgendaStatus(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const match = reason.match(STATUS_TAG_REGEX);
  return match ? match[1].trim() || null : null;
}

/** Normalise a status label: strip accents, lowercase, collapse whitespace. */
export function normalizeAgendaStatus(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[\u2019\u2018`]/g, "'") // normalise curly apostrophes
    .replace(/\s+/g, " ")
    .trim();
}

type AppointmentCommsInput = {
  status?: string | null;
  reason?: string | null;
};

/**
 * Returns a machine-readable reason WHY patient communications must be
 * suppressed for this appointment, or `null` if it is eligible.
 *
 * Useful for logging and for tagging retired `scheduled_emails` rows.
 */
export function reminderSuppressionReason(
  appt: AppointmentCommsInput,
): string | null {
  if ((appt.status ?? "").toLowerCase() === "cancelled") {
    return "appointment_cancelled";
  }
  const agenda = normalizeAgendaStatus(parseAgendaStatus(appt.reason));
  if (agenda === "deplace") return "appointment_moved";
  if (agenda === "annule") return "appointment_cancelled_agenda";
  if (REMINDER_BLOCKING_AGENDA_STATUSES.has(agenda)) {
    return `appointment_status_${agenda.replace(/\s+/g, "_")}`;
  }
  return null;
}

/**
 * The authoritative guard. Returns true only when the appointment should still
 * receive patient-facing reminders/confirmations.
 *
 * Blocks when:
 *  - the DB status is "cancelled", OR
 *  - the agenda `[Status: ...]` tag is a reminder-blocking status
 *    (e.g. Déplacé / Annulé).
 */
export function isEligibleForPatientComms(appt: AppointmentCommsInput): boolean {
  return reminderSuppressionReason(appt) === null;
}
