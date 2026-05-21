import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export async function POST(request: NextRequest) {
  try {
    const { text, voice = "nova" } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Validate voice
    const validVoices: Voice[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const selectedVoice: Voice = validVoices.includes(voice as Voice) ? (voice as Voice) : "nova";

    // OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "tts-1-hd", // High quality model
      voice: selectedVoice,
      input: text,
      speed: 0.9, // Slightly slower for bedtime stories
    });

    // Get the audio data as a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Return audio file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      { error: "Failed to generate audio" },
      { status: 500 }
    );
  }
}
