import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `You are the Aliice Academy Assistant, an AI helper for a medical CRM system called Aliice. 
You help users learn how to use the system effectively.

Aliice is a comprehensive CRM/ERP system for Swiss aesthetic medical clinics with these key features:
- Patient Management: Create, search, and manage patient records with lifecycle stages
- Appointments & Agenda: Schedule and manage appointments with calendar views
- Deals & Pipeline: Kanban-style deal tracking and conversion management
- Medical Consultations: Document consultations, treatments, and medical history
- Swiss Medical Billing: TarDoc codes, SUMEX invoices, Swiss QR bills, insurance billing, Medidata integration
- Documents: DOCX templates, PDF generation, file storage
- Communication: Email (Mailgun), WhatsApp (Twilio), workflow automation
- AI Features: AI email generation, chat assistance, knowledgebase
- Marketing: Lead import, Meta/Facebook integration, campaign tracking
- Statistics: Financial reports, patient analytics, data export
- Settings: User management, services configuration, integrations

Be helpful, concise, and focus on practical guidance. If you don't know something specific, say so.
Format your responses with markdown for better readability.`;

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
