import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Lesson content is generated from the documentation registry by
 * `npm run academy:sync`, so it is always present and always matches the real
 * system.
 *
 * This route previously held a hardcoded content map plus a Gemini fallback that
 * invented features the platform does not have — two-factor authentication,
 * CSV/Excel export, a "New Patient" button, Lead/Prospect/VIP lifecycle stages.
 * Generating training material that describes a different product is worse than
 * generating none, so that behaviour has been removed rather than improved.
 *
 * It is kept as a thin read so existing clients keep working.
 */
export async function POST(request: Request) {
  try {
    const { lessonId } = await request.json();

    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    const { data: lesson, error } = await supabaseAdmin
      .from("academy_lessons")
      .select("content")
      .eq("id", lessonId)
      .single();

    if (error || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (!lesson.content) {
      return NextResponse.json(
        {
          content:
            '<div class="lesson-content"><p>This lesson has no content yet. ' +
            "Run <code>npm run academy:sync</code> to generate it from the documentation.</p></div>",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ content: lesson.content });
  } catch (error) {
    console.error("[academy] content read failed:", error);
    return NextResponse.json({ error: "Failed to load lesson content" }, { status: 500 });
  }
}
