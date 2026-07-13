"use client";

import { useLayoutMode } from "./LayoutModeContext";

export default function ClassicLayoutToggle() {
  const { mode, toggleMode } = useLayoutMode();

  if (mode !== "classic") return null;

  return (
    <button
      type="button"
      onClick={toggleMode}
      className="mt-4 flex w-full items-center gap-2 rounded-xl border border-sky-200/60 bg-gradient-to-r from-sky-50 to-white px-3 py-2.5 text-xs font-medium text-sky-700 shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>Switch to Modern Layout</span>
    </button>
  );
}
