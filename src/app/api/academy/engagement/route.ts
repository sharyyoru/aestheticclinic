import { NextResponse } from "next/server";
import { getAcademyUser } from "@/lib/academyAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type EngagementEvent =
  | { type: "video_progress"; lessonId: string; percent: number; seconds: number }
  | { type: "tour_progress"; lessonId: string; step: number; tourVersion: number }
  | { type: "tour_completed"; lessonId: string; step: number; tourVersion: number }
  | { type: "manual_complete"; lessonId: string };

export async function GET(request: Request) {
  const user = await getAcademyUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessonId = new URL(request.url).searchParams.get("lessonId");
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("academy_lesson_engagement")
    .select("video_percent, video_seconds, tour_step, tour_version, tour_status, completion_source, completed_at")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ engagement: data });
}

export async function POST(request: Request) {
  const user = await getAcademyUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = (await request.json()) as EngagementEvent;
  if (!event?.lessonId || !event.type) {
    return NextResponse.json({ error: "Invalid engagement event" }, { status: 400 });
  }

  const { data: lesson } = await supabaseAdmin
    .from("academy_lessons")
    .select("id, tour_version")
    .eq("id", event.lessonId)
    .maybeSingle();
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const { data: current } = await supabaseAdmin
    .from("academy_lesson_engagement")
    .select("video_percent, video_seconds, tour_step, tour_version, tour_status, completion_source, completed_at")
    .eq("user_id", user.id)
    .eq("lesson_id", event.lessonId)
    .maybeSingle();

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    user_id: user.id,
    lesson_id: event.lessonId,
    last_activity_at: now,
    updated_at: now,
  };
  let completionSource: "video" | "tour" | "manual_accessibility" | null = null;

  if (event.type === "video_progress") {
    const percent = Math.min(100, Math.max(0, Number(event.percent) || 0));
    const seconds = Math.max(0, Math.round(Number(event.seconds) || 0));
    update.video_percent = Math.max(Number(current?.video_percent ?? 0), percent);
    update.video_seconds = Math.max(current?.video_seconds ?? 0, seconds);
    if (Number(update.video_percent) >= 80) completionSource = "video";
  }

  if (event.type === "tour_progress" || event.type === "tour_completed") {
    if (event.tourVersion !== lesson.tour_version) {
      return NextResponse.json({ error: "Tour version is no longer current" }, { status: 409 });
    }
    update.tour_step = Math.max(current?.tour_step ?? 0, Math.max(0, Math.round(event.step)));
    update.tour_version = event.tourVersion;
    update.tour_status = event.type === "tour_completed" ? "completed" : "in_progress";
    if (event.type === "tour_completed") {
      update.tour_completed_at = now;
      completionSource = "tour";
    }
  }

  if (event.type === "manual_complete") completionSource = "manual_accessibility";

  if (completionSource && !current?.completed_at) {
    update.completion_source = completionSource;
    update.completed_at = now;
  }

  const { data: engagement, error } = await supabaseAdmin
    .from("academy_lesson_engagement")
    .upsert(update, { onConflict: "user_id,lesson_id" })
    .select("video_percent, video_seconds, tour_step, tour_version, tour_status, completion_source, completed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (engagement.completed_at) {
    await supabaseAdmin
      .from("academy_progress")
      .upsert({ user_id: user.id, lesson_id: event.lessonId, completed_at: engagement.completed_at }, { onConflict: "user_id,lesson_id" });
  }

  return NextResponse.json({ engagement });
}
