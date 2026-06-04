"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateVariable {
  key: string;    // "1", "2", "3" …
  label: string;  // "patient name", "appointment date" …
  example: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;       // UTILITY | MARKETING | AUTHENTICATION
  language: string;
  body: string;
  variables: TemplateVariable[];
  twilio_content_sid: string | null;
  status: string;         // approved | pending | rejected | active
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Fields resolvable at workflow send-time (keep in sync with deal-stage-changed)
const KNOWN_FIELD_LABELS = [
  "patient", "first name", "last name", "phone", "email",
  "deal", "clinic", "date", "time", "appointment", "stage", "pipeline",
  "reason", "location",
];

function isFieldMappable(label: string): boolean {
  const lower = label.toLowerCase();
  return KNOWN_FIELD_LABELS.some((kw) => lower.includes(kw));
}

function categoryColor(category: string): string {
  switch (category.toUpperCase()) {
    case "UTILITY":         return "bg-amber-50 text-amber-700 border-amber-200";
    case "MARKETING":       return "bg-blue-50 text-blue-700 border-blue-200";
    case "AUTHENTICATION":  return "bg-purple-50 text-purple-700 border-purple-200";
    default:                return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status.toLowerCase()) {
    case "approved": return { label: "approved",  cls: "bg-green-50  text-green-700  border-green-200" };
    case "pending":  return { label: "pending",   cls: "bg-amber-50  text-amber-700  border-amber-200" };
    case "rejected": return { label: "rejected",  cls: "bg-red-50    text-red-700    border-red-200"   };
    default:         return { label: status,      cls: "bg-slate-100 text-slate-600  border-slate-200" };
  }
}

// Render template body with {{N}} slots highlighted
function renderBodyPreview(body: string, variables: TemplateVariable[]): React.ReactNode {
  const varMap: Record<string, string> = {};
  for (const v of variables) {
    varMap[v.key] = v.label || v.example || `var ${v.key}`;
  }

  // Split on {{N}} patterns
  const parts = body.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    const match = part.match(/^{{(\d+)}}$/);
    if (match) {
      const label = varMap[match[1]] ?? match[1];
      return (
        <span
          key={i}
          className="inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200"
        >
          {label}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WhatsAppTemplatesTab() {
  const [templates, setTemplates]       = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [syncResult, setSyncResult]     = useState<{ synced: number; total: number; errors?: string[] } | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/whatsapp/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json() as { templates: WhatsAppTemplate[] };
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      const data = await res.json() as { ok: boolean; synced: number; total: number; errors?: string[]; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sync failed");
      } else {
        setSyncResult({ synced: data.synced, total: data.total, errors: data.errors });
        await loadTemplates();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">WhatsApp Templates</h2>
          <p className="mt-1 text-xs text-slate-500 max-w-xl">
            Templates are required to message patients for the first time, or when their 24-hour
            reply window is closed. All templates must be approved by Meta before they can be
            selected in workflows. Click <strong>Sync from Twilio</strong> to pull your latest
            approved templates.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {syncing ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Syncing…
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Sync from Twilio
            </>
          )}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-xs text-green-800">
            <span className="font-medium">Sync complete.</span>{" "}
            {syncResult.synced} template{syncResult.synced !== 1 ? "s" : ""} synced from {syncResult.total} in Twilio.
            {syncResult.errors && syncResult.errors.length > 0 && (
              <div className="mt-1 text-amber-700">
                {syncResult.errors.length} warning{syncResult.errors.length !== 1 ? "s" : ""}:{" "}
                {syncResult.errors.join("; ")}
              </div>
            )}
          </div>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-green-500 hover:text-green-700">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
          <p className="text-xs text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_130px_80px_110px_28px] gap-3 border-b border-slate-100 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Name</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Category</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Variables</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
          <span />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg className="h-5 w-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!loading && templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <p className="text-sm font-medium text-slate-600">No templates yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Create templates in the{" "}
              <a href="https://console.twilio.com/us1/develop/sms/content-template-builder" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                Twilio Content Template Builder
              </a>
              , then click <strong>Sync from Twilio</strong> above.
            </p>
          </div>
        )}

        {/* Template rows */}
        {!loading && templates.map((tmpl) => {
          const isExpanded = expandedId === tmpl.id;
          const badge = statusBadge(tmpl.status);
          const varCount = tmpl.variables?.length ?? 0;

          return (
            <div key={tmpl.id} className="border-b border-slate-100/60 last:border-0">
              {/* Row */}
              <button
                type="button"
                onClick={() => toggleExpand(tmpl.id)}
                className="grid w-full grid-cols-[1fr_130px_80px_110px_28px] gap-3 items-center px-4 py-3 text-left hover:bg-slate-50/70 transition-colors"
              >
                <span className="truncate text-xs font-medium text-slate-800">{tmpl.name}</span>

                <span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryColor(tmpl.category)}`}>
                    {tmpl.category}
                  </span>
                </span>

                <span className="text-xs text-slate-500">
                  {varCount === 0 ? <span className="text-slate-300">—</span> : `${varCount} var${varCount !== 1 ? "s" : ""}`}
                </span>

                <span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    {badge.label === "approved" && (
                      <svg className="mr-1 h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                    {badge.label === "pending" && (
                      <svg className="mr-1 h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>
                    )}
                    {badge.label === "rejected" && (
                      <svg className="mr-1 h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                    {badge.label}
                  </span>
                </span>

                {/* Chevron */}
                <span className="flex justify-center">
                  <svg
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-5 space-y-5">
                  {/* Body preview */}
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Message body</p>
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 leading-relaxed">
                      {renderBodyPreview(tmpl.body, tmpl.variables ?? [])}
                    </div>
                  </div>

                  {/* Variables */}
                  {varCount > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Variables</p>
                      <div className="space-y-2">
                        {(tmpl.variables ?? []).map((v) => {
                          const mappable = isFieldMappable(v.label);
                          return (
                            <div
                              key={v.key}
                              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              {/* Slot badge */}
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                                {v.key}
                              </span>
                              {/* Label */}
                              <span className="flex-1 text-xs text-slate-700">
                                <span className="font-medium">{v.label || v.example}</span>
                                {v.example && v.label !== v.example && (
                                  <span className="ml-1.5 text-slate-400">e.g. &ldquo;{v.example}&rdquo;</span>
                                )}
                              </span>
                              {/* Availability badge */}
                              {mappable ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  mappable
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                                  use custom text
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ContentSid</span>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-600">
                        {tmpl.twilio_content_sid ?? <span className="text-slate-300">—</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Language</span>
                      <p className="mt-0.5 text-[11px] text-slate-600">{tmpl.language}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Last synced</span>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {new Date(tmpl.updated_at).toLocaleString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Rejected warning */}
                  {tmpl.status === "rejected" && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                      <p className="text-[11px] text-red-700">
                        This template was rejected by Meta and cannot be used in workflows. Edit it in the{" "}
                        <a href="https://console.twilio.com/us1/develop/sms/content-template-builder" target="_blank" rel="noopener noreferrer" className="underline">
                          Twilio Console
                        </a>
                        {" "}and re-submit for approval, then sync again.
                      </p>
                    </div>
                  )}

                  {/* Pending notice */}
                  {tmpl.status === "pending" && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>
                      <p className="text-[11px] text-amber-800">
                        Awaiting Meta approval. This can take a few minutes to 24 hours. Sync again once approved to use it in workflows.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      {!loading && templates.length > 0 && (
        <p className="text-[11px] text-slate-400">
          {templates.length} template{templates.length !== 1 ? "s" : ""} · Only{" "}
          <span className="font-medium text-green-700">approved</span> templates can be selected in workflows.
          Templates are created and managed in the{" "}
          <a href="https://console.twilio.com/us1/develop/sms/content-template-builder" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
            Twilio Content Template Builder
          </a>.
        </p>
      )}
    </div>
  );
}
