/**
 * Shared utility to log every email sent by the system into the `emails` table.
 * Non-fatal: if logging fails, callers should still send the email.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type EmailSource =
  | "manual"
  | "automation"
  | "ai_transcript"
  | "appointment_reminder"
  | "otp"
  | "scheduled_reminder"
  | "marketing"
  | "invoice"
  | "missed_call";

export interface LogEmailOpts {
  patient_id?: string | null;
  to_address: string;
  from_address?: string | null;
  subject: string;
  body?: string | null;
  direction?: "outbound" | "inbound";
  status?: "sent" | "failed" | "queued" | "draft";
  source?: EmailSource;
  deal_id?: string | null;
}

/**
 * Insert an email record into the `emails` table for reporting.
 * Returns the inserted email ID (useful for tracking pixel injection), or null on failure.
 */
export async function logEmailSent(opts: LogEmailOpts): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("emails")
      .insert({
        patient_id: opts.patient_id || null,
        to_address: opts.to_address,
        from_address: opts.from_address || null,
        subject: opts.subject,
        body: opts.body || null,
        direction: opts.direction || "outbound",
        status: opts.status || "sent",
        source: opts.source || "manual",
        deal_id: opts.deal_id || null,
        sent_at: opts.status === "sent" ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[logEmailSent] Failed to log email:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error("[logEmailSent] Unexpected error:", err);
    return null;
  }
}
