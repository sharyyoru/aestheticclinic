"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { CornerDownLeft, Loader2, Search, X } from "lucide-react";
import type { DocSearchEntry } from "../content/types";

function shortcutLabel() {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘ K" : "Ctrl K";
}

export default function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<DocSearchEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async () => {
    if (entries || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/documentation/search-index");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, [entries, loading]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadEntries();
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open, loadEntries]);

  const fuse = useMemo(() => {
    if (!entries) return null;
    return new Fuse(entries, {
      includeScore: true,
      threshold: 0.38,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: "heading", weight: 0.4 },
        { name: "moduleTitle", weight: 0.25 },
        { name: "keywords", weight: 0.2 },
        { name: "body", weight: 0.15 },
      ],
    });
  }, [entries]);

  const results = useMemo(() => {
    if (!fuse || query.trim().length < 2) return [];
    return fuse.search(query.trim(), { limit: 12 }).map((r) => r.item);
  }, [fuse, query]);

  useEffect(() => setActiveIndex(0), [query]);

  function hrefFor(entry: DocSearchEntry) {
    return entry.sectionId
      ? `/documentation/${entry.moduleSlug}#${entry.sectionId}`
      : `/documentation/${entry.moduleSlug}`;
  }

  function go(entry: DocSearchEntry) {
    setOpen(false);
    setQuery("");
    router.push(hrefFor(entry));
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-500 sm:w-64"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1 text-left">Search the docs</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
          {shortcutLabel()}
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[10vh]">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search modules, features and how-tos…"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {query.trim().length < 2 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  Type at least two characters to search.
                </p>
              )}
              {query.trim().length >= 2 && results.length === 0 && !loading && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  No results for “{query.trim()}”.
                </p>
              )}
              {results.map((entry, index) => (
                <button
                  key={`${entry.moduleSlug}-${entry.sectionId ?? "root"}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(entry)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                    index === activeIndex ? "bg-sky-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{entry.heading}</p>
                    <p className="truncate text-xs text-slate-400">
                      {entry.categoryTitle} › {entry.moduleTitle}
                    </p>
                  </div>
                  {index === activeIndex && (
                    <CornerDownLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
