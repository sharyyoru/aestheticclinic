"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLayoutMode } from "../LayoutModeContext";

type Props = {
  onClose: () => void;
};

const NAV_SECTIONS = [
  {
    items: [
      { label: "Dashboard", href: "/" },
      { label: "Patients", href: "/patients" },
      { label: "Agenda", href: "/appointments" },
      { label: "Deals & Pipeline", href: "/deals" },
      { label: "Lead Import", href: "/lead-import" },
      { label: "Financials", href: "/financials" },
      { label: "Invoices", href: "/invoices" },
      { label: "MediData", href: "/medidata" },
      { label: "Services", href: "/services" },
      { label: "Tasks", href: "/tasks" },
      { label: "User Management", href: "/users" },
      { label: "Workflows", href: "/workflows" },
      { label: "AI Agents", href: "/agents" },
      { label: "Marketing", href: "/marketing" },
      { label: "Controllers", href: "/controllers" },
      { label: "Email Reports", href: "/email-reports" },
      { label: "Statistics", href: "/statistics" },
      { label: "Chat with Aliice", href: "/chat" },
      { label: "Client Onboarding", href: "/client-onboarding" },
      { label: "Invoice Linker", href: "/invoice-linker" },
    ],
  },
  {
    items: [
      { label: "Settings", href: "/settings" },
      { label: "Knowledgebase", href: "/knowledgebase" },
    ],
  },
];

export default function LogoDropdown({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { toggleMode, mode } = useLayoutMode();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-700/60 bg-[#1e2433] shadow-2xl shadow-black/40 py-2 z-[100] max-h-[80vh] overflow-y-auto"
    >
      {NAV_SECTIONS.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="my-2 border-t border-slate-700/40" />}
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}

      <div className="my-2 border-t border-slate-700/40" />

      {/* Layout mode toggle */}
      <button
        onClick={() => {
          toggleMode();
          onClose();
        }}
        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
        <span>{mode === "blizzard" ? "Use Classic Layout" : "Use Modern Layout"}</span>
      </button>
    </div>
  );
}
