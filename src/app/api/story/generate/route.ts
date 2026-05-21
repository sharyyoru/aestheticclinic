import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const { childName, theme, customPrompt } = await request.json();

    const themeDescriptions: Record<string, string> = {
      adventure: "an exciting adventure with discoveries and brave moments",
      fantasy: "a magical fantasy world with enchanted creatures and wonder",
      animals: "friendly forest animals who help each other",
      space: "a gentle space journey among friendly stars and planets",
      ocean: "a peaceful underwater adventure with sea friends",
      friendship: "the magic of friendship and kindness",
    };

    const themeDesc = themeDescriptions[theme] || themeDescriptions.fantasy;

    const prompt = `You are a gentle, loving storyteller creating bedtime stories for children. 
Your stories should be:
- Calming and soothing, perfect for bedtime
- About 400-500 words long
- Have a gentle, positive ending that makes children feel safe and sleepy
- Use simple, beautiful language that flows like a lullaby
- Include sensory details (soft moonlight, warm blankets, gentle breezes)
- Never include anything scary, violent, or anxiety-inducing
- End with the character(s) feeling peaceful, safe, and ready to sleep

Write in a warm, tender narrative voice. Include moments of wonder and gentle adventure, 
but always guide the story toward a peaceful, cozy conclusion.

Create a bedtime story for ${childName || "a little dreamer"}.

Theme: ${themeDesc}
${customPrompt ? `Special request: ${customPrompt}` : ""}

Begin the story with a gentle opening and end with the character feeling safe, warm, and sleepy.
Write ONLY the story, no titles or headers.`;

    const result = await model.generateContent(prompt);
    const story = result.response.text();

    return NextResponse.json({ story });
  } catch (error) {
    console.error("Story generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
}
