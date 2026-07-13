"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FAVORITES = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M5 10.5V20h4v-5h6v5h4v-9.5" />
      </svg>
    ),
  },
  {
    label: "Patients",
    href: "/patients",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path d="M4 20a6 6 0 0 1 8-5.29A6 6 0 0 1 20 20" />
      </svg>
    ),
  },
  {
    label: "Agenda",
    href: "/appointments",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    label: "Deals",
    href: "/deals",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h4v12H3zM10 10h4v8h-4zM17 8h4v10h-4z" />
      </svg>
    ),
  },
  {
    label: "Financials",
    href: "/financials",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h4M7 14h2" />
      </svg>
    ),
  },
];

export default function FavoritesBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex items-center gap-3 border-b border-slate-700/40 bg-[#1a1f2e] px-4 py-2">
      <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mr-2">
        Favorites
      </span>
      <div className="flex items-center gap-2">
        {FAVORITES.map((fav) => (
          <Link
            key={fav.href}
            href={fav.href}
            title={fav.label}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
              isActive(fav.href)
                ? "border-sky-400/60 bg-sky-500/10 text-sky-400"
                : "border-slate-600/40 text-slate-400 hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300 hover:shadow-[0_0_12px_rgba(56,189,248,0.15)] hover:scale-105 transition-all duration-200"
            }`}
          >
            {fav.icon}
          </Link>
        ))}
        {/* Search button */}
        <Link
          href="/search"
          title="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/40 text-slate-400 hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-300 hover:shadow-[0_0_12px_rgba(56,189,248,0.15)] hover:scale-105 transition-all duration-200"
        >
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </Link>
        {/* Placeholder add button */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-slate-600/40 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors"
          title="Add favorite"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
