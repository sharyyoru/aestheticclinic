import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * POST /api/retell/dropped-call
 * 
 * Webhook endpoint for Retell AI to call when the AI couldn't understand a caller.
 * This creates a dropped call record and assigns a task to follow up.
 * 
 * Logic:
 * 1. If the phone number exists in the system, find the patient and assign to deal owner
 * 2. If not found or no deal owner, use round-robin assignment among active users
 * 
 * Configure this in Retell Dashboard:
 * - Name: log_dropped_call
 * - Description: Log a call where the AI couldn't understand the caller for human follow-up
 * - API Endpoint: POST https://aestheticclinic.vercel.app/api/retell/dropped-call
 * - Parameters: from_number (string), reason (string, optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("[Dropped Call] Received:", JSON.stringify(body, null, 2));

    // Extract data from Retell payload
    const {
      // Function call arguments
      args,
      arguments: funcArgs,
      // Call metadata
      call,
      call_id,
      metadata,
      retell_llm_dynamic_variables,
    } = body;

    // Get the arguments (Retell can send them in different formats)
    const arguments_ = args || funcArgs || {};
    const fromNumber = arguments_.from_number || 
                       arguments_.phone_number || 
                       call?.from_number || 
                       metadata?.from_number ||
                       retell_llm_dynamic_variables?.phone;
    
    const reason = arguments_.reason || 
                   arguments_.disconnection_reason || 
                   "AI could not understand caller";

    if (!fromNumber) {
      console.error("[Dropped Call] No phone number provided");
      return NextResponse.json({
        success: false,
        error: "No phone number provided",
        result: "I apologize, but I couldn't log this call without a phone number.",
      });
    }

    // Normalize phone number
    let normalizedPhone = fromNumber.replace(/[^\d+]/g, "");
    if (!normalizedPhone.startsWith("+")) {
      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "+41" + normalizedPhone.slice(1);
      } else {
        normalizedPhone = "+" + normalizedPhone;
      }
    }

    console.log(`[Dropped Call] Processing dropped call from ${normalizedPhone}`);

    // Try to find patient by phone number
    const phoneVariants = [
      normalizedPhone,
      normalizedPhone.replace(/^\+/, ""),
      normalizedPhone.slice(-9),
    ];

    let patientId: string | null = null;
    let dealId: string | null = null;
    let dealOwnerId: string | null = null;

    for (const phoneVariant of phoneVariants) {
      if (!phoneVariant) continue;
      
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("id")
        .or(`phone.eq.${phoneVariant},phone.ilike.%${phoneVariant.slice(-9)}%`)
        .limit(1)
        .maybeSingle();

      if (patient) {
        patientId = patient.id;
        
        // Find the most recent active deal for this patient
        const { data: deal } = await supabaseAdmin
          .from("deals")
          .select("id, owner_id")
          .eq("patient_id", patientId)
          .not("stage_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (deal) {
          dealId = deal.id;
          dealOwnerId = deal.owner_id;
        }
        break;
      }
    }

    // Determine who to assign the task to
    let assignedTo: string | null = null;
    let assignmentMethod = "round_robin";

    if (dealOwnerId) {
      // Assign to deal owner if patient has an active deal
      assignedTo = dealOwnerId;
      assignmentMethod = "deal_owner";
      console.log(`[Dropped Call] Assigning to deal owner: ${dealOwnerId}`);
    } else {
      // Use round-robin assignment
      const { data: nextUser } = await supabaseAdmin
        .from("dropped_call_round_robin")
        .select("user_id")
        .eq("is_active", true)
        .order("last_assigned_at", { ascending: true, nullsFirst: true })
        .order("assignment_count", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextUser) {
        assignedTo = nextUser.user_id;
        
        // Update round robin tracking - increment count using raw update
        const { data: currentRecord } = await supabaseAdmin
          .from("dropped_call_round_robin")
          .select("assignment_count")
          .eq("user_id", nextUser.user_id)
          .single();

        await supabaseAdmin
          .from("dropped_call_round_robin")
          .update({
            last_assigned_at: new Date().toISOString(),
            assignment_count: (currentRecord?.assignment_count || 0) + 1,
          })
          .eq("user_id", nextUser.user_id);

        console.log(`[Dropped Call] Round-robin assigned to: ${nextUser.user_id}`);
      } else {
        console.warn("[Dropped Call] No users configured for round-robin assignment");
      }
    }

    // Create the dropped call record
    const { data: droppedCall, error: insertError } = await supabaseAdmin
      .from("dropped_calls")
      .insert({
        retell_call_id: call_id || call?.call_id || null,
        from_number: normalizedPhone,
        to_number: call?.to_number || null,
        call_duration_seconds: call?.duration_seconds || call?.duration_ms ? Math.round((call?.duration_ms || 0) / 1000) : null,
        disconnection_reason: reason,
        transcript: call?.transcript || null,
        patient_id: patientId,
        deal_id: dealId,
        assigned_to: assignedTo,
        assignment_method: assignmentMethod,
        metadata: {
          original_payload: body,
          processed_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Dropped Call] Failed to create record:", insertError);
      return NextResponse.json({
        success: false,
        error: insertError.message,
        result: "I've noted this call but encountered an issue. Someone will follow up.",
      });
    }

    // Create a follow-up task if we have someone to assign to
    let taskId: string | null = null;
    if (assignedTo) {
      const taskTitle = patientId 
        ? `Follow up: Dropped call from existing patient`
        : `Follow up: Dropped call from ${normalizedPhone}`;
      
      const taskDescription = `
A call was received but the AI could not understand the caller.

**Phone Number:** ${normalizedPhone}
**Reason:** ${reason}
${patientId ? `**Patient ID:** ${patientId}` : "**Note:** Caller not found in system"}
${dealId ? `**Deal ID:** ${dealId}` : ""}

Please call back to assist this person.
      `.trim();

      const { data: task, error: taskError } = await supabaseAdmin
        .from("tasks")
        .insert({
          title: taskTitle,
          description: taskDescription,
          assigned_to: assignedTo,
          patient_id: patientId,
          deal_id: dealId,
          priority: "high",
          status: "pending",
          due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Due in 2 hours
          metadata: {
            source: "dropped_call",
            dropped_call_id: droppedCall.id,
            from_number: normalizedPhone,
          },
        })
        .select("id")
        .single();

      if (taskError) {
        console.error("[Dropped Call] Failed to create task:", taskError);
      } else {
        taskId = task.id;
        
        // Update dropped call with task ID
        await supabaseAdmin
          .from("dropped_calls")
          .update({ task_id: taskId })
          .eq("id", droppedCall.id);

        console.log(`[Dropped Call] Created task ${taskId} for user ${assignedTo}`);
      }
    }

    console.log(`[Dropped Call] Successfully logged: ${droppedCall.id}`);

    return NextResponse.json({
      success: true,
      result: "I've logged this call and someone from our team will call you back shortly. Thank you for your patience.",
      data: {
        dropped_call_id: droppedCall.id,
        task_id: taskId,
        assigned_to: assignedTo,
        assignment_method: assignmentMethod,
        patient_found: !!patientId,
      },
    });

  } catch (error) {
    console.error("[Dropped Call] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      result: "I apologize for the difficulty. Someone will call you back shortly.",
    }, { status: 500 });
  }
}

/**
 * GET /api/retell/dropped-call
 * 
 * Returns configuration info for the dropped call webhook
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Retell Dropped Call Webhook",
    description: "Logs calls where AI couldn't understand the caller and creates follow-up tasks",
    endpoint: "/api/retell/dropped-call",
    method: "POST",
    retell_config: {
      name: "log_dropped_call",
      description: "Log this call for human follow-up because you couldn't understand the caller",
      api_endpoint: "https://aestheticclinic.vercel.app/api/retell/dropped-call",
      method: "POST",
      timeout_ms: 120000,
      parameters: {
        from_number: {
          type: "string",
          description: "The caller's phone number",
          required: true,
        },
        reason: {
          type: "string",
          description: "Why the call is being dropped (e.g., 'could not understand', 'language barrier')",
          required: false,
        },
      },
    },
    assignment_logic: [
      "1. If phone number exists in system → Find patient's active deal → Assign to deal owner",
      "2. If no deal owner or patient not found → Use round-robin among configured users",
      "3. Create high-priority task due in 2 hours",
    ],
  });
}
