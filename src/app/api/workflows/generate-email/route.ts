import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const geminiApiKey = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
}

type TemplateVariable = {
  category?: string;
  path: string;
  label?: string;
};

type GenerateEmailRequestBody = {
  description?: string;
  tone?: string;
  variables?: TemplateVariable[];
};

export async function POST(request: Request) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY environment variable" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as GenerateEmailRequestBody;
    const description = (body.description || "").trim();
    const tone = (body.tone || "professional and reassuring").trim();
    const variables = body.variables || [];

    if (!description) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 },
      );
    }

    const variableList =
      variables.length === 0
        ? "None."
        : variables
            .map((v) => {
              const label = v.label || v.path;
              const category = v.category ? `${v.category}: ` : "";
              return `- ${category}{{${v.path}}} — ${label}`;
            })
            .join("\n");

    const systemPrompt =
      "You are an expert medical clinic email copywriter. You generate clear, concise, empathetic emails for patients. Always output strict JSON with keys 'subject' and 'html'.";

    const userPrompt = `
Write a patient-facing email for a medical clinic workflow.

Goal / context:
${description}

Tone: ${tone}.

You can use these template variables (MUST keep the {{variable.path}} syntax exactly when you use them):
${variableList}

Requirements:
- Output STRICT JSON only, no markdown, with shape: {"subject": string, "html": string}.
- The html must be valid HTML for an email body, using <p>, <ul>, <li>, <strong>, <em>, etc.
- When you reference a variable, use it verbatim like {{patient.first_name}}.
- Do not invent new variables that are not in the list above.
- The subject should be short, specific, and appropriate for the email.
`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7 },
    });

    const rawContent = result.response.text() || "";

    let subject = "Clinic update";
    let html = "<p>Thank you for your message.</p>";

    try {
      // Remove markdown code blocks if present
      const cleanedContent = rawContent.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanedContent) as { subject?: string; html?: string };
      if (parsed.subject && parsed.subject.trim().length > 0) {
        subject = parsed.subject.trim();
      }
      if (parsed.html && parsed.html.trim().length > 0) {
        html = parsed.html.trim();
      }
    } catch {
      if (rawContent.trim().length > 0) {
        html = `<p>${rawContent.trim()}</p>`;
      }
    }

    return NextResponse.json({ subject, html });
  } catch (error) {
    console.error("Error generating workflow email via Gemini", error);
    return NextResponse.json(
      { error: "Failed to generate email" },
      { status: 500 },
    );
  }
}
