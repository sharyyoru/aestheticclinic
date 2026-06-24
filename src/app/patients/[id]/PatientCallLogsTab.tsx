"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { formatSwissDateTime } from "@/lib/swissTimezone";
import { formatCallDuration, type CallTurn } from "@/lib/callLog";

type CallLog = {
  id: string;
  call_id: string | null;
  direction: string | null;
  agent_id: string | null;
  from_number: string | null;
  to_number: string | null;
  call_status: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  transcript_turns: CallTurn[] | null;
  recording_url: string | null;
  service_interest: string | null;
  assigned_user_name: string | null;
  started_at: string | null;
  created_at: string;
};

function directionLabel(direction: string | null): { label: string; cls: string } {
  switch (direction) {
    case "outbound":
      return { label: "Outbound", cls: "bg-sky-50 text-sky-700 border-sky-200" };
    case "web":
      return { label: "Web call", cls: "bg-violet-50 text-violet-700 border-violet-200" };
    default:
      return { label: "Inbound", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
}

/** Fallback parse of a plain transcript string into turns for display. */
function turnsFromText(text: string | null): CallTurn[] {
  if (!text) return [];
  const re = /^\s*(agent|assistant|ai|bot|user|customer|caller|patient|human)\s*:\s*(.*)$/i;
  const turns: CallTurn[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(re);
    if (m) {
      const r = m[1].toLowerCase();
      const role: CallTurn["role"] = ["agent", "assistant", "ai", "bot"].includes(r) ? "agent" : "patient";
      turns.push({ role, content: m[2].trim() });
    } else if (turns.length > 0) {
      turns[turns.length - 1].content += ` ${line}`;
    } else {
      turns.push({ role: "patient", content: line });
    }
  }
  return turns;
}

function CallTranscript({ log }: { log: CallLog }) {
  const turns =
    log.transcript_turns && log.transcript_turns.length > 0
      ? log.transcript_turns
      : turnsFromText(log.transcript);

  if (turns.length === 0) {
    return <p className="text-[11px] italic text-slate-400">No transcript available for this call.</p>;
  }

  return (
    <div className="space-y-2">
      {turns.map((turn, i) => {
        const isAgent = turn.role === "agent";
        return (
          <div key={i} className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
              isAgent
                ? "bg-slate-100 text-slate-800 rounded-tl-sm"
                : "bg-emerald-500 text-white rounded-tr-sm"
            }`}>
              <p className={`mb-0.5 text-[9px] font-semibold uppercase tracking-wide ${isAgent ? "text-slate-400" : "text-emerald-50"}`}>
                {isAgent ? "Aliice (AI Agent)" : "Patient"}
              </p>
              {turn.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PatientCallLogsTab({ patientId }: { patientId: string }) {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabaseClient
        .from("call_logs")
        .select(
          "id, call_id, direction, agent_id, from_number, to_number, call_status, duration_seconds, summary, transcript, transcript_turns, recording_url, service_interest, assigned_user_name, started_at, created_at",
        )
        .eq("patient_id", patientId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (qErr) {
        setError(qErr.message);
        setLogs([]);
      } else {
        setLogs((data as CallLog[]) || []);
        // Auto-expand the most recent call for convenience.
        if (data && data.length > 0) setExpandedId((data[0] as CallLog).id);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
        Could not load call logs: {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">No call logs yet</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Inbound and outbound AI calls for this patient will appear here with the full conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">{logs.length} call{logs.length === 1 ? "" : "s"} logged</p>
      {logs.map((log) => {
        const dir = directionLabel(log.direction);
        const when = log.started_at || log.created_at;
        const isExpanded = expandedId === log.id;
        return (
          <div key={log.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${dir.cls}`}>
                  {dir.label}
                </span>
                <span className="text-xs font-medium text-slate-800">{formatSwissDateTime(when)}</span>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500">{formatCallDuration(log.duration_seconds)}</span>
                {log.call_status && (
                  <span className="text-[11px] text-slate-400">· {log.call_status}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {log.assigned_user_name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" />
                    </svg>
                    Task → {log.assigned_user_name}
                  </span>
                )}
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                {(log.service_interest || log.from_number) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    {log.service_interest && <span>Interest: <span className="text-slate-700">{log.service_interest}</span></span>}
                    {log.from_number && <span>From: <span className="font-mono text-slate-700">{log.from_number}</span></span>}
                    {log.to_number && <span>To: <span className="font-mono text-slate-700">{log.to_number}</span></span>}
                  </div>
                )}

                {log.summary && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Summary</p>
                    <p className="text-[12px] leading-relaxed text-slate-700">{log.summary}</p>
                  </div>
                )}

                {log.recording_url && (
                  <audio controls src={log.recording_url} className="w-full">
                    <track kind="captions" />
                  </audio>
                )}

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conversation</p>
                  <CallTranscript log={log} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
