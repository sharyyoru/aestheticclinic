import { NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/geminiWithFallback";
import { buildKnowledgeBaseSection } from "@/lib/knowledgeBase";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
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

    const { messages, patientId } = (await request.json()) as {
      messages?: ChatMessage[];
      patientId?: string | null;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Missing messages array" },
        { status: 400 },
      );
    }

    // Sanitize and filter
    const trimmed = messages
      .map((message) => ({
        role: message.role,
        content: message.content?.toString().slice(0, 8000) ?? "",
      }))
      .filter((message) => message.content.trim().length > 0 && message.role !== "system");

    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "Messages must contain non-empty content" },
        { status: 400 },
      );
    }

    let systemInstruction =
      "You are Aliice, an AI assistant embedded inside a medical CRM. You help staff with bookings, post-op documentation, deals/pipelines, workflows, and patient or insurance communication. Always behave as an internal staff-facing tool: be concise, precise, and never invent real patient data. When you draft content that will be sent to or shown to a patient (emails, SMS, WhatsApp messages, document templates, etc.), you MUST use the clinic's CRM template variables instead of hard-coding patient or deal details. Use variables like {{patient.first_name}}, {{patient.last_name}}, {{patient.email}}, {{patient.phone}}, {{deal.title}}, {{deal.pipeline}}, and {{deal.notes}} where appropriate. Do not invent new variable names that are not part of the CRM; if you need a field that does not exist, describe it in natural language instead of creating a fake variable.";

    if (patientId) {
      systemInstruction +=
        "\n\nThis chat has been linked to a specific patient in the clinic's CRM. When staff refer to 'this patient' or 'the patient', assume they mean that linked patient. However, you still must never insert real patient details directly; always refer to them using the CRM template variables like {{patient.first_name}} and {{patient.last_name}} rather than concrete values.";
    }

    // Inject the clinic's AI Knowledge Base so Aliice answers using clinic-specific
    // facts, services, policies, pricing, protocols, and tone of voice.
    const knowledgeBaseSection = await buildKnowledgeBaseSection();
    if (knowledgeBaseSection) {
      systemInstruction += knowledgeBaseSection;
    }

    // Build Gemini-format contents. Gemini requires:
    //  - history starts with a "user" role
    //  - roles alternate (user, model, user, model ...)
    //  - last entry must be "user"
    const mapped = trimmed.map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

    // Drop any leading "model" entries (history must start with user)
    while (mapped.length > 0 && mapped[0].role !== "user") {
      mapped.shift();
    }

    // Collapse consecutive same-role entries (merge their text) to guarantee alternation
    const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
    for (const entry of mapped) {
      const prev = contents[contents.length - 1];
      if (prev && prev.role === entry.role) {
        prev.parts[0].text += "\n\n" + entry.parts[0].text;
      } else {
        contents.push({ role: entry.role, parts: [{ text: entry.parts[0].text }] });
      }
    }

    // Ensure the final entry is a user message; if the last entry is a model message,
    // the client shouldn't have asked for a response, so return an error.
    if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from the user" },
        { status: 400 },
      );
    }

    // Use helper with retry + model fallback (handles 429 / quota exhaustion)
    const result = await generateContentWithFallback({
      apiKey,
      systemInstruction,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 4096,
      },
      contents,
      verbose: true,
    });
    const response = result.response;
    const text = response.text();

    if (!text || !text.trim()) {
      // Surface block reason when possible
      const blockReason =
        response.promptFeedback?.blockReason || "Empty response from Gemini";
      return NextResponse.json(
        { error: `No response from Gemini: ${blockReason}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: {
        role: "assistant",
        content: text,
      },
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/chat] Error:", error);
    const isQuota =
      rawMessage.includes("429") ||
      rawMessage.toLowerCase().includes("quota") ||
      rawMessage.toLowerCase().includes("resource exhausted");
    if (isQuota) {
      return NextResponse.json(
        {
          error:
            "AI is temporarily unavailable due to quota limits across all Gemini models. Please try again in a few minutes. If this persists, upgrade the Gemini API plan or add billing to the Google Cloud project.",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: `Failed to generate chat response: ${rawMessage}` },
      { status: 500 },
    );
  }
}
