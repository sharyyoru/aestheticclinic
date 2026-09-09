"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

interface LessonCompleteButtonProps {
  lessonId: string;
}

export default function LessonCompleteButton({ lessonId }: LessonCompleteButtonProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkProgress() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabaseClient
        .from("academy_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .single();

      setIsCompleted(!!data);
      setLoading(false);
    }

    checkProgress();
  }, [lessonId]);

  const toggleComplete = async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    setSaving(true);

    try {
      if (isCompleted) {
        // Remove completion
        await supabaseClient
          .from("academy_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("lesson_id", lessonId);
        setIsCompleted(false);
      } else {
        // Mark as complete
        await supabaseClient
          .from("academy_progress")
          .insert({ user_id: user.id, lesson_id: lessonId });
        setIsCompleted(true);
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleComplete}
      disabled={saving}
      className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
        isCompleted
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
          : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow hover:shadow-lg"
      }`}
    >
      {saving ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : isCompleted ? (
        <>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Completed
        </>
      ) : (
        <>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Mark as Complete
        </>
      )}
    </button>
  );
}
