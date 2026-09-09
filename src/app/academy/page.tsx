import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";
import AcademyProgressSummary from "./components/AcademyProgressSummary";
import ModuleCard from "./components/ModuleCard";
import AiChatButton from "./components/AiChatButton";

export const dynamic = "force-dynamic";

type Module = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  estimated_minutes: number;
  lesson_count: number;
};

async function getModulesWithLessonCount(): Promise<Module[]> {
  const { data: modules } = await supabaseAdmin
    .from("academy_modules")
    .select("id, slug, title, description, icon, sort_order, estimated_minutes")
    .eq("is_published", true)
    .order("sort_order");

  if (!modules) return [];

  // Get lesson counts for each module
  const modulesWithCounts = await Promise.all(
    modules.map(async (mod) => {
      const { count } = await supabaseAdmin
        .from("academy_lessons")
        .select("*", { count: "exact", head: true })
        .eq("module_id", mod.id);
      return { ...mod, lesson_count: count || 0 };
    })
  );

  return modulesWithCounts;
}

export default async function AcademyPage() {
  const modules = await getModulesWithLessonCount();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-12 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold">Aliice Academy</h1>
          </div>
          <p className="max-w-2xl text-lg text-white/80">
            Master every feature of Aliice with our comprehensive training modules. 
            Learn at your own pace with AI-powered guidance and video tutorials.
          </p>
          
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {modules.length} Modules
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {modules.reduce((acc, m) => acc + m.estimated_minutes, 0)} min total
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI-Powered
            </div>
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="mt-8">
        <AcademyProgressSummary modules={modules} />
      </div>

      {/* Modules Grid */}
      <div className="mt-8">
        <h2 className="mb-6 text-xl font-semibold text-slate-900 dark:text-white">
          Training Modules
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </div>

      {/* AI Chat Button */}
      <AiChatButton />
    </div>
  );
}
