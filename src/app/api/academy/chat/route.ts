import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES, getCategoryModules } from "@/app/documentation/content";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * The feature list is derived from the documentation registry rather than
 * hand-written, so the assistant cannot describe features the platform does not
 * have. The previous hardcoded prompt claimed lifecycle stages and data export
 * that do not exist, and the assistant repeated them.
 */
function buildSystemPrompt(): string {
  const areas = CATEGORIES.map((category) => {
    const modules = getCategoryModules(category.id);
    if (modules.length === 0) return null;
    const items = modules.map((m) => `  - ${m.title}: ${m.tagline}`).join("\n");
    return `${category.title} — ${category.description}\n${items}`;
  })
    .filter(Boolean)
    .join("\n\n");

  return `You are the Aliice Academy Assistant, an AI helper for Aliice, a CRM and ERP for Swiss aesthetic medical clinics.
You help staff learn to use the system.

These are the only features Aliice has. Do not describe anything outside this list:

${areas}

Rules:
- If asked about something not in the list above, say it is not a feature of Aliice rather than guessing.
- Be concise and practical, and describe the steps a user would actually take.
- Point users at the matching documentation page (/documentation/<slug>) when useful.
- Never invent button names, menu items or settings.
- Format responses with markdown.`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { response: "I'm currently unavailable. Please try again later or contact support." },
        { status: 200 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Build conversation history
    const chatHistory = history?.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })) || [];

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "You are the Aliice Academy Assistant." }] },
        { role: "model", parts: [{ text: SYSTEM_PROMPT }] },
        ...chatHistory,
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Academy chat error:", error);
    return NextResponse.json(
      { response: "Sorry, I encountered an error. Please try again." },
      { status: 200 }
    );
  }
}
