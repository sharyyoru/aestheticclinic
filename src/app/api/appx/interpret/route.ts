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
    
    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

const SYSTEM_PROMPT = `You are Aliice, an AI assistant for Aesthetics Clinic staff. You help manage patient data through natural language. Be conversational and helpful like Jarvis.

You can:
- Show appointments, invoices, notes, medical records
- Check pending payments and balances
- Add notes, create tasks, schedule appointments
- Update patient information (name, phone, email, address, etc.)
- Send reminders or emails

IMPORTANT: When the user wants to UPDATE patient data (like changing name, phone, email, etc.), you MUST include an action in your response using this EXACT JSON format at the end:
{"execute": {"action": "update_patient", "params": {"field": "field_name", "value": "new_value"}}}

For example:
- "Change last name to Smith" -> Include: {"execute": {"action": "update_patient", "params": {"field": "last_name", "value": "Smith"}}}
- "Update phone to +41 79 123 4567" -> Include: {"execute": {"action": "update_patient", "params": {"field": "phone", "value": "+41 79 123 4567"}}}
- "Add a note: Patient called today" -> Include: {"execute": {"action": "create_note", "params": {"content": "Patient called today"}}}

Always confirm what you're doing in a friendly, conversational way. Keep responses concise.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, patientId, sessionId, context } = body;

    if (!query || !patientId) {
      return NextResponse.json({ error: "Query and patientId are required" }, { status: 400 });
    }

    // Fetch comprehensive patient data
    const [
      { data: patient },
      { data: appointments },
      { data: invoices },
      { data: notes },
      { data: tasks },
      { data: deals },
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
    ]);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Calculate financial summary
    const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
    const totalPaid = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0;
    const pendingAmount = totalInvoiced - totalPaid;
    const pendingInvoices = invoices?.filter(inv => inv.status !== "paid") || [];

    // Build context for AI
    const patientContext = `
PATIENT: ${patient.first_name} ${patient.last_name}
Email: ${patient.email || "N/A"}
Phone: ${patient.phone || patient.mobile || "N/A"}
DOB: ${patient.dob || "N/A"}

UPCOMING APPOINTMENTS (${appointments?.length || 0}):
${appointments?.slice(0, 5).map(a => `- ${new Date(a.start_time).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} - ${a.reason || "Consultation"} (${a.status})`).join("\n") || "None"}

INVOICES (${invoices?.length || 0} total, ${pendingInvoices.length} pending):
Total Balance: CHF ${pendingAmount.toFixed(2)}
${pendingInvoices.slice(0, 3).map(i => `- #${i.invoice_number}: CHF ${(i.total_amount - (i.paid_amount || 0)).toFixed(2)} pending`).join("\n") || "All paid"}

RECENT NOTES (${notes?.length || 0}):
${notes?.slice(0, 3).map(n => `- ${n.body.slice(0, 100)}... (${n.author_name}, ${new Date(n.created_at).toLocaleDateString()})`).join("\n") || "None"}

TASKS (${tasks?.length || 0}):
${tasks?.filter(t => t.status !== "completed").slice(0, 3).map(t => `- ${t.name} (${t.status})`).join("\n") || "None pending"}

DEALS (${deals?.length || 0}):
${deals?.map(d => `- ${d.title}: ${(d.stage as { name?: string })?.name || "Unknown"} - CHF ${d.value || 0}`).join("\n") || "None"}
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
