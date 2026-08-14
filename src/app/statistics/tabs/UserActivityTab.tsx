"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import type { StatisticsFilters } from "../page";
import { Kpi, Td, Th, ExportButton, buildQS } from "./_shared";

type StaffUser = { id: string; full_name: string | null; email: string | null };

type ActivityRow = {
  id: string;
  type: "stage_change" | "appointment" | "note" | "task" | "email";
  timestamp: string;
  patientId: string | null;
  patientName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  description: string;
};

type ApiResponse = {
  totals: {
    distinctDeals: number;
    distinctPatients: number;
    byType: {
      stage_change: number;
      appointment: number;
      note: number;
      task: number;
      email: number;
    };
  };
  rows: ActivityRow[];
};

const TYPE_LABELS: Record<ActivityRow["type"], string> = {
  stage_change: "Stage Change",
  appointment: "Appointment",
  note: "Note",
  task: "Task",
  email: "Email",
};

const TYPE_COLORS: Record<ActivityRow["type"], string> = {
  stage_change: "bg-violet-100 text-violet-700",
  appointment: "bg-sky-100 text-sky-700",
  note: "bg-amber-100 text-amber-700",
  task: "bg-emerald-100 text-emerald-700",
  email: "bg-slate-100 text-slate-700",
};

export default function UserActivityTab({ filters }: { filters: StatisticsFilters }) {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (cancelled) return;
      if (!error && data) setStaff(data as StaffUser[]);
      setStaffLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const qs = useMemo(
    () => buildQS({ userId, from: filters.from, to: filters.to }),
    [userId, filters.from, filters.to],
  );

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/user-activity?${qs}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error((err as { error?: string })?.error || `HTTP ${r.status}`);
        }
        return (await r.json()) as ApiResponse;
      })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qs, userId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Note:</strong> Deal stage-change tracking was only wired up to record who made the
        change starting from this fix — earlier stage changes cannot be attributed to a specific
        user. Appointments, notes, tasks, and (recent) emails are reliably tracked for the full
        period.
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Staff member
          </span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={staffLoading}
            className="min-w-[220px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Select a staff member…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || s.email || s.id}
              </option>
            ))}
          </select>
        </label>

        {userId && (
          <ExportButton
            href={`/api/statistics/user-activity/export?${qs}`}
            label="Export Excel"
          />
        )}
      </div>

      {!userId && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Select a staff member to see their activity for the selected date range.
        </div>
      )}

      {userId && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Kpi label="Deals touched" value={data?.totals.distinctDeals ?? 0} loading={loading} highlight />
            <Kpi label="Patients touched" value={data?.totals.distinctPatients ?? 0} loading={loading} />
            <Kpi label="Stage changes" value={data?.totals.byType.stage_change ?? 0} loading={loading} />
            <Kpi label="Appointments" value={data?.totals.byType.appointment ?? 0} loading={loading} />
            <Kpi label="Notes" value={data?.totals.byType.note ?? 0} loading={loading} />
            <Kpi label="Tasks" value={data?.totals.byType.task ?? 0} loading={loading} />
            <Kpi label="Emails" value={data?.totals.byType.email ?? 0} loading={loading} />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading && !error && <div className="text-sm text-slate-500">Loading…</div>}
          {!loading && !error && data && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Patient</Th>
                    <Th>Deal</Th>
                    <Th>Description</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                        No activity found for this user in the selected period.
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <Td>{new Date(r.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                      <Td>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[r.type]}`}>
                          {TYPE_LABELS[r.type]}
                        </span>
                      </Td>
                      <Td>
                        {r.patientId ? (
                          <a href={`/patients/${r.patientId}`} className="text-sky-600 hover:underline">
                            {r.patientName || "Unnamed"}
                          </a>
                        ) : (
                          r.patientName || "—"
                        )}
                      </Td>
                      <Td>{r.dealTitle || "—"}</Td>
                      <Td className="max-w-[320px] truncate text-slate-500">{r.description}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
