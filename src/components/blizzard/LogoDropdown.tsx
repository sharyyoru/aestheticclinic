"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutMode } from "../LayoutModeContext";

type Props = {
  onClose: () => void;
};

type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

const NAV_SECTIONS: { items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard", href: "/" },
      { label: "Patients", href: "/patients" },
      { label: "Agenda", href: "/appointments" },
      { label: "Deals & Pipeline", href: "/deals" },
      {
        label: "Lead Import",
        href: "/lead-import",
        children: [
          { label: "CSV Import", href: "/lead-import" },
          { label: "Import History", href: "/lead-import/history" },
          { label: "Meta & Zapier Leads", href: "/lead-import/meta-leads" },
          { label: "Aliice Calls", href: "/lead-import/retell-calls" },
          { label: "Embed Forms", href: "/lead-import/embed-forms" },
        ],
      },
      { label: "Financials", href: "/financials" },
      { label: "Invoices", href: "/invoices" },
      { label: "MediData", href: "/medidata" },
      { label: "Services", href: "/services" },
      { label: "Tasks", href: "/tasks" },
      { label: "User Management", href: "/users" },
      {
        label: "Workflows",
        href: "/workflows",
        children: [
          { label: "Workflows", href: "/workflows" },
          { label: "Templates", href: "/workflows/templates" },
        ],
      },
      { label: "AI Agents", href: "/agents" },
      {
        label: "Marketing",
        href: "/marketing",
        children: [
          { label: "Marketing", href: "/marketing" },
          { label: "New Campaign", href: "/marketing/campaigns" },
        ],
      },
      { label: "Controllers", href: "/controllers" },
      { label: "Email Reports", href: "/email-reports" },
      { label: "Statistics", href: "/statistics" },
      {
        label: "Chat with Aliice",
        href: "/chat",
        children: [
          { label: "Chat with Aliice", href: "/chat" },
          { label: "Chat Logs", href: "/chatlogs" },
        ],
      },
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
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Auto-expand if current route matches a child
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.children && pathname.startsWith(item.href)) {
          initial.add(item.href);
        }
      }
    }
    return initial;
  });

  function toggleExpand(href: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }

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
      className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-700/60 bg-[#1e2433] shadow-2xl shadow-black/40 py-2 z-[100] max-h-[80vh] overflow-y-auto"
    >
      {NAV_SECTIONS.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="my-2 border-t border-slate-700/40" />}
          {section.items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.has(item.href);
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            if (!hasChildren) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "text-white bg-white/5"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => toggleExpand(item.href)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "text-white bg-white/5"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <svg
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="ml-4 border-l border-slate-700/40 pl-2 py-0.5">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`block px-3 py-1.5 text-[13px] transition-colors rounded ${
                            childActive
                              ? "text-sky-400 bg-sky-400/10"
                              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
