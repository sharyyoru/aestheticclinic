"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DocIcon } from "./icons";

export type DocsNavGroup = {
  id: string;
  title: string;
  icon: string;
  modules: { slug: string; title: string }[];
};

export default function DocsSidebar({ groups }: { groups: DocsNavGroup[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const nav = (
    <nav className="space-y-6 pb-10">
      <Link
        href="/documentation"
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
          pathname === "/documentation"
            ? "bg-sky-50 text-sky-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        Documentation home
      </Link>

      {groups.map((group) => (
        <div key={group.id}>
          <p className="flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <DocIcon name={group.icon} className="h-3.5 w-3.5" />
            {group.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.modules.map((module) => {
              const href = `/documentation/${module.slug}`;
              const active = pathname === href;
              return (
                <li key={module.slug}>
                  <Link
                    href={href}
                    className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                      active
                        ? "bg-sky-50 font-medium text-sky-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {module.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="sticky top-[57px] z-30 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          Browse documentation
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[190] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-xs overflow-y-auto border-r border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Documentation</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 lg:block">
        <div className="sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto px-3 py-8">{nav}</div>
      </aside>
    </>
  );
}
