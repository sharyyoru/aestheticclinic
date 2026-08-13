/**
 * Shared definitions for "missed calls" — calls where the front desk needs to
 * call the client back. Two underlying sources feed into this concept:
 *
 * 1. `call_logs` rows for inbound/web calls that never connected to the
 *    patient (busy, no answer, declined, dial failed, voicemail, etc.).
 * 2. `dropped_calls` rows — calls where the AI agent connected but could not
 *    understand the caller mid-conversation and explicitly logged it.
 *
 * This module is the single source of truth for what counts as "not
 * connected" so the webhook (which decides whether to email the front desk)
 * and the /missed-calls page (which decides what to display) never drift.
 */

/**
 * Retell disconnection reasons that mean the call never reached the patient
 * (carrier/telephony failures). Kept here as the canonical list — the Retell
 * webhook imports this instead of maintaining its own copy.
 */
export const NOT_CONNECTED_REASONS = new Set([
  "dial_failed",
  "dial_busy",
  "dial_no_answer",
  "user_declined",
  "voicemail_reached",
  "error_llm_websocket_open",
  "registered_call_timeout",
  "no_valid_payment",
  "scam_detected",
  "telephony_provider_permission_denied",
  "telephony_provider_unavailable",
  "sip_routing_error",
  "invalid_destination",
]);

const REASON_LABELS: Record<string, string> = {
  user_declined: "Declined by carrier",
  dial_busy: "Busy",
  dial_no_answer: "No answer",
  dial_failed: "Dial failed",
  voicemail_reached: "Voicemail",
  telephony_provider_permission_denied: "Carrier blocked",
  telephony_provider_unavailable: "Carrier unavailable",
  sip_routing_error: "Routing error",
  invalid_destination: "Invalid number",
  registered_call_timeout: "Not answered",
  error_llm_websocket_open: "Connection error",
  no_valid_payment: "No valid payment",
  scam_detected: "Flagged as spam",
};

/** Human-readable label for a Retell disconnection_reason code. */
export function describeMissedCallReason(reason: string | null | undefined): string {
  if (!reason) return "Unknown";
  return REASON_LABELS[reason] ?? reason;
}

/**
 * A `call_logs` row is a "missed call" when it's an inbound/web call that
 * never connected to the patient.
 */
export function isMissedCallLog(row: {
  direction: string | null;
  disconnection_reason: string | null;
}): boolean {
  const direction = row.direction || "inbound";
  const isInboundLike = direction === "inbound" || direction === "web";
  if (!isInboundLike) return false;
  return !!row.disconnection_reason && NOT_CONNECTED_REASONS.has(row.disconnection_reason);
}

export type ContactStatus = "pending" | "contacted" | "resolved" | "no_answer" | "invalid";

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "resolved", label: "Resolved" },
  { value: "no_answer", label: "No Answer" },
  { value: "invalid", label: "Invalid" },
];

/** Unified shape used by the /missed-calls page, regardless of source table. */
export type MissedCall = {
  id: string;
  source: "call_log" | "dropped_call";
  phone: string | null;
  patientId: string | null;
  patientName: string | null;
  email: string | null;
  reason: string | null;
  assignedToName: string | null;
  status: ContactStatus;
  createdAt: string;
  taskId: string | null;
};
