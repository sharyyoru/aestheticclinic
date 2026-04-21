import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateContentWithFallback } from "@/lib/geminiWithFallback";
import { buildKnowledgeBaseSection } from "@/lib/knowledgeBase";

export const runtime = "nodejs";
export const maxDuration = 60;

type GeneratePatientEmailRequestBody = {
  patientId?: string;
  description?: string;
  tone?: string;
  knowledgebaseTopicIds?: string[]; // Optional: knowledgebase topics to include as context
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as GeneratePatientEmailRequestBody;
    const patientId = body.patientId?.trim();
    const description = (body.description || "").trim();
    const tone = (body.tone || "professional and reassuring").trim();
    const knowledgebaseTopicIds = body.knowledgebaseTopicIds || [];

    if (!patientId || !description) {
      return NextResponse.json(
        { error: "patientId and description are required" },
        { status: 400 },
      );
    }

    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email, phone")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message ?? "Patient not found" },
        { status: 404 },
      );
    }

    const firstName = (patient.first_name as string | null) ?? "";
    const lastName = (patient.last_name as string | null) ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const email = (patient.email as string | null) ?? null;
    const phone = (patient.phone as string | null) ?? null;

    const patientSummaryLines: string[] = [];
    if (fullName) patientSummaryLines.push(`Name: ${fullName}`);
    if (email) patientSummaryLines.push(`Email: ${email}`);
    if (phone) patientSummaryLines.push(`Phone: ${phone}`);

    const patientSummary =
      patientSummaryLines.length > 0
        ? patientSummaryLines.join("\n")
        : "Basic identity and contact details are not available.";

    // Always inject the AI Knowledge Base. If specific topic IDs are passed,
    // scope to those; otherwise include ALL active topics so the AI draws on
    // every clinic-specific note, procedure, and policy we've captured.
    const knowledgeBaseSection = await buildKnowledgeBaseSection(
      knowledgebaseTopicIds.length > 0
        ? { topicIds: knowledgebaseTopicIds }
        : {},
    );

    const systemPrompt =
      "You are an email assistant for Aesthetics Clinic. You write concise, empathetic, medically appropriate emails to a single patient. Always output strict JSON with keys 'subject' and 'body' (plain text, no HTML). All prices must be in CHF (Swiss Francs), not any other currency. When the clinic's AI Knowledge Base is provided, treat it as the PRIMARY source of truth for clinic-specific facts, services, policies, pricing guidance, and tone of voice.";

    const userPrompt = `
We are composing a one-off email to this specific patient.

Patient details:
${patientSummary}

Goal / context for the email:
${description}

Tone: ${tone}.
${knowledgeBaseSection}
Requirements:
- Output STRICT JSON only, no markdown, with shape: {"subject": string, "body": string}.
- 'body' must be plain text suitable for pasting into an email textarea; use paragraphs separated by blank lines.
- Start with a natural greeting to the patient (for example, "Dear ${firstName || "patient"},").
- All prices must be in CHF (Swiss Francs).
- After the main content, include this contact footer:

---
Main Telephone Number: +41 22 732 22 23
Main Email Address: info@aesthetics-ge.ch
Book an appointment: https://aestheticclinic.vercel.app/book-appointment/location
`;

    const result = await generateContentWithFallback({
      apiKey,
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      verbose: true,
    });

    const rawContent = result.response.text() || "";

    let subject = "Clinic update";
    let bodyText = "Dear patient,\n\nThank you for your message.";

    try {
      // Remove markdown code blocks if present
      const cleanedContent = rawContent.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanedContent) as {
        subject?: string;
        body?: string;
      };

      if (parsed.subject && parsed.subject.trim().length > 0) {
        subject = parsed.subject.trim();
      }

      if (parsed.body && parsed.body.trim().length > 0) {
        bodyText = parsed.body.trim();
      }
    } catch {
      if (rawContent.trim().length > 0) {
        bodyText = rawContent.trim();
      }
    }

    return NextResponse.json({ subject, body: bodyText });
  } catch (error) {
    console.error("Error generating patient email via Gemini", error);
    return NextResponse.json(
      { error: "Failed to generate email" },
      { status: 500 },
    );
  }
}
