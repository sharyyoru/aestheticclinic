import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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

    const systemPrompt = `You are a gentle, loving storyteller creating bedtime stories for children. 
Your stories should be:
- Calming and soothing, perfect for bedtime
- About 400-500 words long
- Have a gentle, positive ending that makes children feel safe and sleepy
- Use simple, beautiful language that flows like a lullaby
- Include sensory details (soft moonlight, warm blankets, gentle breezes)
- Never include anything scary, violent, or anxiety-inducing
- End with the character(s) feeling peaceful, safe, and ready to sleep

Write in a warm, tender narrative voice. Include moments of wonder and gentle adventure, 
but always guide the story toward a peaceful, cozy conclusion.`;

    const userPrompt = `Create a bedtime story for ${childName || "a little dreamer"}.

Theme: ${themeDesc}
${customPrompt ? `Special request: ${customPrompt}` : ""}

Begin the story with a gentle opening and end with the character feeling safe, warm, and sleepy.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const story = completion.choices[0]?.message?.content || "";

    return NextResponse.json({ story });
  } catch (error) {
    console.error("Story generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
}
