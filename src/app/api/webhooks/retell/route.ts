/**
 * POST /api/webhooks/retell
 *
 * Receives Retell AI webhook events (call_started, call_ended, call_analyzed).
 * On call_analyzed: saves transcript + summary as a patient_note on the patient record
 * and updates the retell_call_logs table with full call outcome.
 *
 * Retell signs webhooks with a shared secret — we verify it via the
 * x-retell-signature header using the RETELL_API_KEY as the secret.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// --------------------------------------------------------------------------
// Retell webhook payload types (documented at https://docs.retellai.com)
// --------------------------------------------------------------------------
type RetellTranscriptWord = {
  word: string;
  start: number;
  end: number;
};

type RetellTranscriptItem = {
  role: "agent" | "user";
  content: string;
  words?: RetellTranscriptWord[];
};

type RetellCallAnalysis = {
  call_summary?: string;
  in_voicemail?: boolean;
  user_sentiment?: string;
  call_successful?: boolean;
  custom_analysis_data?: Record<string, unknown>;
};

type RetellWebhookPayload = {
  event: "call_started" | "call_ended" | "call_analyzed";
  call: {
    call_id: string;
    call_status: string;
    agent_id: string;
    from_number: string;
    to_number: string;
    duration_ms?: number;
    transcript?: string;
    transcript_object?: RetellTranscriptItem[];
    call_analysis?: RetellCallAnalysis;
    recording_url?: string;
    metadata?: {
      patient_id?: string;
      deal_id?: string;
      scheduled_call_id?: string;
    };
  };
};

// --------------------------------------------------------------------------
// Signature verification
// Retell signs with HMAC-SHA256 using your API key as the secret.
// Header: x-retell-signature  (base64-encoded HMAC)
// --------------------------------------------------------------------------
async function verifyRetellSignature(
  req: NextRequest,
  body: string,
): Promise<boolean> {
  const signature = req.headers.get("x-retell-signature");
  if (!signature) return false;

  const secret = process.env.RETELL_API_KEY;
  if (!secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = Buffer.from(signature, "base64");
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(body),
    );
    return valid;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// Main handler
// --------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify signature in production (skip if env var not set for local dev)
  if (process.env.RETELL_API_KEY) {
    const valid = await verifyRetellSignature(req, rawBody);
    if (!valid) {
      console.warn("Retell webhook: invalid signature – rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: RetellWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, call } = payload;
  const callId = call?.call_id;

  if (!callId) {
    return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
  }

  console.log(`Retell webhook: event=${event} call_id=${callId}`);

  // Resolve patient/deal IDs from metadata (passed when we created the call)
  // or fall back to looking up by call_id in our retell_call_logs table
  let patientId: string | null = call.metadata?.patient_id ?? null;
  let dealId: string | null = call.metadata?.deal_id ?? null;
  let scheduledCallId: string | null = call.metadata?.scheduled_call_id ?? null;

  if (!patientId) {
    // Try to look up from existing log row
    const { data: existing } = await supabaseAdmin
      .from("retell_call_logs")
      .select("patient_id, deal_id, scheduled_call_id")
      .eq("retell_call_id", callId)
      .maybeSingle();

    if (existing) {
      patientId = existing.patient_id;
      dealId = existing.deal_id;
      scheduledCallId = existing.scheduled_call_id;
    }
  }

  const durationSeconds = call.duration_ms ? Math.round(call.duration_ms / 1000) : null;

  // --------------------------------------------------------------------------
  // Upsert the call log row
  // --------------------------------------------------------------------------
  const { error: upsertError } = await supabaseAdmin
    .from("retell_call_logs")
    .upsert(
      {
        retell_call_id: callId,
        patient_id: patientId,
        deal_id: dealId,
        scheduled_call_id: scheduledCallId,
        event_type: event,
        call_status: call.call_status,
        duration_seconds: durationSeconds,
        transcript: call.transcript ?? null,
        call_summary: call.call_analysis?.call_summary ?? null,
        recording_url: call.recording_url ?? null,
        raw_payload: payload as unknown as Record<string, unknown>,
      },
      { onConflict: "retell_call_id" },
    );

  if (upsertError) {
    console.error("Retell webhook: failed to upsert call log:", upsertError);
  }

  // --------------------------------------------------------------------------
  // On call_analyzed — write a patient_note with transcript + summary
  // --------------------------------------------------------------------------
  if (event === "call_analyzed" && patientId) {
    const analysis = call.call_analysis ?? {};
    const summary = analysis.call_summary ?? null;
    const transcript = call.transcript ?? null;
    const sentiment = analysis.user_sentiment ?? null;
    const callSuccessful = analysis.call_successful;
    const inVoicemail = analysis.in_voicemail ?? false;

    // Build a clean, readable note body
    const noteLines: string[] = [
      `📞 Valerie AI Call – ${new Date().toLocaleDateString("fr-CH")}`,
      "",
    ];

    if (inVoicemail) {
      noteLines.push("⚠️ Call reached voicemail — no live conversation.");
    } else {
      noteLines.push(`Status: ${call.call_status}`);
      if (callSuccessful !== undefined) {
        noteLines.push(`Outcome: ${callSuccessful ? "✅ Successful" : "❌ Unsuccessful"}`);
      }
      if (sentiment) {
        noteLines.push(`Patient sentiment: ${sentiment}`);
      }
      if (durationSeconds !== null) {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        noteLines.push(`Duration: ${mins}m ${secs}s`);
      }
    }

    if (summary) {
      noteLines.push("", "── Summary ──", summary);
    }

    if (transcript) {
      noteLines.push("", "── Transcript ──", transcript);
    }

    if (call.recording_url) {
      noteLines.push("", `🎙️ Recording: ${call.recording_url}`);
    }

    const noteBody = noteLines.join("\n");

    const { error: noteError } = await supabaseAdmin.from("patient_notes").insert({
      patient_id: patientId,
      author_user_id: null,
      author_name: "Valerie (AI Voice Agent)",
      body: noteBody,
    });

    if (noteError) {
      console.error("Retell webhook: failed to insert patient_note:", noteError);
    } else {
      console.log(`Retell webhook: patient_note saved for patient ${patientId}`);
    }
  }

  return NextResponse.json({ ok: true, event, call_id: callId });
}
