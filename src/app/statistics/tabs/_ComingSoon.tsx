"use client";

export default function ComingSoon({ name, phase }: { name: string; phase: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="text-sm font-semibold text-slate-700">{name}</div>
      <p className="mt-1 text-xs text-slate-500">
        Coming in phase <span className="font-mono font-medium">{phase}</span>. The data and
        filters are wired up — only the UI remains to be built.
      </p>
    </div>
  );
}
