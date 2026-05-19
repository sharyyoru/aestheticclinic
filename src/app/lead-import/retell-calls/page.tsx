"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";

type AliiceCall = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  deals: {
    id: string;
    title: string;
    notes: string | null;
    service_id: string | null;
  }[];
};

export default function AliiceCallsPage() {
  const [calls, setCalls] = useState<AliiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabaseClient
        .from("patients")
        .select("id, first_name, last_name, phone, email, notes, created_at, deals(id, title, notes, service_id)")
        .eq("source", "Retell AI Agent")
        .order("created_at", { ascending: false })
        .limit(200);
      setCalls((data as AliiceCall[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  function extractFromNotes(notes: string | null, field: string): string {
    if (!notes) return "";
    const match = notes.match(new RegExp(`"${field}":\\s*"?([^",\\n}]+)`));
    return match?.[1]?.trim() || "";
  }

  function getDuration(notes: string | null): string {
    if (!notes) return "-";
    const match = notes.match(/Duration:\s*(\d+)s/);
    if (!match) return "-";
    const s = parseInt(match[1]);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  }

  function getServiceInterest(call: AliiceCall): string {
    const deal = call.deals?.[0];
    if (deal?.title) {
      const parts = deal.title.split(" - ");
      if (parts.length > 1) return parts.slice(1).join(" - ");
    }
    return extractFromNotes(call.notes, "service_interest") || "General Inquiry";
  }

  function getLocation(notes: string | null): string {
    if (!notes) return "-";
    const match = notes.match(/"location":\s*"([^"]+)"/);
    return match?.[1] || "-";
  }

  function getTranscriptPreview(notes: string | null): string {
    if (!notes) return "";
    const idx = notes.indexOf("Transcript:");
    if (idx === -1) return "";
    return notes.substring(idx + 11).trim();
  }

  function getDirection(notes: string | null): string {
    if (!notes) return "-";
    if (notes.includes("Direction: inbound")) return "Inbound";
    if (notes.includes("Direction: outbound")) return "Outbound";
    if (notes.includes("online_call") || notes.includes("online_conversation")) return "Web Call";
    return "-";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Aliice Calls</h1>
          <p className="text-sm text-slate-500">{calls.length} leads captured from AI calls & web conversations</p>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-slate-900">No calls yet</h3>
          <p className="mt-1 text-xs text-slate-500">Leads will appear here when callers interact with Aliice.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Interest</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Location</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Deal</th>
              </tr>
            </thead>
            {calls.map((call) => {
                const isExpanded = expandedId === call.id;
                const deal = call.deals?.[0];
                return (
                  <tbody key={call.id} className="divide-y divide-slate-100">
                  <tr className="group cursor-pointer hover:bg-slate-50/50" onClick={() => setExpandedId(isExpanded ? null : call.id)}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {call.first_name === "Unknown" ? "-" : `${call.first_name || ""} ${call.last_name || ""}`.trim() || "-"}
                      </div>
                      {call.email && <div className="text-xs text-slate-400">{call.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-mono">{call.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {getServiceInterest(call)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{getDirection(call.notes)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{getLocation(call.notes)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{getDuration(call.notes)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(call.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      {deal ? (
                        <Link href={`/patients/${call.id}`} className="text-xs text-sky-600 hover:underline">
                          View
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-6 py-4">
                        <div className="text-xs text-slate-600 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono leading-relaxed">
                          {getTranscriptPreview(call.notes) || "No transcript available"}
                        </div>
                      </td>
                    </tr>
                  )}
                  </tbody>
                );
              })}
          </table>
        </div>
      )}
    </div>
  );
}
