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

const SYSTEM_PROMPT = `You are Aliice, an AI assistant for Aesthetics Clinic staff. You help manage patient data through natural language.

Analyze the user's query and respond with:
1. The appropriate data or confirmation
2. Any follow-up questions if needed
3. Action buttons if applicable

You can:
- Show appointments, invoices, notes, medical records
- Check pending payments and balances
- Add notes, create tasks, schedule appointments
- Update patient information
- Send reminders or emails

Always be concise and professional. Format data clearly.
If you need to perform an action, include it in your response.

Current patient context will be provided. Use it to give relevant responses.`;

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

Respond helpfully. If showing data, format it clearly. If an action is needed, describe what will happen.
For actions like "add note", "create task", "schedule appointment", include JSON actions array:
{"actions": [{"label": "Confirm", "action": "create_note", "params": {"content": "..."}}]}

Keep responses concise and mobile-friendly.`;

    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text();

    // Parse any actions from the response
    let actions: { label: string; action: string; params?: Record<string, unknown> }[] = [];
    let cleanResponse = responseText;
    
    const actionMatch = responseText.match(/\{"actions":\s*\[.*?\]\}/s);
    if (actionMatch) {
      try {
        const parsed = JSON.parse(actionMatch[0]);
        actions = parsed.actions;
        cleanResponse = responseText.replace(actionMatch[0], "").trim();
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
    });
  } catch (error) {
    console.error("Interpret error:", error);
    return NextResponse.json(
      { error: "Failed to process request", response: "I'm sorry, something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
