"use client";

import { useEffect, useState } from "react";

interface LessonContentProps {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  savedContent: string | null;
}

export default function LessonContent({
  lessonId,
  lessonTitle,
  moduleTitle,
  savedContent,
}: LessonContentProps) {
  const [content, setContent] = useState<string | null>(savedContent);
  const [loading, setLoading] = useState(!savedContent);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (savedContent) return;

    async function generateContent() {
      try {
        const response = await fetch("/api/academy/generate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, lessonTitle, moduleTitle }),
        });

        if (!response.ok) throw new Error("Failed to generate content");

        const data = await response.json();
        setContent(data.content);
      } catch (err) {
        setError("Failed to load lesson content. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    generateContent();
  }, [lessonId, lessonTitle, moduleTitle, savedContent]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Generating lesson content with AI...
          </span>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:text-slate-900 dark:prose-headings:text-white prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-li:text-slate-600 dark:prose-li:text-slate-300 prose-strong:text-slate-900 dark:prose-strong:text-white">
      <div dangerouslySetInnerHTML={{ __html: content || "" }} />
    </div>
  );
}
