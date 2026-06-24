import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shouldCreateDeal } from "@/lib/dealDeduplication";
import {
  CALL_FOLLOWUP_TEAM_EMAILS,
  buildCallTaskContent,
  formatTranscriptReadable,
  parseTranscriptTurns,
} from "@/lib/callLog";

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

type HubspotService = {
  id: string;
  name: string;
};

/**
 * Extract customer info from transcript or dynamic variables
 */
function extractCustomerInfo(call: RetellCallPayload["call"]): {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  serviceInterest: string;
  location: string;
} {
  const vars = call.retell_llm_dynamic_variables || {};
  const metadata = call.metadata || {};
  const analysis = (call.call_analysis?.custom_analysis_data || {}) as Record<string, unknown>;
  
  // Try to parse lead_info JSON if present (single-field extraction)
  let parsedLeadInfo: Record<string, string> = {};
  if (analysis.lead_info) {
    try {
      parsedLeadInfo = typeof analysis.lead_info === "string" ? JSON.parse(analysis.lead_info) : analysis.lead_info as Record<string, string>;
    } catch { /* ignore parse errors */ }
  }

  // Try to get name from various sources
  let firstName = (vars.first_name as string) || (analysis.first_name as string) || parsedLeadInfo.first_name || "";
  let lastName = (vars.last_name as string) || (analysis.last_name as string) || parsedLeadInfo.last_name || "";
  
  // If we have customer_name but not first/last, split it
  if (!firstName && vars.customer_name) {
    const nameParts = (vars.customer_name as string).trim().split(/\s+/);
    firstName = nameParts[0] || "";
    lastName = nameParts.slice(1).join(" ") || "";
  }
  
  // Check metadata as fallback
  if (!firstName && metadata.first_name) {
    firstName = metadata.first_name as string;
  }
  if (!lastName && metadata.last_name) {
    lastName = metadata.last_name as string;
  }
  
  // Phone from caller ID or variables or analysis
  const rawPhone = (vars.phone as string) || (vars.customer_phone as string) || (analysis.phone as string) || parsedLeadInfo.phone || call.from_number || "";
  // Skip Retell placeholder numbers (web calls have no real caller ID)
  let phone = rawPhone && !rawPhone.startsWith("+1000") ? rawPhone : "";
  
  // Email from variables, metadata, or analysis
  let email = (vars.email as string) || (metadata.email as string) || (analysis.email as string) || parsedLeadInfo.email || "";
  
  // Service interest
  let serviceInterest = (vars.service_interest as string) || (metadata.service_interest as string) || (analysis.service_interest as string) || parsedLeadInfo.service_interest || "";
  
  // Location
  let location = (vars.location as string) || (analysis.location as string) || parsedLeadInfo.location || "";
  
  return { firstName, lastName, phone, email, serviceInterest, location };
}

/**
 * Match a service interest string to the closest service
 */
function matchServiceToHubspot(
  serviceInterest: string,
  hubspotServices: HubspotService[]
): HubspotService | null {
  if (!serviceInterest || hubspotServices.length === 0) return null;

  const normalizedInterest = serviceInterest.toLowerCase().trim();

  // Direct match first
  const directMatch = hubspotServices.find(
    (s) => s.name.toLowerCase() === normalizedInterest
  );
  if (directMatch) return directMatch;

  // Keyword matching patterns for common services
  const serviceKeywords: { keywords: string[]; serviceNames: string[] }[] = [
    { keywords: ["breast", "augment", "implant", "mammoplasty"], serviceNames: ["breast augmentation", "breast"] },
    { keywords: ["face", "filler", "facial filler"], serviceNames: ["face filler", "facial filler", "filler"] },
    { keywords: ["wrinkle", "ride", "rides", "anti-age", "antiage"], serviceNames: ["wrinkle", "anti-aging", "rides"] },
    { keywords: ["blepharo", "eyelid", "paupière"], serviceNames: ["blepharoplasty", "eyelid"] },
    { keywords: ["lipo", "liposuc"], serviceNames: ["liposuction", "lipo"] },
    { keywords: ["iv", "therapy", "infusion", "drip"], serviceNames: ["iv therapy", "infusion"] },
    { keywords: ["rhino", "nose", "nez"], serviceNames: ["rhinoplasty", "nose"] },
    { keywords: ["facelift", "lifting", "face lift"], serviceNames: ["facelift", "face lift"] },
    { keywords: ["botox", "toxin"], serviceNames: ["botox", "botulinum"] },
    { keywords: ["lip", "lèvre"], serviceNames: ["lip filler", "lip"] },
    { keywords: ["tummy", "tuck", "abdominoplast"], serviceNames: ["tummy tuck", "abdominoplasty"] },
    { keywords: ["breast", "lift", "mastopexy"], serviceNames: ["breast lift", "mastopexy"] },
    { keywords: ["hyperbaric", "oxygen", "hbot"], serviceNames: ["hyperbaric", "hbot", "oxygen"] },
    { keywords: ["consultation", "consult", "rendez-vous"], serviceNames: ["consultation", "consult"] },
  ];

  // Try keyword matching
  for (const { keywords, serviceNames } of serviceKeywords) {
    const hasKeyword = keywords.some((k) => normalizedInterest.includes(k));
    if (hasKeyword) {
      for (const serviceName of serviceNames) {
        const match = hubspotServices.find((s) =>
          s.name.toLowerCase().includes(serviceName)
        );
        if (match) return match;
      }
    }
  }

  // Partial match
  const interestWords = normalizedInterest.split(/\s+/).filter((w) => w.length > 3);
  for (const word of interestWords) {
    const partialMatch = hubspotServices.find((s) =>
      s.name.toLowerCase().includes(word)
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RetellCallPayload;
    
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
    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    const phoneVariants = [
      normalizedPhone,
      normalizedPhone.replace(/^\+/, ""),
      normalizedPhone.slice(-9),
    ];

    let patientRow: { id: string; notes: string | null } | null = null;

    for (const phoneVariant of phoneVariants) {
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

      const { data: existingLog } = await supabaseAdmin
        .from("call_logs")
        .select("id, task_id")
        .eq("call_id", call.call_id)
        .maybeSingle();

      if (existingLog) {
        // Enrich the existing log with anything new (summary/transcript).
        await supabaseAdmin
          .from("call_logs")
          .update({
            call_status: call.call_status,
            disconnection_reason: call.disconnection_reason ?? null,
            duration_seconds: callDuration,
            summary: summary ?? undefined,
            transcript: transcriptText || undefined,
            transcript_turns: turns.length > 0 ? turns : undefined,
            deal_id: dealId,
          })
          .eq("id", existingLog.id);
      } else {
        // Round-robin assignee for inbound/web calls (skip outbound).
        let assignedUserId: string | null = null;
        let assignedUserName: string | null = null;
        let taskId: string | null = null;
        const isInbound = call.direction !== "outbound";

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

        const { error: logError } = await supabaseAdmin.from("call_logs").insert({
          call_id: call.call_id,
          patient_id: patientId,
          deal_id: dealId,
          direction: call.direction || "inbound",
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
          source: "retell",
          started_at: startedAt,
        });
        if (logError) {
          console.error("[Retell Agent] Failed to insert call_log:", logError);
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
