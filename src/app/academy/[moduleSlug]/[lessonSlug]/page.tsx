import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import Link from "next/link";
import LessonContent from "./LessonContent";
import VideoContainer from "../../components/VideoContainer";

export const dynamic = "force-dynamic";

type Lesson = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  video_url: string | null;
  sort_order: number;
  estimated_minutes: number;
};

type Module = {
  id: string;
  slug: string;
  title: string;
};

async function getLessonData(moduleSlug: string, lessonSlug: string) {
  // Get module
  const { data: module } = await supabaseAdmin
    .from("academy_modules")
    .select("id, slug, title")
    .eq("slug", moduleSlug)
    .eq("is_published", true)
    .single();

  if (!module) return null;

  // Get lesson
  const { data: lesson } = await supabaseAdmin
    .from("academy_lessons")
    .select("id, slug, title, content, video_url, sort_order, estimated_minutes")
    .eq("module_id", module.id)
    .eq("slug", lessonSlug)
    .single();

  if (!lesson) return null;

  // Get all lessons for navigation
  const { data: allLessons } = await supabaseAdmin
    .from("academy_lessons")
    .select("id, slug, title, sort_order")
    .eq("module_id", module.id)
    .order("sort_order");

  const lessons = allLessons || [];
  const currentIndex = lessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  return { module, lesson, prevLesson, nextLesson, totalLessons: lessons.length, currentIndex };
}

interface LessonPageProps {
  params: Promise<{ moduleSlug: string; lessonSlug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { moduleSlug, lessonSlug } = await params;
  const result = await getLessonData(moduleSlug, lessonSlug);

  if (!result) {
    notFound();
  }

  const { module, lesson, prevLesson, nextLesson, totalLessons, currentIndex } = result;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/academy" className="hover:text-indigo-600 dark:hover:text-indigo-400">
          Academy
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/academy/${module.slug}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
          {module.title}
        </Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-900 dark:text-white">{lesson.title}</span>
      </div>

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Lesson Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video */}
          <VideoContainer videoUrl={lesson.video_url} title={lesson.title} />

          {/* Lesson Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lesson {currentIndex + 1} of {totalLessons}
                </p>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {lesson.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {lesson.estimated_minutes} min
              </div>
            </div>

            {/* AI-Generated Content */}
            <LessonContent
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              moduleTitle={module.title}
              savedContent={lesson.content}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {prevLesson ? (
              <Link
                href={`/academy/${module.slug}/${prevLesson.slug}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                {prevLesson.title}
              </Link>
            ) : (
              <div />
            )}

            {nextLesson ? (
              <Link
                href={`/academy/${module.slug}/${nextLesson.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow hover:shadow-lg"
              >
                {nextLesson.title}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <Link
                href={`/academy/${module.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-600"
              >
                Complete Module
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Mark Complete */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <LessonCompleteButton lessonId={lesson.id} />
          </div>

          {/* Module Progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Module Progress</h3>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{ width: `${((currentIndex + 1) / totalLessons) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {currentIndex + 1} of {totalLessons} lessons
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
            <div className="mt-3 space-y-2">
              <Link
                href={`/academy/${module.slug}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                View All Lessons
              </Link>
              <Link
                href="/academy"
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                </svg>
                Back to Academy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Client component for mark complete button
import LessonCompleteButton from "./LessonCompleteButton";
