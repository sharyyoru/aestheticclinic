"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

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

type ProgressData = {
  completedLessons: number;
  totalLessons: number;
  completedModules: number;
  certificates: number;
};

export default function AcademyProgressSummary({ modules }: { modules: Module[] }) {
  const [progress, setProgress] = useState<ProgressData>({
    completedLessons: 0,
    totalLessons: 0,
    completedModules: 0,
    certificates: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get total lessons count
        const { count: totalLessons } = await supabaseClient
          .from("academy_lessons")
          .select("*", { count: "exact", head: true });

        // Get completed lessons count
        const { count: completedLessons } = await supabaseClient
          .from("academy_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        // Get certificates count
        const { count: certificates } = await supabaseClient
          .from("academy_certificates")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        setProgress({
          completedLessons: completedLessons || 0,
          totalLessons: totalLessons || 0,
          completedModules: certificates || 0,
          certificates: certificates || 0,
        });
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, []);

  const progressPercent = progress.totalLessons > 0 
    ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
    : 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="animate-pulse flex items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Circular Progress */}
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-24 w-24 -rotate-90 transform">
            <circle
              cx="48"
              cy="48"
              r="42"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-200 dark:text-slate-700"
            />
            <circle
              cx="48"
              cy="48"
              r="42"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={264}
              strokeDashoffset={264 - (264 * progressPercent) / 100}
              className="text-indigo-500 transition-all duration-500"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{progressPercent}%</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Complete</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your Progress</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Keep learning to unlock certificates and master Aliice!
          </p>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {progress.completedLessons}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Lessons Done</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {progress.completedModules}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Modules Complete</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {progress.certificates}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Certificates</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full sm:hidden mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center">
            {progress.completedLessons} of {progress.totalLessons} lessons completed
          </p>
        </div>
      </div>
    </div>
  );
}
