import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

type ExtractedTask = {
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  assignee: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an image (JPEG, PNG, WebP, or GIF)." },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type;

    // Use gemini-1.5-flash for fast multimodal processing
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const systemInstruction = `You are an expert project manager. Your job is to analyze the provided image of a document, whiteboard, or notes. Extract all actionable items. For each item, generate a concise title, a brief description, and assign a priority (High, Medium, Low). The default assignee for all tasks must be 'Alice'. You must return the output STRICTLY as a JSON array of objects with the keys: title, description, priority, and assignee.`;

    const imagePart = {
      inlineData: {
        data: base64,
        mimeType,
      },
    };

    const prompt = `Analyze this image and extract all actionable tasks. Return a JSON array with the following structure:
[
  {
    "title": "Task title (concise)",
    "description": "Brief description of what needs to be done",
    "priority": "High" | "Medium" | "Low",
    "assignee": "Alice"
  }
]

If no actionable items are found, return an empty array [].`;

    const result = await model.generateContent([systemInstruction, prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    // Clean the response - remove markdown code blocks if present
    const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();

    // Parse JSON safely
    let tasks: ExtractedTask[];
    try {
      tasks = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", cleanedText);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Validate the structure
    if (!Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "Invalid response format from AI" },
        { status: 500 }
      );
    }

    // Validate each task has required fields
    const validTasks = tasks.filter(
      (task) =>
        typeof task.title === "string" &&
        typeof task.description === "string" &&
        ["High", "Medium", "Low"].includes(task.priority) &&
        typeof task.assignee === "string"
    );

    return NextResponse.json({ tasks: validTasks });
  } catch (error) {
    console.error("Error analyzing scan:", error);
    return NextResponse.json(
      { error: "Failed to analyze image. Please try again." },
      { status: 500 }
    );
  }
}
