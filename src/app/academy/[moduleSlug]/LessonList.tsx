"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type Lesson = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  estimated_minutes: number;
};

interface LessonListProps {
  moduleSlug: string;
  lessons: Lesson[];
}

export default function LessonList({ moduleSlug, lessons }: LessonListProps) {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchProgress() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return;

      const { data } = await supabaseClient
        .from("academy_progress")
        .select("lesson_id")
        .eq("user_id", user.id);

      if (data) {
        setCompletedLessons(new Set(data.map((p) => p.lesson_id)));
      }
    }

    fetchProgress();
  }, []);

  return (
    <div className="space-y-2">
      {lessons.map((lesson, index) => {
        const isCompleted = completedLessons.has(lesson.id);

        return (
          <Link
            key={lesson.id}
            href={`/academy/${moduleSlug}/${lesson.slug}`}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600"
          >
            {/* Lesson Number / Checkmark */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                isCompleted
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              {isCompleted ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                index + 1
              )}
            </div>

            {/* Lesson Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                {lesson.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {lesson.estimated_minutes} min
              </p>
            </div>

            {/* Arrow */}
            <svg
              className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}
