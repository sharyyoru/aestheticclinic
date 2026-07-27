import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shouldCreateDeal } from "@/lib/dealDeduplication";
import { normalizePhone } from "@/lib/retell";
import {
  CALL_FOLLOWUP_TEAM_EMAILS,
  buildCallTaskContent,
  formatTranscriptReadable,
  parseTranscriptTurns,
} from "@/lib/callLog";
import { extractCustomerInfo, matchServiceToHubspot, type HubspotService } from "@/lib/retellWebhookHelpers";
import { sendCallLogConversationEmail } from "@/lib/callLogEmail";

// Where transcript notifications for workflow-triggered (non-scheduled)
// outbound AI calls are sent, since those calls have no initiating user.
const WORKFLOW_CALL_NOTIFICATION_TO = "info@aesthetics-ge.ch";

/**
 * Webhook endpoint for receiving Retell AI Agent call data
 * 
 * Retell sends webhooks for:
 * - call_started: When a call begins
 * - call_ended: When a call ends (includes transcript)
 * - call_analyzed: When post-call analysis is complete
 * 
 * This endpoint creates a new contact in "Request for Information" stage
 */

type RetellCallPayload = {
  event: "call_started" | "call_ended" | "call_analyzed";
  call: {
    call_type: string;
    from_number: string;
    to_number: string;
    direction: "inbound" | "outbound";
    call_id: string;
    agent_id: string;
    call_status: string;
    metadata?: Record<string, unknown>;
    retell_llm_dynamic_variables?: {
      customer_name?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      service_interest?: string;
      [key: string]: unknown;
    };
    start_timestamp?: number;
    end_timestamp?: number;
    disconnection_reason?: string;
    transcript?: string;
    transcript_object?: Array<{
      role: string;
      content: string;
      words?: Array<{ word: string; start: number; end: number }>;
    }>;
    call_analysis?: {
      call_summary?: string;
      user_sentiment?: string;
      call_successful?: boolean;
      custom_analysis_data?: Record<string, unknown>;
      [key: string]: unknown;
    };
    opt_out_sensitive_data_storage?: boolean;
  };
};

/**
 * Mirror every incoming Retell webhook into retell_request_logs so the
 * /agents "Retell Logs" tab reflects live call activity. The clinic migrated
 * to conversation-flow agents whose events land here (not on the old
 * /api/retell/webhook endpoint), which is why that tab stopped updating.
 * Fire-and-forget: never block or fail the lead flow because of logging.
 */
async function logRetellAgentRequest(payload: RetellCallPayload) {
  try {
    const call = payload.call;
    const dynamicVars = call?.retell_llm_dynamic_variables ?? null;
    const patientIdRaw =
      (dynamicVars?.patient_id as string | undefined) ??
      (call?.metadata?.patient_id as string | undefined);
    await supabaseAdmin.from("retell_request_logs").insert({
      call_id: call?.call_id ?? null,
      event_type: payload.event ?? null,
      function_name: null,
      request_body: payload as unknown as Record<string, unknown>,
      metadata: call?.metadata ?? null,
      dynamic_variables: dynamicVars,
      call_data: call ?? null,
      patient_id: typeof patientIdRaw === "string" ? patientIdRaw : null,
    });
  } catch (logError) {
    console.error("[Retell Agent] Failed to log request:", logError);
  }
}

/**
 * Retell disconnection reasons that mean the call never reached the patient
 * (carrier/telephony failures). These must surface as failures, not silent
 * "in progress" tasks — e.g. SIP 603 Decline arrives as `user_declined`.
 */
const NOT_CONNECTED_REASONS = new Set([
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

/**
 * Produce a human-readable outcome from Retell's disconnection_reason so
 * schedulers see *why* a call did not go through instead of a raw code.
 */
function describeDisconnection(reason: string | null | undefined): {
  connected: boolean;
  label: string;
} {
  const r = (reason || "").toLowerCase();
  if (!r) return { connected: true, label: "" };
  if (r === "user_declined") {
    return { connected: false, label: "Call declined by the carrier/recipient (SIP 603)" };
  }
  if (r === "dial_busy") return { connected: false, label: "Line busy" };
  if (r === "dial_no_answer") return { connected: false, label: "No answer" };
  if (r === "dial_failed") return { connected: false, label: "Dial failed (carrier could not connect the call)" };
  if (r === "voicemail_reached") return { connected: false, label: "Reached voicemail" };
  if (NOT_CONNECTED_REASONS.has(r)) {
    return { connected: false, label: `Call not connected (${reason})` };
  }
  return { connected: true, label: "" };
}

/**
 * Update the task linked to a scheduled AI call. We mark it completed when the
 * call finishes successfully, failed when Retell reports failure or the call
 * never connected (carrier decline, busy, no-answer), and leave it in_progress
 * for everything else so a human can review.
 *
 * Also sends the readable transcript to the user who scheduled the call and
 * annotates the task/call log with a notification that the email was sent.
 */
async function updateLinkedAiTask(
  scheduledCallId: string,
  callStatus: string,
  summary: string | null,
  transcriptContext?: {
    patientName: string;
    callId: string;
    startedAt: string | null;
    durationSeconds: number | null;
    fromNumber: string | null;
    toNumber: string | null;
    transcript: string | null;
    turns: import("@/lib/callLog").CallTurn[];
  },
  disconnectionReason?: string | null,
  eventType?: "call_started" | "call_ended" | "call_analyzed",
) {
  try {
    const { data: scheduled } = await supabaseAdmin
      .from("retell_scheduled_calls")
      .select("task_id, scheduled_by_email, scheduled_by_name")
      .eq("id", scheduledCallId)
      .maybeSingle();

    const taskId = scheduled?.task_id as string | null;
    const schedulerEmail = scheduled?.scheduled_by_email as string | null;
    const schedulerName = scheduled?.scheduled_by_name as string | null;

    const { connected, label: disconnectLabel } = describeDisconnection(disconnectionReason);

    let nextStatus = "in_progress";
    const lower = (callStatus || "").toLowerCase();
    if (!connected) {
      // Carrier/telephony failure (e.g. SIP 603 decline, busy, no-answer):
      // the call never reached the patient — surface it as a failure.
      nextStatus = "failed";
    } else if (lower === "completed") {
      nextStatus = "completed";
    } else if (["failed", "error", "busy", "no-answer", "canceled", "cancelled", "not_connected"].includes(lower)) {
      nextStatus = "failed";
    }

    // Send the transcript email to the user who INITIATED the call.
    //
    // We send it on the `call_analyzed` event, because that is the only event
    // that carries the AI summary (`call.call_analysis.call_summary`). Sending
    // here means the emailed copy matches the call log exactly (summary +
    // readable transcript) instead of an earlier, summary-less version.
    //
    // `call_analyzed` fires exactly once per call, so gating on it also
    // de-duplicates the email (both call_ended and call_analyzed invoke this
    // function). Failed/not-connected calls have no transcript, so they are
    // naturally skipped below.
    let emailSent = false;
    const hasTranscript =
      !!transcriptContext &&
      (transcriptContext.turns.length > 0 ||
        !!(transcriptContext.transcript && transcriptContext.transcript.trim()));
    if (
      connected &&
      schedulerEmail &&
      hasTranscript &&
      eventType === "call_analyzed" &&
      transcriptContext
    ) {
      try {
        const { sent } = await sendCallLogConversationEmail({
          patientName: transcriptContext.patientName,
          callId: transcriptContext.callId,
          direction: "task_outbound",
          startedAt: transcriptContext.startedAt,
          durationSeconds: transcriptContext.durationSeconds,
          callStatus,
          fromNumber: transcriptContext.fromNumber,
          toNumber: transcriptContext.toNumber,
          summary,
          transcript: transcriptContext.transcript,
          turns: transcriptContext.turns,
        }, schedulerEmail);
        emailSent = !!sent;
        if (emailSent) {
          console.log(
            `[Retell Agent] Transcript emailed to initiator ${schedulerEmail} for call ${transcriptContext.callId}`
          );
        }
      } catch (emailErr) {
        console.error("[Retell Agent] Failed to send transcript email to initiator:", emailErr);
      }
    }

    // Build task content with email notification
    const emailNote = emailSent
      ? `\n\n📧 Transcript emailed to: ${schedulerName || schedulerEmail}`
      : "";
    const callIdNote = transcriptContext?.callId
      ? `\n\nCall ID: ${transcriptContext.callId}`
      : "";
    const outcomeNote = disconnectLabel ? `\n\n⚠️ ${disconnectLabel}` : "";

    if (taskId) {
      await supabaseAdmin
        .from("tasks")
        .update({
          status: nextStatus,
          content: !connected
            ? `AI call did not go through.${outcomeNote}${callIdNote}\n\nStatus: ${callStatus}${emailNote}`
            : summary
            ? `${summary}${callIdNote}\n\n(Status: ${callStatus})${emailNote}`
            : `AI call finished.${callIdNote}\n\nStatus: ${callStatus}${emailNote}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }

    // Also annotate the call_log entry with email notification
    if (emailSent) {
      await supabaseAdmin
        .from("call_logs")
        .update({
          assigned_user_name: `Transcript sent to ${schedulerName || schedulerEmail}`,
        })
        .eq("scheduled_call_id", scheduledCallId);
    }
  } catch (err) {
    console.error("[Retell Agent] Failed to update linked AI task:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RetellCallPayload;

    // Log every incoming webhook (fire-and-forget) for the Retell Logs tab.
    void logRetellAgentRequest(payload);

    console.log("[Retell Agent] Received webhook:", payload.event, payload.call?.call_id);
    console.log("[Retell Agent] Payload:", JSON.stringify({
      event: payload.event,
      call_id: payload.call?.call_id,
      from_number: payload.call?.from_number,
      to_number: payload.call?.to_number,
      direction: payload.call?.direction,
      call_status: payload.call?.call_status,
      metadata: payload.call?.metadata,
      dynamic_vars: payload.call?.retell_llm_dynamic_variables,
      disconnection_reason: payload.call?.disconnection_reason,
    }));

    // Process call_ended and call_analyzed events
    if (payload.event !== "call_ended" && payload.event !== "call_analyzed") {
      console.log("[Retell Agent] Ignoring event:", payload.event);
      return NextResponse.json({ success: true, message: `Event ${payload.event} acknowledged` });
    }

    const call = payload.call;
    if (!call) {
      return NextResponse.json(
        { success: false, error: "Missing call data" },
        { status: 400 }
      );
    }

    // Extract customer information
    const { firstName, lastName, phone, email, serviceInterest, location } = extractCustomerInfo(call);

    // We need at least a phone number to create a lead
    if (!phone) {
      console.log("[Retell Agent] No phone number available, skipping lead creation");
      return NextResponse.json({ 
        success: true, 
        message: "No phone number available, lead not created" 
      });
    }

    console.log("[Retell Agent] Processing lead:", { firstName, lastName, phone, email, serviceInterest, location });

    // Check if patient already exists by phone
    const normalizedPhone = normalizePhone(phone);
    const phoneVariants = [
      normalizedPhone,
      normalizedPhone.replace(/^\+/, ""),
      normalizedPhone.slice(-9),
    ];

    let patientRow: { id: string; notes: string | null } | null = null;

    // Prefer the explicit patient_id from call metadata (set by our workflow +
    // outbound-call endpoints). This is the most reliable link — especially for
    // outbound calls where the recipient number formatting can vary — so we
    // never mis-attribute a call to the wrong patient.
    const metadataPatientId =
      typeof call.metadata?.patient_id === "string" ? (call.metadata.patient_id as string) : null;
    if (metadataPatientId) {
      const { data: byId } = await supabaseAdmin
        .from("patients")
        .select("id, notes")
        .eq("id", metadataPatientId)
        .maybeSingle();
      if (byId) patientRow = byId;
    }

    for (const phoneVariant of phoneVariants) {
      if (patientRow) break;
      if (!phoneVariant) continue;
      
      const { data: existingByPhone } = await supabaseAdmin
        .from("patients")
        .select("id, notes")
        .or(`phone.eq.${phoneVariant},phone.ilike.%${phoneVariant.slice(-9)}%`)
        .limit(1)
        .maybeSingle();

      if (existingByPhone) {
        patientRow = existingByPhone;
        break;
      }
    }

    // Also check by email if provided
    if (!patientRow && email) {
      const { data: existingByEmail } = await supabaseAdmin
        .from("patients")
        .select("id, notes")
        .eq("email", email.toLowerCase())
        .limit(1)
        .maybeSingle();

      if (existingByEmail) {
        patientRow = existingByEmail;
      }
    }

    let patientId: string;
    let isNewPatient = false;

    // Build notes with Retell call info
    const callDuration = call.end_timestamp && call.start_timestamp 
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : null;
    
    const leadInfo = {
      source: "Retell AI Agent",
      call_id: call.call_id,
      agent_id: call.agent_id,
      direction: call.direction,
      from_number: call.from_number,
      to_number: call.to_number,
      duration_seconds: callDuration,
      disconnection_reason: call.disconnection_reason,
      service_interest: serviceInterest,
      location: location || undefined,
      received_at: new Date().toISOString(),
    };
    
    const transcriptNote = call.transcript 
      ? `\n\nTranscript:\n${call.transcript.substring(0, 2000)}${call.transcript.length > 2000 ? "..." : ""}`
      : "";
    
    const leadNote = `\n\n[Retell AI Call] ${JSON.stringify(leadInfo, null, 2)}${transcriptNote}`;

    if (patientRow) {
      // Update existing patient
      patientId = patientRow.id;
      const existingNotes = patientRow.notes || "";

      const { error: updateError } = await supabaseAdmin
        .from("patients")
        .update({
          ...(firstName && { first_name: firstName }),
          ...(lastName && { last_name: lastName }),
          ...(email && { email: email.toLowerCase() }),
          notes: (existingNotes + leadNote).trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", patientId);

      if (updateError) {
        console.error("[Retell Agent] Failed to update patient:", updateError);
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Create new patient
      isNewPatient = true;

      const { data: newPatient, error: insertError } = await supabaseAdmin
        .from("patients")
        .insert({
          first_name: firstName || "Unknown",
          last_name: lastName || "Caller",
          email: email ? email.toLowerCase() : null,
          phone: normalizedPhone,
          source: "Retell AI Agent",
          lifecycle_stage: "lead",
          notes: leadNote.trim(),
        })
        .select("id")
        .single();

      if (insertError || !newPatient) {
        console.error("[Retell Agent] Failed to create patient:", insertError);
        return NextResponse.json(
          { success: false, error: insertError?.message || "Failed to create patient" },
          { status: 500 }
        );
      }

      patientId = newPatient.id;
    }

    // Get "Request for Information" stage (or default lead stage)
    const { data: requestForInfoStage } = await supabaseAdmin
      .from("deal_stages")
      .select("id")
      .ilike("name", "%request for information%")
      .limit(1)
      .maybeSingle();

    let stageId = requestForInfoStage?.id;

    // Fallback to default lead stage
    if (!stageId) {
      const { data: defaultStage } = await supabaseAdmin
        .from("deal_stages")
        .select("id")
        .eq("is_default", true)
        .eq("type", "lead")
        .single();
      
      stageId = defaultStage?.id;
    }

    // Load services for matching
    const { data: hubspotServices } = await supabaseAdmin
      .from("services")
      .select("id, name")
      .order("name", { ascending: true });

    const matchedService = matchServiceToHubspot(
      serviceInterest,
      (hubspotServices as HubspotService[]) || []
    );
    const serviceId = matchedService?.id || null;
    const finalServiceInterest = matchedService?.name || serviceInterest || "General Inquiry";

    // Check for existing deal (within 6 hours)
    const dealCheck = await shouldCreateDeal(supabaseAdmin, {
      patientId,
      serviceId: serviceId || undefined,
    });

    let dealId: string;

    if (dealCheck.shouldCreate) {
      // Create new deal in "Request for Information" stage
      const { data: newDeal, error: dealError } = await supabaseAdmin
        .from("deals")
        .insert({
          patient_id: patientId,
          title: `${firstName || "Unknown"} ${lastName || "Caller"} - ${finalServiceInterest}`,
          pipeline: "Lead to Surgery",
          stage_id: stageId,
          service_id: serviceId,
          notes: `Source: Retell AI Agent\nCall ID: ${call.call_id}\nDirection: ${call.direction}\nFrom: ${call.from_number}\nDuration: ${callDuration ? `${callDuration}s` : "N/A"}\nService Interest: ${finalServiceInterest}`,
        })
        .select("id")
        .single();

      if (dealError || !newDeal) {
        console.error("[Retell Agent] Failed to create deal:", dealError);
        return NextResponse.json(
          { success: false, error: dealError?.message || "Failed to create deal" },
          { status: 500 }
        );
      }

      dealId = newDeal.id;
    } else {
      dealId = dealCheck.existingDeal.id;
      console.log(`[Retell Agent] Skipped deal creation — recent deal exists: ${dealId}`);
      
      // Update existing deal with call notes
      await supabaseAdmin
        .from("deals")
        .update({
          notes: `[Retell Call ${new Date().toISOString()}]\nCall ID: ${call.call_id}\nFrom: ${call.from_number}\nDuration: ${callDuration ? `${callDuration}s` : "N/A"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);
    }

    console.log(`[Retell Agent] Lead processed: Patient ${patientId}, Deal ${dealId}, New: ${isNewPatient}`);

    // ========================================
    // CALL LOG + ROUND-ROBIN FOLLOW-UP TASK
    // ========================================
    // Record the conversation in the unified call_logs table and, for inbound
    // calls, create ONE follow-up task round-robin assigned to the call team.
    // Both call_ended and call_analyzed fire for a call, so we dedupe on
    // call_id: the first event creates the log + task, later events only
    // enrich it (e.g. call_analyzed adds the summary). This never blocks the
    // lead flow — failures are logged and swallowed.
    try {
      const turns = parseTranscriptTurns({
        transcript_object: call.transcript_object,
        transcript: call.transcript,
      });
      const transcriptText = call.transcript || formatTranscriptReadable(turns);
      const summary = call.call_analysis?.call_summary || null;
      const startedAt = call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null;
      const patientFullName = `${firstName || "Unknown"} ${lastName || "Caller"}`.trim();

      // Did the agent send a WhatsApp booking link during this call? That is
      // logged separately by the in-call function webhook into
      // retell_request_logs (function_name = 'send_whatsapp'), keyed by call_id.
      let whatsappSentAt: string | null = null;
      const { data: waLog } = await supabaseAdmin
        .from("retell_request_logs")
        .select("created_at")
        .eq("call_id", call.call_id)
        .eq("function_name", "send_whatsapp")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (waLog?.created_at) whatsappSentAt = waLog.created_at as string;

      // Try to find an existing log by Retell call_id first, then fall back to
      // the pre-created scheduled row (metadata.scheduled_call_id) so scheduled
      // AI calls update the same CRM log entry once they actually fire.
      let existingLogQuery = supabaseAdmin
        .from("call_logs")
        .select("id, task_id")
        .eq("call_id", call.call_id);

      let existingLog = await existingLogQuery.maybeSingle().then((r) => r.data);

      const scheduledCallId = (call.metadata?.scheduled_call_id as string) || null;
      if (!existingLog && scheduledCallId && patientId) {
        const { data: scheduledLog } = await supabaseAdmin
          .from("call_logs")
          .select("id, task_id")
          .eq("scheduled_call_id", scheduledCallId)
          .eq("patient_id", patientId)
          .maybeSingle();
        existingLog = scheduledLog ?? null;
      }

      if (existingLog) {
        // Enrich the existing log with anything new (summary/transcript).
        await supabaseAdmin
          .from("call_logs")
          .update({
            call_id: call.call_id,
            call_status: call.call_status,
            disconnection_reason: call.disconnection_reason ?? null,
            duration_seconds: callDuration,
            summary: summary ?? undefined,
            transcript: transcriptText || undefined,
            transcript_turns: turns.length > 0 ? turns : undefined,
            whatsapp_sent_at: whatsappSentAt ?? undefined,
            deal_id: dealId,
            from_number: call.from_number || null,
            to_number: call.to_number || null,
            agent_id: call.agent_id || null,
            started_at: startedAt,
          })
          .eq("id", existingLog.id);
      } else {
        // Round-robin assignee for inbound/web calls (skip outbound & task_outbound).
        let assignedUserId: string | null = null;
        let assignedUserName: string | null = null;
        let taskId: string | null = null;
        const isInbound = call.direction !== "outbound" && !scheduledCallId;

        if (isInbound) {
          const { data: teamUsers } = await supabaseAdmin
            .from("users")
            .select("id, full_name, email")
            .in("email", CALL_FOLLOWUP_TEAM_EMAILS);

          if (teamUsers && teamUsers.length > 0) {
            // Order deterministically to match the configured team order, then
            // pick the next assignee based on how many calls already logged.
            const ordered = CALL_FOLLOWUP_TEAM_EMAILS
              .map((email) => teamUsers.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()))
              .filter((u): u is NonNullable<typeof u> => Boolean(u));
            const team = ordered.length > 0 ? ordered : teamUsers;

            const { count: logCount } = await supabaseAdmin
              .from("call_logs")
              .select("*", { count: "exact", head: true });
            const assignee = team[(logCount || 0) % team.length];
            assignedUserId = assignee.id;
            assignedUserName = assignee.full_name || assignee.email || null;

            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1); // due tomorrow

            const taskContent = buildCallTaskContent({
              patientName: patientFullName,
              direction: call.direction,
              when: startedAt ? new Date(startedAt) : new Date(),
              durationSeconds: callDuration,
              callStatus: call.call_status,
              serviceInterest: finalServiceInterest,
              summary,
              turns,
            });

            const { data: newTask, error: taskError } = await supabaseAdmin
              .from("tasks")
              .insert({
                name: `Call back: ${patientFullName}`,
                content: taskContent,
                status: "not_started",
                priority: "high",
                type: "call",
                activity_date: dueDate.toISOString(),
                assigned_user_id: assignedUserId,
                assigned_user_name: assignedUserName,
                patient_id: patientId,
                created_by_name: "Aliice (AI Call Agent)",
              })
              .select("id")
              .single();

            if (taskError) {
              console.error("[Retell Agent] Failed to create call-back task:", taskError);
            } else {
              taskId = newTask?.id ?? null;
              console.log(`[Retell Agent] Call-back task ${taskId} assigned to ${assignedUserName}`);
            }
          } else {
            console.warn("[Retell Agent] Call follow-up team not found:", CALL_FOLLOWUP_TEAM_EMAILS);
          }
        }

        // If this is a scheduled AI call (has scheduled_call_id in metadata), mark as task_outbound
        const callDirection = scheduledCallId
          ? "task_outbound"
          : (call.direction || "inbound");

        const { data: insertedCallLog, error: logError } = await supabaseAdmin
          .from("call_logs")
          .insert({
            call_id: call.call_id,
            patient_id: patientId,
            deal_id: dealId,
            direction: callDirection,
            agent_id: call.agent_id || null,
            from_number: call.from_number || null,
            to_number: call.to_number || null,
            call_status: call.call_status || null,
            disconnection_reason: call.disconnection_reason ?? null,
            duration_seconds: callDuration,
            summary,
            transcript: transcriptText || null,
            transcript_turns: turns.length > 0 ? turns : null,
            service_interest: finalServiceInterest,
            task_id: taskId,
            assigned_user_id: assignedUserId,
            assigned_user_name: assignedUserName,
            whatsapp_sent_at: whatsappSentAt,
            source: "retell",
            started_at: startedAt,
          })
          .select("id")
          .single();
        if (logError) {
          console.error("[Retell Agent] Failed to insert call_log:", logError);
        }

        // Route the post-call notification email:
        // - Scheduled AI calls (from the AI Call button) → the initiating user,
        //   handled inside updateLinkedAiTask.
        // - Workflow-triggered / other non-scheduled outbound calls have no
        //   initiating user, so they notify the clinic inbox instead.
        // Both send on `call_analyzed` so the email includes the AI summary +
        // full transcript, matching the call log exactly.
        const linkedScheduledCallId = (call.metadata?.scheduled_call_id as string) || null;
        if (linkedScheduledCallId && (payload.event === "call_ended" || payload.event === "call_analyzed")) {
          await updateLinkedAiTask(linkedScheduledCallId, call.call_status, summary, {
            patientName: patientFullName,
            callId: call.call_id,
            startedAt,
            durationSeconds: callDuration,
            fromNumber: call.from_number || null,
            toNumber: call.to_number || null,
            transcript: transcriptText,
            turns,
          }, call.disconnection_reason, payload.event);
        } else if (
          !linkedScheduledCallId &&
          call.direction === "outbound" &&
          payload.event === "call_analyzed"
        ) {
          const { connected: didConnect } = describeDisconnection(call.disconnection_reason);
          const hasTranscript = turns.length > 0 || !!(transcriptText && transcriptText.trim());
          if (didConnect && hasTranscript) {
            try {
              await sendCallLogConversationEmail({
                patientName: patientFullName,
                callId: call.call_id,
                direction: call.direction || "outbound",
                startedAt,
                durationSeconds: callDuration,
                callStatus: call.call_status,
                fromNumber: call.from_number,
                toNumber: call.to_number,
                summary,
                transcript: transcriptText,
                turns,
              }, WORKFLOW_CALL_NOTIFICATION_TO);
              console.log(
                `[Retell Agent] Workflow call transcript emailed to ${WORKFLOW_CALL_NOTIFICATION_TO} for call ${call.call_id}`
              );
            } catch (emailError) {
              console.error("[Retell Agent] Failed to email workflow call log:", emailError);
            }
          }
        }
      }
    } catch (callLogErr) {
      console.error("[Retell Agent] Call log / task step failed (non-fatal):", callLogErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        patient_id: patientId,
        deal_id: dealId,
        is_new_patient: isNewPatient,
        service_matched: matchedService?.name || null,
      },
    });

  } catch (error) {
    console.error("[Retell Agent] Error processing webhook:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// GET for webhook verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Retell AI Agent webhook is active",
    endpoint: "/api/webhooks/retell-agent",
    method: "POST",
    events: ["call_started", "call_ended", "call_analyzed"],
    description: "Creates leads in 'Request for Information' stage from Retell AI calls",
  });
}
