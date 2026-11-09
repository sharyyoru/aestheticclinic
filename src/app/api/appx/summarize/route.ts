import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateContentWithFallback, GeminiBillingError } from "@/lib/geminiWithFallback";

export const runtime = "nodejs";

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

    // Shared helper rather than the SDK directly: this route pinned
    // gemini-2.0-flash, which Google has retired, so it 404'd on every call
    // regardless of the account's credit balance.
    const result = await generateContentWithFallback({
      apiKey: process.env.GEMINI_API_KEY || "",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
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

    // The session must still get a summary, so the fallback text stays — but
    // a depleted AI account is reported alongside it instead of being
    // silently indistinguishable from a successful generic summary.
    const body = await req.json().catch(() => ({}));
    const changes = body.changes || [];

    return NextResponse.json({
      summary: changes.length > 0
        ? `Session completed with ${changes.length} change(s) made to the patient record.`
        : "Session completed. No changes were made.",
      ...(error instanceof GeminiBillingError
        ? { degraded: true, code: error.code, error: error.message }
        : {}),
    });
  }
}
