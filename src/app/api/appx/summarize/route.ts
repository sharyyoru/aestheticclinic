import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, patientId, changes, messages } = body;

    // Get patient info
    let patientName = "the patient";
    if (patientId) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("first_name, last_name")
        .eq("id", patientId)
        .single();
      
      if (patient) {
        patientName = `${patient.first_name} ${patient.last_name}`;
      }
    }

    // If no changes, return simple message
    if (!changes || changes.length === 0) {
      return NextResponse.json({
        summary: `Session with ${patientName} completed. No changes were made to the patient record.`,
      });
    }

    // Generate AI summary
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const changesText = changes.map((c: { description: string; type: string; entity: string }) => 
      `- ${c.description} (${c.type} ${c.entity})`
    ).join("\n");

    const conversationSummary = messages
      ?.slice(-10)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 100)}`)
      .join("\n") || "";

    const prompt = `Generate a brief professional summary of this patient session for clinic records.

Patient: ${patientName}

Changes Made:
${changesText}

Conversation Overview:
${conversationSummary}

Write a 2-3 sentence summary suitable for medical records. Be factual and concise.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    // Update session with summary
    if (sessionId) {
      await supabaseAdmin
        .from("appx_sessions")
        .update({ summary })
        .eq("id", sessionId);
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarize error:", error);
    
    // Fallback summary
    const body = await req.json().catch(() => ({}));
    const changes = body.changes || [];
    
    return NextResponse.json({
      summary: changes.length > 0
        ? `Session completed with ${changes.length} change(s) made to the patient record.`
        : "Session completed. No changes were made.",
    });
  }
}
