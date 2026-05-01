"use client";

import type React from "react";

export function chf(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={
        "px-3 py-2 font-semibold text-slate-700 " +
        (align === "right" ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={
        "px-3 py-1.5 text-slate-700 " +
        (align === "right" ? "text-right tabular-nums " : "") +
        (className || "")
      }
    >
      {children}
    </td>
  );
}

export function Kpi({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border px-3 py-2.5 " +
        (highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-base font-semibold " +
          (highlight ? "text-emerald-700" : "text-slate-900")
        }
      >
        {loading ? "…" : value}
      </div>
    </div>
  );
}

export function ExportButton({ href, label = "Export Excel" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {label}
    </a>
  );
}

export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: [T, string][];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {tabs.map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={
            "rounded-md px-2.5 py-1 text-xs font-medium " +
            (active === k
              ? "bg-sky-600 text-white"
              : "text-slate-600 hover:bg-slate-50")
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function buildQS(filters: Record<string, string | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  return p.toString();
}
