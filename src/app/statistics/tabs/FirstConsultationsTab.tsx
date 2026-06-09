"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, StatisticsFilters } from "../page";
import { Kpi, Td, Th, ExportButton, SubTabs, buildQS } from "./_shared";

type SubView = "by_doctor" | "by_month" | "detail";

type Row = {
  appointment_id: string;
  date: string;
  status: string;
  doctor_id: string | null;
  doctor_name: string | null;
  patient_id: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  patient_dob: string | null;
};

type Group = {
  key: string;
  label: string;
  count: number;
};

type ApiResponse = {
  rows: Row[];
  totals: { count: number };
  groups: { byDoctor: Group[]; byMonth: Group[] };
};

export default function FirstConsultationsTab({
  filters,
}: {
  filters: StatisticsFilters;
  entities: Provider[];
  doctors: Provider[];
}) {
  const [view, setView] = useState<SubView>("by_month");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(
    () =>
      buildQS({
        from: filters.from,
        to: filters.to,
        doctorId: filters.doctorId,
      }),
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/first-consultations?${qs}`)
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
  }, [qs]);

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi
          label="1ères consultations"
          value={data?.totals.count ?? 0}
          loading={loading}
          highlight
        />
        <Kpi
          label="Médecins concernés"
          value={data?.groups.byDoctor.length ?? 0}
          loading={loading}
        />
        <Kpi
          label="Période"
          value={`${filters.from} → ${filters.to}`}
          loading={false}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubTabs<SubView>
          tabs={[
            ["by_month", "Par mois"],
            ["by_doctor", "Par médecin"],
            ["detail", "Détail patients"],
          ]}
          active={view}
          onChange={setView}
        />
        <ExportButton
          href={`/api/statistics/first-consultations/export?${qs}`}
          label="Export Excel"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && !error && <div className="text-sm text-slate-500">Chargement…</div>}
      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {view === "by_month" && <GroupTable rows={data.groups.byMonth} groupLabel="Mois" />}
          {view === "by_doctor" && <GroupTable rows={data.groups.byDoctor} groupLabel="Médecin" />}
          {view === "detail" && <DetailTable rows={data.rows} />}
        </div>
      )}
    </div>
  );
}

function GroupTable({ rows, groupLabel }: { rows: Group[]; groupLabel: string }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>{groupLabel}</Th>
          <Th align="right">1ères consultations</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={2} className="px-3 py-6 text-center text-slate-400">
              Aucune 1ère consultation pour les filtres sélectionnés.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>{r.label}</Td>
            <Td align="right" className="font-semibold text-amber-700">
              {r.count}
            </Td>
          </tr>
        ))}
        {rows.length > 0 && (
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <Td>Total</Td>
            <Td align="right" className="font-semibold text-amber-700">
              {rows.reduce((s, r) => s + r.count, 0)}
            </Td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function DetailTable({ rows }: { rows: Row[] }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>Date</Th>
          <Th>Statut</Th>
          <Th>Médecin</Th>
          <Th>Nom</Th>
          <Th>Prénom</Th>
          <Th>Date naissance</Th>
          <Th>Email</Th>
          <Th>Téléphone</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
              Aucune 1ère consultation pour les filtres sélectionnés.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.appointment_id} className="hover:bg-slate-50">
            <Td>{r.date}</Td>
            <Td>
              <span
                className={
                  "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                  (r.status === "scheduled"
                    ? "bg-sky-100 text-sky-700"
                    : r.status === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : r.status === "cancelled"
                    ? "bg-red-100 text-red-600"
                    : "bg-slate-100 text-slate-600")
                }
              >
                {r.status}
              </span>
            </Td>
            <Td>{r.doctor_name || "—"}</Td>
            <Td className="font-medium">{r.patient_last_name || "—"}</Td>
            <Td>{r.patient_first_name || "—"}</Td>
            <Td>{r.patient_dob ? r.patient_dob.slice(0, 10) : "—"}</Td>
            <Td>{r.patient_email || "—"}</Td>
            <Td>{r.patient_phone || "—"}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
