import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// CORS preflight handler for public embed access
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Extract contact info from message content
function extractContactInfo(content: string): { email?: string; phone?: string; name?: string } {
  const result: { email?: string; phone?: string; name?: string } = {};
  
  // Extract email
  const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
  if (emailMatch) result.email = emailMatch[0].toLowerCase();
  
  // Extract phone (various formats)
  const phoneMatch = content.match(/(?:\+?[\d][\d\s\-.()]{8,20}[\d])/);
  if (phoneMatch) result.phone = phoneMatch[0].replace(/[\s\-.()]/g, "");
  
  return result;
}

export async function POST(req: NextRequest) {
  if (!RETELL_API_KEY) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json() as { chat_id: string; content: string; conversation_id?: string };

  if (!body.chat_id || !body.content) {
    return NextResponse.json({ error: "chat_id and content are required" }, { status: 400 });
  }

  const res = await fetch("https://api.retellai.com/create-chat-completion", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: body.chat_id,
      content: body.content,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Retell chat-completion error:", res.status, text);
    return NextResponse.json({ error: `Retell error ${res.status}` }, { status: 502 });
  }

  const data = await res.json();

  // Update conversation in our database
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get existing conversation
    const { data: existing } = await supabase
      .from("chat_conversations")
      .select("id, messages, extracted_data, visitor_email, visitor_phone")
      .eq("retell_chat_id", body.chat_id)
      .single();

    if (existing) {
      // Extract contact info from user message
      const extracted = extractContactInfo(body.content);
      const existingExtracted = existing.extracted_data || {};
      
      // Build new messages array
      const userMsg = { role: "user", content: body.content, timestamp: Date.now() };
      const agentMsgs = Array.isArray(data.message_with_tool_calls)
        ? data.message_with_tool_calls
            .filter((m: { role: string }) => m.role === "agent")
            .map((m: { role: string; content: string; created_timestamp: number }) => ({
              role: m.role,
              content: m.content,
              timestamp: m.created_timestamp,
            }))
        : [];

      const updatedMessages = [...(existing.messages || []), userMsg, ...agentMsgs];
      const updatedExtracted = { ...existingExtracted, ...extracted };

      // Update conversation
      const updateData: Record<string, unknown> = {
        messages: updatedMessages,
        extracted_data: updatedExtracted,
      };

      // Set visitor info if extracted
      if (extracted.email && !existing.visitor_email) {
        updateData.visitor_email = extracted.email;
      }
      if (extracted.phone && !existing.visitor_phone) {
        updateData.visitor_phone = extracted.phone;
      }

      await supabase
        .from("chat_conversations")
        .update(updateData)
        .eq("id", existing.id);

      // Try to match to existing patient
      if ((extracted.email || extracted.phone) && !existing.visitor_email && !existing.visitor_phone) {
        let patientId: string | null = null;
        let matchType: string | null = null;

        // Try email match first
        if (extracted.email) {
          const { data: patientByEmail } = await supabase
            .from("patients")
            .select("id")
            .eq("email", extracted.email)
            .single();
          
          if (patientByEmail) {
            patientId = patientByEmail.id;
            matchType = "email";
          }
        }

        // Try phone match if no email match
        if (!patientId && extracted.phone) {
          const { data: patientByPhone } = await supabase
            .from("patients")
            .select("id")
            .or(`mobile.eq.${extracted.phone},phone.eq.${extracted.phone}`)
            .single();
          
          if (patientByPhone) {
            patientId = patientByPhone.id;
            matchType = "phone";
          }
        }

        // Link patient if found
        if (patientId) {
          await supabase
            .from("chat_conversations")
            .update({ patient_id: patientId, patient_match_type: matchType })
            .eq("id", existing.id);
        }
      }
    }
  } catch (e) {
    console.error("Error updating chat log:", e);
  }

  return NextResponse.json(data);
}
