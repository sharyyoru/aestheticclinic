"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getAcademyExperience } from "@/lib/academy/experiences";
import { supabaseClient } from "@/lib/supabaseClient";

export const ACADEMY_TOUR_SESSION_KEY = "aliice_academy_tour";

type TourSession = {
  slug: string;
  lessonId: string;
  moduleSlug: string;
  step: number;
};

async function recordTourProgress(session: TourSession, completed: boolean) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  const experience = getAcademyExperience(session.slug);
  if (!token || !experience) return;
  await fetch("/api/academy/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: completed ? "tour_completed" : "tour_progress",
      lessonId: session.lessonId,
      step: session.step,
      tourVersion: experience.version,
    }),
  });
}

function readSession(): TourSession | null {
  try {
    const value = sessionStorage.getItem(ACADEMY_TOUR_SESSION_KEY);
    return value ? (JSON.parse(value) as TourSession) : null;
  } catch {
    return null;
  }
}

export default function AcademyTourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [revision, setRevision] = useState(0);

  const updateSession = useCallback((session: TourSession | null) => {
    if (session) sessionStorage.setItem(ACADEMY_TOUR_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(ACADEMY_TOUR_SESSION_KEY);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!readSession()) return;
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const allowed = method === "GET" || method === "HEAD" || url.includes("/api/academy/engagement") || url.includes("/auth/v1/");
      if (!allowed) {
        return new Response(JSON.stringify({ error: "This action is disabled during an Academy tutorial." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname, revision]);

  useEffect(() => {
    const session = readSession();
    if (!session) return;
    const experience = getAcademyExperience(session.slug);
    if (!experience) {
      updateSession(null);
      return;
    }
    if (window.innerWidth < experience.minimumWidth) return;

    const step = experience.steps[session.step];
    if (!step) {
      updateSession(null);
      return;
    }
    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }

    let tour: Driver | null = null;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element) return;

      const finish = async () => {
        const completed = session.step === experience.steps.length - 1;
        if (completed) {
          await recordTourProgress({ ...session, step: experience.steps.length }, true);
          updateSession(null);
          router.push(`/academy/${session.moduleSlug}/${session.slug}`);
          return;
        }
        const next = { ...session, step: session.step + 1 };
        await recordTourProgress(next, false);
        tour?.destroy();
        updateSession(next);
      };

      const previous = () => {
        if (session.step === 0) return;
        const next = { ...session, step: session.step - 1 };
        tour?.destroy();
        updateSession(next);
      };

      const close = () => {
        tour?.destroy();
        updateSession(null);
        router.push(`/academy/${session.moduleSlug}/${session.slug}`);
      };

      tour = driver({
        animate: true,
        allowClose: false,
        showProgress: true,
        overlayOpacity: 0.58,
        stagePadding: 8,
        stageRadius: 10,
        steps: [{
          element,
          popover: {
            title: step.title,
            description: step.description,
            side: step.placement ?? "bottom",
            showButtons: session.step === 0 ? ["next", "close"] : ["previous", "next", "close"],
            nextBtnText: session.step === experience.steps.length - 1 ? "Finish" : "Next",
            onNextClick: () => void finish(),
            onPrevClick: previous,
            onCloseClick: close,
          },
        }],
      });
      tour.drive();
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      tour?.destroy();
    };
  }, [pathname, revision, router, updateSession]);

  return <>{children}</>;
}
