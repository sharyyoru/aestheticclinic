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
  whatsapp_sent_at: string | null;
  started_at: string | null;
  created_at: string;
};

/** A booking attributed to a call (the conversion). */
type Booking = { at: number; apptDate: string | null; status: string | null };

/** Per-call derived funnel data, keyed by call_logs.id. */
type CallAttribution = { whatsappSentAt: number | null; bookings: Booking[] };

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function callTimeMs(log: CallLog): number {
  return new Date(log.started_at || log.created_at).getTime();
}

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
  const [attribution, setAttribution] = useState<Map<string, CallAttribution>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);

      // Load this patient's calls + their bookings. The WhatsApp action is
      // recorded directly on the call (call_logs.whatsapp_sent_at, set from the
      // Retell send_whatsapp function by exact call_id), so no fuzzy matching.
      const [callsRes, apptRes] = await Promise.all([
        supabaseClient
          .from("call_logs")
          .select(
            "id, call_id, direction, agent_id, from_number, to_number, call_status, duration_seconds, summary, transcript, transcript_turns, recording_url, service_interest, assigned_user_name, whatsapp_sent_at, started_at, created_at",
          )
          .eq("patient_id", patientId)
          .order("started_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("appointments")
          .select("start_time, created_at, status")
          .eq("patient_id", patientId),
      ]);

      if (!mounted) return;
      if (callsRes.error) {
        setError(callsRes.error.message);
        setLogs([]);
        setLoading(false);
        return;
      }

      const callLogs = (callsRes.data as CallLog[]) || [];
      setLogs(callLogs);
      if (callLogs.length > 0) setExpandedId(callLogs[0].id);

      const bookings: Booking[] = [];
      for (const a of (apptRes.data as Record<string, unknown>[]) || []) {
        const at = new Date(a.created_at as string).getTime();
        if (Number.isNaN(at)) continue;
        bookings.push({ at, apptDate: (a.start_time as string) ?? null, status: (a.status as string) ?? null });
      }

      const attr = new Map<string, CallAttribution>();
      for (const log of callLogs) {
        const waAt = log.whatsapp_sent_at ? new Date(log.whatsapp_sent_at).getTime() : null;
        // A booking only counts as a conversion when this call had a WhatsApp
        // link sent AND the booking was created within a week of the call.
        const ct = callTimeMs(log);
        const bk =
          waAt !== null
            ? bookings.filter((b) => b.at >= ct && b.at - ct <= ONE_WEEK_MS)
            : [];
        if (waAt !== null || bk.length > 0) attr.set(log.id, { whatsappSentAt: waAt, bookings: bk });
      }
      setAttribution(attr);
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

  const outboundCount = logs.filter((l) => l.direction === "outbound").length;
  let callsWithWa = 0;
  let callsConverted = 0;
  attribution.forEach((a) => {
    if (a.whatsappSentAt !== null) callsWithWa += 1;
    if (a.bookings.length > 0) callsConverted += 1;
  });

  return (
    <div className="space-y-3">
      {/* Funnel summary: calls → WhatsApp link sent → booking (conversion) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
          {logs.length} call{logs.length === 1 ? "" : "s"}
          <span className="text-slate-400">({outboundCount} outbound)</span>
        </span>
        <span className="text-slate-300">→</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700 border border-green-200">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
          {callsWithWa} WhatsApp link{callsWithWa === 1 ? "" : "s"} sent
        </span>
        <span className="text-slate-300">→</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${callsConverted > 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-white text-slate-400 border-slate-200"}`}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          {callsConverted} booked
        </span>
      </div>
      {logs.map((log) => {
        const dir = directionLabel(log.direction);
        const when = log.started_at || log.created_at;
        const isExpanded = expandedId === log.id;
        const attr = attribution.get(log.id);
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
                {attr && attr.whatsappSentAt !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 border border-green-200" title="WhatsApp booking link sent during this call">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
                    WhatsApp
                  </span>
                )}
                {attr && attr.bookings.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300" title="This call led to a booking">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Booked
                  </span>
                )}
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

                {attr && (attr.whatsappSentAt !== null || attr.bookings.length > 0) && (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actions &amp; outcome</p>
                    <div className="space-y-1.5">
                      {attr.whatsappSentAt !== null && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" /></svg>
                          </span>
                          <span className="font-medium text-slate-700">WhatsApp booking link sent</span>
                          <span className="text-slate-400">· {formatSwissDateTime(new Date(attr.whatsappSentAt).toISOString())}</span>
                        </div>
                      )}
                      {attr.bookings.map((b, i) => (
                        <div key={`bk-${i}`} className="flex items-center gap-2 text-[11px] text-slate-600">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </span>
                          <span className="font-semibold text-emerald-800">Converted to booking</span>
                          {b.apptDate && <span className="text-slate-500">· {formatSwissDateTime(b.apptDate)}</span>}
                          {b.status && <span className="text-slate-400">· {b.status}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
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
