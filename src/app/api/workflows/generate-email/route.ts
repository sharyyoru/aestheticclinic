import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
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
    if (!openai) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable" },
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const rawContent = completion.choices[0]?.message?.content || "";

    let subject = "Clinic update";
    let html = "<p>Thank you for your message.</p>";

    try {
      const parsed = JSON.parse(rawContent) as { subject?: string; html?: string };
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
    console.error("Error generating workflow email via OpenAI", error);
    return NextResponse.json(
      { error: "Failed to generate email" },
      { status: 500 },
    );
  }
}
