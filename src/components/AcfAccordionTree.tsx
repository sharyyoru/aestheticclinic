"use client";

import { useState, useCallback } from "react";
import { formatChf } from "@/lib/tardoc";

type AcfChapter = { code: string; name: string; count: number };

type AcfTreeNode = {
  code: string;
  name: string;
  count: number;
  expanded: boolean;
  loading: boolean;
  services: any[] | null;
};

export type AcfServiceWithVariables = {
  code: string;
  name: string;
  tp: number;
  chapterCode?: string;
  chapterName?: string;
  sideType: number;
  externalFactor: number;
  refCode: string;
};

type AcfAccordionTreeProps = {
  onAddService: (svc: AcfServiceWithVariables) => void;
};

const SIDE_LABELS: Record<number, string> = {
  0: "None",
  1: "Left",
  2: "Right",
  3: "Both (bilateral)",
};

export default function AcfAccordionTree({ onAddService }: AcfAccordionTreeProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Map<string, AcfTreeNode>>(new Map());
  const [chapterCodes, setChapterCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Staging: selected service before adding to invoice
  const [staged, setStaged] = useState<any | null>(null);
  const [stageSide, setStageSide] = useState(0);
  const [stageExtFactor, setStageExtFactor] = useState("1.0");
  const [stageRefCode, setStageRefCode] = useState("");

  const loadChapters = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/acf/sumex?action=chapters");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const chapters: AcfChapter[] = json.data;
        const nodeMap = new Map<string, AcfTreeNode>();
        const codes: string[] = [];
        for (const ch of chapters) {
          // Skip chapters with empty code or name (catch-all/uncategorized)
          if (!ch.code || !ch.name) continue;
          codes.push(ch.code);
          nodeMap.set(ch.code, {
            code: ch.code, name: ch.name, count: ch.count,
            expanded: false, loading: false, services: null,
          });
        }
        setNodes(nodeMap);
        setChapterCodes(codes);
        setLoaded(true);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [loaded, loading]);

  const toggleNode = useCallback(async (code: string) => {
    const node = nodes.get(code);
    if (!node) return;
    setNodes((prev) => {
      const next = new Map(prev);
      next.set(code, { ...next.get(code)!, expanded: !next.get(code)!.expanded });
      return next;
    });
    if (node.expanded) return;
    if (node.services === null) {
      setNodes((prev) => {
        const next = new Map(prev);
        next.set(code, { ...next.get(code)!, loading: true });
        return next;
      });
      try {
        const res = await fetch(`/api/acf/sumex?action=searchCode&code=*&chapter=${encodeURIComponent(code)}`);
        const json = await res.json();
        const services = json.success ? json.data?.services || [] : [];
        setNodes((prev) => {
          const next = new Map(prev);
          next.set(code, { ...next.get(code)!, loading: false, services });
          return next;
        });
      } catch {
        setNodes((prev) => {
          const next = new Map(prev);
          next.set(code, { ...next.get(code)!, loading: false, services: [] });
          return next;
        });
      }
    }
  }, [nodes]);

  const doSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    setSearchLoading(true);
    try {
      const isCode = /^[A-Z0-9.*]+$/i.test(q);
      const codeParam = isCode ? q : "*";
      const nameParam = isCode ? "" : q;
      const res = await fetch(
        `/api/acf/sumex?action=searchCode&code=${encodeURIComponent(codeParam)}&name=${encodeURIComponent(nameParam)}`,
      );
      const json = await res.json();
      setSearchResults(json.success ? json.data?.services || [] : []);
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  }, [searchQuery]);

  const handleSelectService = useCallback((svc: any) => {
    setStaged(svc);
    setStageSide(0);
    setStageExtFactor("1.0");
    setStageRefCode("");
  }, []);

  const handleConfirmAdd = useCallback(() => {
    if (!staged) return;
    const ef = parseFloat(stageExtFactor) || 1.0;
    onAddService({
      code: staged.code,
      name: staged.name,
      tp: staged.tp,
      chapterCode: staged.chapterCode,
      chapterName: staged.chapterName,
      sideType: stageSide,
      externalFactor: ef,
      refCode: stageRefCode.trim(),
    });
    setStaged(null);
  }, [staged, stageSide, stageExtFactor, stageRefCode, onAddService]);

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={loadChapters}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-[11px] font-medium text-slate-700 shadow-sm transition-all hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md active:scale-[0.98]"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading ACF catalog...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Browse ACF Catalog
          </div>
        )}
      </button>
    );
  }

  // Computed preview price for staging
  const stagedPreviewPrice = staged
    ? staged.tp * (parseFloat(stageExtFactor) || 1.0)
    : 0;

  return (
    <div className="space-y-2">
      {/* Staging panel — pricing variables for selected service */}
      {staged && (
        <div className="rounded-lg border-2 border-violet-300 bg-violet-50/60 p-2 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-mono text-[10px] font-bold text-violet-800">{staged.code}</span>
              <span className="ml-1 text-[10px] text-violet-700">{staged.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setStaged(null)}
              className="shrink-0 text-[9px] text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {/* Side type */}
            <div>
              <label className="block text-[8px] font-semibold text-slate-500 uppercase tracking-wide">Side</label>
              <select
                value={stageSide}
                onChange={(e) => setStageSide(Number(e.target.value))}
                className="mt-0.5 block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                <option value={0}>None</option>
                <option value={1}>Left</option>
                <option value={2}>Right</option>
                <option value={3}>Both (bilateral)</option>
              </select>
            </div>

            {/* External factor */}
            <div>
              <label className="block text-[8px] font-semibold text-slate-500 uppercase tracking-wide">Factor</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={stageExtFactor}
                onChange={(e) => setStageExtFactor(e.target.value)}
                className="mt-0.5 block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>

            {/* ICD-10 ref code */}
            <div>
              <label className="block text-[8px] font-semibold text-slate-500 uppercase tracking-wide">ICD-10</label>
              <input
                type="text"
                placeholder="e.g. L98.4"
                value={stageRefCode}
                onChange={(e) => setStageRefCode(e.target.value)}
                className="mt-0.5 block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
          </div>

          {/* Price preview + Add button */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="text-[9px] text-slate-600">
              <span className="font-medium">Base:</span> {formatChf(staged.tp)}
              {parseFloat(stageExtFactor) !== 1.0 && (
                <span className="ml-1">
                  <span className="text-slate-400">x</span> {stageExtFactor}
                  <span className="ml-1 text-slate-400">=</span>
                  <span className="ml-1 font-bold text-violet-700">{formatChf(stagedPreviewPrice)}</span>
                </span>
              )}
              {stageSide > 0 && (
                <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[8px] font-medium text-amber-700">
                  {SIDE_LABELS[stageSide]}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleConfirmAdd}
              className="rounded-md bg-violet-600 px-3 py-1 text-[10px] font-medium text-white shadow-sm hover:bg-violet-700 active:scale-95"
            >
              Add to Invoice
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="Search code or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }}
          className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="button"
          disabled={searchLoading}
          onClick={doSearch}
          className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-2 py-1.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
        >
          {searchLoading ? "..." : "Search"}
        </button>
        {searchResults !== null && (
          <button
            type="button"
            onClick={() => { setSearchResults(null); setSearchQuery(""); }}
            className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search results overlay */}
      {searchResults !== null ? (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white text-[10px]">
          <div className="sticky top-0 z-10 grid grid-cols-[24px_minmax(0,1fr)_64px] items-center gap-0 border-b border-slate-300 bg-slate-100 px-1 py-1 text-[9px] font-bold text-slate-500">
            <span />
            <span className="px-1">PROCEDURE ({searchResults.length})</span>
            <span className="px-1 text-right">CHF</span>
          </div>
          {searchResults.length === 0 ? (
            <div className="py-3 text-center text-[10px] text-slate-400">
              {searchLoading ? "Searching..." : "No results found."}
            </div>
          ) : (
            searchResults.map((svc: any, idx: number) => (
              <ServiceRow key={svc.code || `search-${idx}`} svc={svc} onSelect={handleSelectService} selectedCode={staged?.code} />
            ))
          )}
        </div>
      ) : (
        /* Chapter accordion tree */
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white text-[10px]">
          <div className="sticky top-0 z-10 grid grid-cols-[24px_minmax(0,1fr)_48px_64px] items-center gap-0 border-b border-slate-300 bg-slate-100 px-1 py-1 text-[9px] font-bold text-slate-500">
            <span />
            <span className="px-1">CHAPTER / CODE</span>
            <span className="px-1 text-right">COUNT</span>
            <span className="px-1 text-right">CHF</span>
          </div>
          {chapterCodes.map((code) => (
            <ChapterRow
              key={code}
              code={code}
              nodes={nodes}
              onToggle={toggleNode}
              onSelect={handleSelectService}
              selectedCode={staged?.code}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chapter row ─────────────────────────────────────────────────────────────

function ChapterRow({
  code, nodes, onToggle, onSelect, selectedCode,
}: {
  code: string;
  nodes: Map<string, AcfTreeNode>;
  onToggle: (code: string) => void;
  onSelect: (svc: any) => void;
  selectedCode?: string;
}) {
  const node = nodes.get(code);
  if (!node) return null;

  return (
    <>
      <div
        className="grid grid-cols-[24px_minmax(0,1fr)_48px_64px] items-center gap-0 border-b border-slate-100 bg-slate-50/60 px-1 py-1 hover:bg-violet-50/40 cursor-pointer"
        onClick={() => onToggle(code)}
      >
        <span className="flex h-4 w-4 items-center justify-center text-slate-400">
          {node.loading ? (
            <svg className="h-3 w-3 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : node.expanded ? (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </span>
        <span className="px-1 truncate">
          <span className="font-mono text-[9px] font-bold text-slate-800">{node.code}</span>
          <span className="ml-1 font-medium text-slate-700">{node.name}</span>
        </span>
        <span className="px-1 text-right font-mono text-[9px] text-slate-500">{node.count}</span>
        <span />
      </div>

      {node.expanded && node.services && node.services.map((svc: any, idx: number) => (
        <ServiceRow key={svc.code || `svc-${idx}`} svc={svc} onSelect={onSelect} selectedCode={selectedCode} indent />
      ))}

      {node.expanded && node.services && node.services.length === 0 && !node.loading && (
        <div className="py-2 pl-8 text-[9px] text-slate-400">No services in this chapter.</div>
      )}
    </>
  );
}

// ─── Service row ─────────────────────────────────────────────────────────────

function ServiceRow({
  svc, onSelect, selectedCode, indent = false,
}: {
  svc: any;
  onSelect: (svc: any) => void;
  selectedCode?: string;
  indent?: boolean;
}) {
  const isSelected = selectedCode === svc.code && svc.code;

  return (
    <div
      className={`grid items-center gap-0 border-b border-slate-50 px-1 py-0.5 cursor-pointer transition-colors ${
        isSelected ? "bg-violet-100/70" : "hover:bg-emerald-50/40"
      } ${indent ? "grid-cols-[24px_minmax(0,1fr)_48px_64px] pl-5" : "grid-cols-[24px_minmax(0,1fr)_64px]"}`}
      onClick={(e) => { e.stopPropagation(); onSelect(svc); }}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold leading-none ${
        isSelected ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-600"
      }`}>
        {isSelected ? "\u2713" : "+"}
      </span>
      <div className="min-w-0 px-1">
        <div>
          <span className="font-mono text-[9px] font-semibold text-slate-600">{svc.code}</span>
          <span className="ml-1 text-[9px] text-slate-500" title={svc.name}>
            {svc.name}
          </span>
        </div>
      </div>
      {indent && <span />}
      <span className="px-1 text-right font-mono text-[9px] font-semibold text-slate-800">
        {formatChf(svc.tp)}
      </span>
    </div>
  );
}
