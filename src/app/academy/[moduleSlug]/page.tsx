import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import Link from "next/link";
import LessonList from "./LessonList";
import VideoContainer from "../components/VideoContainer";

export const dynamic = "force-dynamic";

type Lesson = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  estimated_minutes: number;
};

type Module = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  video_url: string | null;
  estimated_minutes: number;
};

async function getModuleWithLessons(slug: string) {
  const { data: module } = await supabaseAdmin
    .from("academy_modules")
    .select("id, slug, title, description, icon, video_url, estimated_minutes")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!module) return null;

  const { data: lessons } = await supabaseAdmin
    .from("academy_lessons")
    .select("id, slug, title, sort_order, estimated_minutes")
    .eq("module_id", module.id)
    .order("sort_order");

  return { module, lessons: lessons || [] };
}

interface ModulePageProps {
  params: Promise<{ moduleSlug: string }>;
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { moduleSlug } = await params;
  const result = await getModuleWithLessons(moduleSlug);

  if (!result) {
    notFound();
  }

  const { module, lessons } = result;

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/academy"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Academy
      </Link>

      {/* Module Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Video Container */}
          <div className="lg:w-1/2">
            <VideoContainer videoUrl={module.video_url} title={module.title} />
          </div>

          {/* Module Info */}
          <div className="lg:w-1/2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {module.title}
            </h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              {module.description || "Learn how to use this feature effectively in Aliice."}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {lessons.length} Lessons
              </div>
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {module.estimated_minutes} min
              </div>
            </div>

            {lessons.length > 0 && (
              <Link
                href={`/academy/${module.slug}/${lessons[0].slug}`}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200/50 transition-all hover:shadow-xl hover:shadow-indigo-300/50 dark:shadow-indigo-900/30"
              >
                Start Learning
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Lessons List */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Module Lessons
        </h2>
        <LessonList moduleSlug={module.slug} lessons={lessons} />
      </div>
    </div>
  );
}
