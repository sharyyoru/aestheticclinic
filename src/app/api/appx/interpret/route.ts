import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type Intent = {
  type: "query" | "create" | "update" | "send" | "navigate" | "unknown";
  entity?: string;
  action?: string;
  params?: Record<string, unknown>;
};

// Helper function to execute actions directly
async function executeAction(action: string, params: Record<string, unknown>): Promise<{ success: boolean; message: string; data?: unknown }> {
  const patientId = params.patientId as string;
  
  switch (action) {
    case "update_patient": {
      const { field, value, updates } = params as { field?: string; value?: unknown; updates?: Record<string, unknown> };
      const allowedFields = ["first_name", "last_name", "phone", "email", "street_address", "postal_code", "town", "country", "gender", "marital_status", "dob"];
      
      let updateData: Record<string, unknown> = {};
      let updateDescription = "";
      
      if (updates && typeof updates === "object") {
        for (const [key, val] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            updateData[key] = val;
          }
        }
        updateDescription = Object.entries(updates).map(([k, v]) => `${k}: "${v}"`).join(", ");
      } else if (field && value !== undefined) {
        if (!allowedFields.includes(field)) {
          return { success: false, message: `Cannot update field: ${field}` };
        }
        updateData = { [field]: value };
        updateDescription = `${field} to "${value}"`;
      } else {
        return { success: false, message: "Field and value are required" };
      }

      const { data: updatedPatient, error } = await supabaseAdmin
        .from("patients")
        .update(updateData)
        .eq("id", patientId)
        .select("id, first_name, last_name, email, phone")
        .single();

      if (error) {
        return { success: false, message: `Failed to update: ${error.message}` };
      }
      return { success: true, message: `Patient updated: ${updateDescription}`, data: { patient: updatedPatient } };
    }
    
    case "create_note": {
      const content = (params.content || params.note || params.body) as string;
      if (!content) {
        return { success: false, message: "Note content is required" };
      }

      const { error } = await supabaseAdmin
        .from("patient_notes")
        .insert({
          patient_id: patientId,
          author_name: "Aliice Assistant",
          body: content,
        });

      if (error) {
        return { success: false, message: `Failed to create note: ${error.message}` };
      }
      return { success: true, message: `Note added: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"` };
    }
    
    case "create_task": {
      const taskName = (params.name || params.title || params.task) as string;
      if (!taskName) {
        return { success: false, message: "Task name is required" };
      }

      const { error } = await supabaseAdmin
        .from("tasks")
        .insert({
          patient_id: patientId,
          name: taskName,
          status: "not_started",
          priority: "medium",
        });

      if (error) {
        return { success: false, message: `Failed to create task: ${error.message}` };
      }
      return { success: true, message: `Task created: "${taskName}"` };
    }
    
    case "check_availability": {
      const { date, preferred_time } = params as { date?: string; preferred_time?: string };
      if (!date) {
        return { success: false, message: "Date is required for availability check" };
      }
      
      const availability = await checkAvailability(date, preferred_time);
      return { 
        success: true, 
        message: availability.message,
        data: { 
          available: availability.available,
          slots: availability.slots,
          date 
        }
      };
    }
    
    case "schedule_appointment": {
      const { date, time, reason } = params as { date?: string; time?: string; reason?: string };
      if (!date || !time) {
        return { success: false, message: "Date and time are required to schedule an appointment" };
      }
      
      const startTime = new Date(`${date}T${time}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min default
      
      const { error } = await supabaseAdmin
        .from("appointments")
        .insert({
          patient_id: patientId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          reason: reason || "Consultation",
          status: "scheduled",
          source: "aliice_assistant",
        });
      
      if (error) {
        return { success: false, message: `Failed to schedule: ${error.message}` };
      }
      
      return { 
        success: true, 
        message: `Appointment scheduled for ${startTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${time}.`
      };
    }
    
    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

// Check appointment availability
async function checkAvailability(date: string, preferredTime?: string): Promise<{ available: boolean; slots: string[]; message: string }> {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(8, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(18, 0, 0, 0);
  
  // Get existing appointments for that day
  const { data: existingAppts } = await supabaseAdmin
    .from("appointments")
    .select("start_time, end_time")
    .gte("start_time", startOfDay.toISOString())
    .lte("start_time", endOfDay.toISOString())
    .neq("status", "cancelled");
  
  // Generate available 30-minute slots from 9am to 5pm
  const availableSlots: string[] = [];
  const bookedTimes = new Set(existingAppts?.map(a => new Date(a.start_time).getHours() + ":" + new Date(a.start_time).getMinutes().toString().padStart(2, "0")) || []);
  
  for (let hour = 9; hour < 17; hour++) {
    for (const minute of [0, 30]) {
      const timeStr = `${hour}:${minute.toString().padStart(2, "0")}`;
      if (!bookedTimes.has(timeStr)) {
        availableSlots.push(`${hour}:${minute.toString().padStart(2, "0")}`);
      }
    }
  }
  
  // If preferred time specified, check if it's available
  if (preferredTime) {
    const isPreferredAvailable = availableSlots.includes(preferredTime);
    if (isPreferredAvailable) {
      return {
        available: true,
        slots: [preferredTime],
        message: `${preferredTime} is available on ${targetDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`
      };
    }
  }
  
  // Return first 4 available slots
  const topSlots = availableSlots.slice(0, 4);
  return {
    available: topSlots.length > 0,
    slots: topSlots,
    message: topSlots.length > 0 
      ? `Available slots on ${targetDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}: ${topSlots.map(s => s).join(", ")}`
      : `No availability on ${targetDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`
  };
}

const SYSTEM_PROMPT = `You are Aliice, an advanced Medical AI Assistant for Aesthetics Clinic. You operate like Jarvis - intelligent, proactive, and conversational. Your responses should be concise, professional, and clinically accurate.

CAPABILITIES:
• View & manage appointments, invoices, notes, medical records
• Check appointment availability and suggest optimal slots
• Add clinical notes, create follow-up tasks
• Update patient demographics (name, phone, email, address)
• Analyze payment history and outstanding balances
• Recommend follow-up actions based on patient history

INTELLIGENT BOOKING WORKFLOW:
When a user wants to schedule an appointment:
1. ALWAYS check availability first using: {"execute": {"action": "check_availability", "params": {"date": "YYYY-MM-DD", "preferred_time": "HH:MM"}}}
2. Present available slots to the user for confirmation
3. Only book after user confirms a specific slot

ACTIONS - Include at END of response when needed:
• Update patient: {"execute": {"action": "update_patient", "params": {"field": "field_name", "value": "new_value"}}}
• Create note: {"execute": {"action": "create_note", "params": {"content": "Note text"}}}
• Create task: {"execute": {"action": "create_task", "params": {"name": "Task name", "due_date": "YYYY-MM-DD"}}}
• Check slots: {"execute": {"action": "check_availability", "params": {"date": "YYYY-MM-DD"}}}
• Book appointment: {"execute": {"action": "schedule_appointment", "params": {"date": "YYYY-MM-DD", "time": "HH:MM", "reason": "Consultation"}}}

RESPONSE STYLE:
- Be conversational but efficient (max 2-3 sentences)
- Proactively suggest next steps when appropriate
- Use medical terminology appropriately
- Confirm actions before executing critical changes`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, patientId, sessionId, context } = body;

    if (!query || !patientId) {
      return NextResponse.json({ error: "Query and patientId are required" }, { status: 400 });
    }

    // Fetch comprehensive patient data including medical records
    const [
      { data: patient },
      { data: appointments },
      { data: invoices },
      { data: notes },
      { data: tasks },
      { data: deals },
      { data: consultations },
      { data: medicalHistory },
    ] = await Promise.all([
      supabaseAdmin
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single(),
      supabaseAdmin
        .from("appointments")
        .select("id, start_time, end_time, reason, status, location, provider:providers(name)")
        .eq("patient_id", patientId)
        .order("start_time", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("invoices")
        .select("id, invoice_number, total_amount, paid_amount, status, created_at, due_date")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("patient_notes")
        .select("id, body, author_name, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("tasks")
        .select("id, name, status, due_date, assigned_user_name")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("deals")
        .select("id, title, stage:deal_stages(name), value, owner_name")
        .eq("patient_id", patientId)
        .limit(3),
      // Fetch consultations/medical records
      supabaseAdmin
        .from("consultations")
        .select("id, created_at, diagnosis, treatment_plan, practitioner_name, follow_up_date")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(5),
      // Fetch medical history
      supabaseAdmin
        .from("medical_history")
        .select("id, condition, diagnosis_date, notes, status")
        .eq("patient_id", patientId)
        .order("diagnosis_date", { ascending: false })
        .limit(5),
    ]);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Calculate financial summary
    const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
    const totalPaid = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0;
    const pendingAmount = totalInvoiced - totalPaid;
    const pendingInvoices = invoices?.filter(inv => inv.status !== "paid") || [];

    // Build comprehensive context for AI
    const upcomingAppts = appointments?.filter(a => new Date(a.start_time) > new Date() && a.status !== "cancelled") || [];
    const pastAppts = appointments?.filter(a => new Date(a.start_time) <= new Date()) || [];
    
    const patientContext = `
══════════════════════════════════════════════════════
PATIENT PROFILE
══════════════════════════════════════════════════════
Name: ${patient.first_name} ${patient.last_name}
Email: ${patient.email || "N/A"}
Phone: ${patient.phone || patient.mobile || "N/A"}
DOB: ${patient.dob || "N/A"}
Gender: ${patient.gender || "N/A"}
Address: ${[patient.street_address, patient.town, patient.postal_code, patient.country].filter(Boolean).join(", ") || "N/A"}

══════════════════════════════════════════════════════
APPOINTMENTS
══════════════════════════════════════════════════════
UPCOMING (${upcomingAppts.length}):
${upcomingAppts.slice(0, 4).map(a => `• ${new Date(a.start_time).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} - ${a.reason || "Consultation"} (${a.status})`).join("\n") || "No upcoming appointments"}

RECENT VISITS (${pastAppts.length}):
${pastAppts.slice(0, 3).map(a => `• ${new Date(a.start_time).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - ${a.reason || "Consultation"}`).join("\n") || "No past visits"}

══════════════════════════════════════════════════════
FINANCIAL SUMMARY
══════════════════════════════════════════════════════
Outstanding Balance: CHF ${pendingAmount.toFixed(2)}
Total Invoiced: CHF ${totalInvoiced.toFixed(2)}
Total Paid: CHF ${totalPaid.toFixed(2)}
Pending Invoices (${pendingInvoices.length}):
${pendingInvoices.slice(0, 3).map(i => `• #${i.invoice_number}: CHF ${(i.total_amount - (i.paid_amount || 0)).toFixed(2)} due${i.due_date ? ` by ${new Date(i.due_date).toLocaleDateString("en-GB")}` : ""}`).join("\n") || "All paid ✓"}

══════════════════════════════════════════════════════
CLINICAL RECORDS
══════════════════════════════════════════════════════
CONSULTATIONS (${consultations?.length || 0}):
${consultations?.slice(0, 3).map(c => `• ${new Date(c.created_at).toLocaleDateString("en-GB")} - ${c.diagnosis || "General consultation"}${c.practitioner_name ? ` (Dr. ${c.practitioner_name})` : ""}${c.follow_up_date ? ` | Follow-up: ${new Date(c.follow_up_date).toLocaleDateString("en-GB")}` : ""}`).join("\n") || "No consultations recorded"}

MEDICAL HISTORY:
${medicalHistory?.slice(0, 3).map(h => `• ${h.condition}${h.status ? ` (${h.status})` : ""}${h.diagnosis_date ? ` - diagnosed ${new Date(h.diagnosis_date).toLocaleDateString("en-GB")}` : ""}`).join("\n") || "No medical history recorded"}

RECENT NOTES (${notes?.length || 0}):
${notes?.slice(0, 3).map(n => `• "${n.body.slice(0, 80)}${n.body.length > 80 ? "..." : ""}" - ${n.author_name}, ${new Date(n.created_at).toLocaleDateString("en-GB")}`).join("\n") || "No notes"}

══════════════════════════════════════════════════════
TASKS & FOLLOW-UPS
══════════════════════════════════════════════════════
PENDING TASKS (${tasks?.filter(t => t.status !== "completed").length || 0}):
${tasks?.filter(t => t.status !== "completed").slice(0, 3).map(t => `• ${t.name}${t.due_date ? ` (due: ${new Date(t.due_date).toLocaleDateString("en-GB")})` : ""} - ${t.status}`).join("\n") || "No pending tasks"}

ACTIVE DEALS (${deals?.length || 0}):
${deals?.map(d => `• ${d.title}: ${(d.stage as { name?: string })?.name || "Unknown"} - CHF ${d.value || 0}`).join("\n") || "None"}
══════════════════════════════════════════════════════
`;

    // Analyze intent and generate response
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const chatHistory = context?.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })) || [];

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I'm ready to help manage patient data. What would you like to do?" }] },
        ...chatHistory,
      ],
    });

    const prompt = `
${patientContext}

USER REQUEST: ${query}

Respond helpfully and conversationally. If an action is needed (update, create note, etc.), include the execute JSON at the end of your response.
Keep responses concise and friendly.`;

    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    // Parse and execute any actions from the response
    let actions: { label: string; action: string; params?: Record<string, unknown> }[] = [];
    let cleanResponse = responseText;
    let executedAction: { success: boolean; message: string; data?: unknown } | null = null;
    
    // Find and extract JSON from response - look for {"execute": ...}
    const jsonStartIndex = responseText.indexOf('{"execute"');
    if (jsonStartIndex !== -1) {
      // Find the matching closing brace
      let braceCount = 0;
      let jsonEndIndex = jsonStartIndex;
      for (let i = jsonStartIndex; i < responseText.length; i++) {
        if (responseText[i] === '{') braceCount++;
        if (responseText[i] === '}') braceCount--;
        if (braceCount === 0) {
          jsonEndIndex = i + 1;
          break;
        }
      }
      
      const jsonStr = responseText.slice(jsonStartIndex, jsonEndIndex);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.execute?.action) {
          // Execute the action directly
          const actionToExecute = parsed.execute;
          const executeResult = await executeAction(actionToExecute.action, {
            ...actionToExecute.params,
            patientId,
          });
          executedAction = executeResult;
          
          // Remove JSON from response
          cleanResponse = responseText.slice(0, jsonStartIndex).trim() + responseText.slice(jsonEndIndex).trim();
          cleanResponse = cleanResponse.trim();
          
          // Add result message
          if (executeResult.success) {
            cleanResponse = cleanResponse ? `${cleanResponse}\n\n✓ ${executeResult.message}` : `✓ ${executeResult.message}`;
          } else {
            cleanResponse = cleanResponse ? `${cleanResponse}\n\n✗ ${executeResult.message}` : `✗ ${executeResult.message}`;
          }
        }
      } catch (e) {
        console.error("Execute parse error:", e, "JSON:", jsonStr);
        // Remove the malformed JSON anyway
        cleanResponse = responseText.slice(0, jsonStartIndex).trim();
      }
    }
    
    // Also check for legacy actions format
    const actionMatch = cleanResponse.match(/\{"actions":\s*\[.*?\]\}/s);
    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[0]);
        actions = parsed.actions;
        cleanResponse = cleanResponse.replace(actionMatch[0], "").trim();
      } catch {
        // Ignore parse errors
      }
    }

    // Prepare data for display if relevant
    let data: Record<string, unknown> | undefined;
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes("appointment")) {
      data = {
        items: appointments?.slice(0, 5).map(a => ({
          date: new Date(a.start_time).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          reason: a.reason || "Consultation",
          status: a.status,
          location: a.location,
        })),
      };
    } else if (queryLower.includes("invoice") || queryLower.includes("payment") || queryLower.includes("balance")) {
      data = {
        items: pendingInvoices.slice(0, 5).map(i => ({
          invoice: `#${i.invoice_number}`,
          amount: `CHF ${i.total_amount}`,
          paid: `CHF ${i.paid_amount || 0}`,
          pending: `CHF ${(i.total_amount - (i.paid_amount || 0)).toFixed(2)}`,
          status: i.status,
        })),
      };
    } else if (queryLower.includes("note")) {
      data = {
        items: notes?.slice(0, 5).map(n => ({
          note: n.body.slice(0, 150) + (n.body.length > 150 ? "..." : ""),
          author: n.author_name,
          date: new Date(n.created_at).toLocaleDateString("en-GB"),
        })),
      };
    }

    return NextResponse.json({
      response: cleanResponse,
      data,
      actions,
      intent: { type: "query" } as Intent,
      executed: executedAction,
      // Return updated patient data for UI rehydration
      updatedPatient: (executedAction?.data as { patient?: unknown })?.patient || null,
    });
  } catch (error) {
    console.error("Interpret error:", error);
    return NextResponse.json(
      { error: "Failed to process request", response: "I'm sorry, something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
