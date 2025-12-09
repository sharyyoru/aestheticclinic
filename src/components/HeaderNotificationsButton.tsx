"use client";

import { useRouter } from "next/navigation";
import { useTasksNotifications } from "@/components/TasksNotificationsContext";

export default function HeaderNotificationsButton() {
  const router = useRouter();
  const { openTasksCount } = useTasksNotifications();

  const count = openTasksCount ?? 0;
  const displayCount = count > 9 ? "9+" : count;
  const hasOpen = count > 0;

  return (
    <button
      type="button"
      onClick={() => router.push("/notifications")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm hover:bg-slate-50"
    >
      <span className="sr-only">Task notifications</span>
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 16v-5a6 6 0 1 0-12 0v5" />
        <path d="M5 16h14" />
        <path d="M10 20h4" />
      </svg>
      {hasOpen ? (
        <span className="absolute -top-0.5 -right-0.5 inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-semibold text-white shadow-sm">
          {displayCount}
        </span>
      ) : null}
    </button>
  );
}
