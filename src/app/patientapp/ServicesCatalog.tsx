"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, CalendarPlus, Search } from "lucide-react";
import {
  CLINIC_SERVICES,
  CLINIC_SERVICE_CATEGORIES,
  type ClinicService,
} from "@/data/clinicServices";

type Props = {
  onClose: () => void;
  onBook?: () => void;
};

const CATEGORY_ACCENT: Record<string, string> = {
  Surgery: "bg-rose-50 text-rose-600",
  Injections: "bg-sky-50 text-sky-600",
  "Longevity Medicine": "bg-emerald-50 text-emerald-600",
  Treatments: "bg-violet-50 text-violet-600",
};

export default function ServicesCatalog({ onClose, onBook }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CLINIC_SERVICES.filter((svc) => {
      const matchesCat =
        activeCategory === "All" || svc.categories.includes(activeCategory);
      const matchesQuery =
        !q ||
        svc.name.toLowerCase().includes(q) ||
        (svc.description?.toLowerCase().includes(q) ?? false);
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ClinicService[]>();
    for (const cat of CLINIC_SERVICE_CATEGORIES) map.set(cat, []);
    for (const svc of filtered) {
      // Place each service under every category it belongs to.
      for (const cat of svc.categories) {
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(svc);
      }
    }
    return [...map.entries()].filter(([, items]) => items.length > 0);
  }, [filtered]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Safe area top */}
      <div className="bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }} />

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Services & Treatments</h1>
          <p className="text-xs text-slate-500">Explore everything we offer</p>
        </div>
      </header>

      {/* Search + category chips */}
      <div className="bg-white border-b border-slate-100 px-4 pb-3 pt-1 flex-shrink-0 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search treatments"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5 no-scrollbar">
          {["All", ...CLINIC_SERVICE_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-sky-500 text-white shadow-sm shadow-sky-500/25"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-6">
        {grouped.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <p className="text-sm text-slate-400">No treatments match your search.</p>
          </div>
        ) : (
          grouped.map(([category, items]) => (
            <section key={category}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-semibold text-slate-900">{category}</h2>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    CATEGORY_ACCENT[category] || "bg-slate-100 text-slate-500"
                  }`}
                >
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((svc) => (
                  <ServiceCard key={`${category}-${svc.slug}`} service={svc} onBook={onBook} />
                ))}
              </div>
            </section>
          ))
        )}
        <div className="h-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      </main>
    </div>
  );
}

function ServiceCard({ service, onBook }: { service: ClinicService; onBook?: () => void }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
      {service.image && (
        <div className="aspect-[16/10] bg-slate-100 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={service.image}
            alt={service.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900">{service.name}</h3>
        {service.description && (
          <p className="text-sm text-slate-500 mt-1 leading-relaxed line-clamp-3">
            {service.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-3">
          {onBook && (
            <button
              onClick={onBook}
              className="flex-1 py-2.5 bg-sky-500 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 active:bg-sky-600"
            >
              <CalendarPlus className="w-4 h-4" /> Book
            </button>
          )}
          <a
            href={service.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium text-sm flex items-center justify-center gap-1.5 active:bg-slate-200"
          >
            Learn more <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
