"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACADEMY_TOUR_SESSION_KEY } from "@/components/academy-tour/AcademyTourProvider";
import { getAcademyExperience } from "@/lib/academy/experiences";
import { getAcademyEngagement } from "@/lib/academy/engagementClient";

export default function LessonExperienceControls({ lessonId, lessonSlug, moduleSlug }: { lessonId: string; lessonSlug: string; moduleSlug: string }) {
  const router = useRouter();
  const experience = getAcademyExperience(lessonSlug);
  const [tourStep, setTourStep] = useState(0);
  const [tooNarrow, setTooNarrow] = useState(false);

  useEffect(() => {
    if (!experience) return;
    setTooNarrow(window.innerWidth < experience.minimumWidth);
    void getAcademyEngagement(lessonId).then((engagement) => {
      if (engagement?.tour_version === experience.version && engagement?.tour_status === "in_progress") {
        setTourStep(Math.min(engagement.tour_step ?? 0, experience.steps.length - 1));
      }
    });
  }, [experience, lessonId]);

  if (!experience) return null;

  const launch = (step: number) => {
    sessionStorage.setItem(ACADEMY_TOUR_SESSION_KEY, JSON.stringify({ slug: lessonSlug, lessonId, moduleSlug, step }));
    router.push(experience.steps[step]?.route ?? experience.steps[0].route);
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Interactive tutorial</h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        Follow a safe guided walkthrough in the real interface. Data-changing actions stay disabled.
      </p>
      {tooNarrow ? (
        <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">Open this lesson on a tablet or desktop to use the interactive tutorial.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => launch(tourStep)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
            {tourStep > 0 ? "Resume tutorial" : "Start tutorial"}
          </button>
          {tourStep > 0 && (
            <button type="button" onClick={() => launch(0)} className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-slate-900 dark:text-indigo-300">
              Restart
            </button>
          )}
        </div>
      )}
    </div>
  );
}
