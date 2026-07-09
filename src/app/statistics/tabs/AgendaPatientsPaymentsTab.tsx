"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, StatisticsFilters } from "../page";
import type { AgendaPaymentRow, AgendaGroup, AgendaPaymentsTotals } from "@/lib/statisticsFetchers";
import { Kpi, Td, Th, ExportButton, SubTabs, chf, buildQS } from "./_shared";

type SubView = "by_month" | "by_payment_method" | "by_patient" | "detail";

type ApiResponse = {
  rows: AgendaPaymentRow[];
  totals: AgendaPaymentsTotals;
  groups: {
    byMonth: AgendaGroup[];
    byPaymentMethod: AgendaGroup[];
    byPatient: AgendaGroup[];
  };
};

export default function AgendaPatientsPaymentsTab({
  filters,
}: {
  filters: StatisticsFilters;
  entities: Provider[];
  doctors: Provider[];
}) {
  const [view, setView] = useState<SubView>("by_month");
  const [agenda, setAgenda] = useState<string>("");
  const [agendas, setAgendas] = useState<string[]>([]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available agendas (distinct locations in appointments)
  useEffect(() => {
    fetch("/api/appointments/locations")
      .then((r) => r.json())
      .then((d) => setAgendas(d.locations ?? []))
      .catch(() => {/* ignore */});
  }, []);

  const qs = useMemo(
    () =>
      buildQS({
        from: filters.from,
        to: filters.to,
        entityId: filters.entityId,
        doctorId: filters.doctorId,
        law: filters.law,
        billingType: filters.billingType,
      }) + (agenda ? `&agenda=${encodeURIComponent(agenda)}` : ""),
    [filters, agenda],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/agenda-patients-payments?${qs}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error((err as { error?: string })?.error || `HTTP ${r.status}`);
        }
        return r.json() as Promise<ApiResponse>;
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

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {/* Agenda (location) picker */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Agenda
            </span>
            <select
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="min-w-[200px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
            >
              <option value="">All agendas</option>
              {agendas.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <p className="pb-1 text-xs text-slate-500">
            {agenda
              ? `Patients who appeared in the "${agenda}" agenda and their payments in the selected period.`
              : "Select an agenda to filter, or leave blank for all agendas."}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Patients" value={totals?.patientCount ?? 0} loading={loading} />
        <Kpi label="Invoices" value={totals?.invoiceCount ?? 0} loading={loading} />
        <Kpi label="Total billed" value={chf(totals?.totalBilled ?? 0)} loading={loading} />
        <Kpi label="Total paid" value={chf(totals?.totalPaid ?? 0)} loading={loading} highlight />
      </div>

      {/* Sub-tabs + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubTabs<SubView>
          tabs={[
            ["by_month", "By month"],
            ["by_payment_method", "By payment method"],
            ["by_patient", "By patient"],
            ["detail", "Detail"],
          ]}
          active={view}
          onChange={setView}
        />
        <ExportButton href={`/api/statistics/agenda-patients-payments/export?${qs}`} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && !error && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {view === "by_month" && <GroupTable rows={data.groups.byMonth} groupLabel="Month" />}
          {view === "by_payment_method" && (
            <GroupTable rows={data.groups.byPaymentMethod} groupLabel="Payment method" />
          )}
          {view === "by_patient" && <PatientTable rows={data.groups.byPatient} />}
          {view === "detail" && <DetailTable rows={data.rows} />}
        </div>
      )}
    </div>
  );
}

function GroupTable({ rows, groupLabel }: { rows: AgendaGroup[]; groupLabel: string }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>{groupLabel}</Th>
          <Th align="right">Patients</Th>
          <Th align="right">Invoices</Th>
          <Th align="right">Total billed</Th>
          <Th align="right">Total paid</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
              No payments found for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>{r.label}</Td>
            <Td align="right">{r.patientCount}</Td>
            <Td align="right">{r.invoiceCount}</Td>
            <Td align="right">{chf(r.totalBilled)}</Td>
            <Td align="right" className="font-semibold text-emerald-700">
              {chf(r.totalPaid)}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PatientTable({ rows }: { rows: AgendaGroup[] }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>Patient</Th>
          <Th>Email</Th>
          <Th>Phone</Th>
          <Th align="right">Invoices</Th>
          <Th align="right">Total billed</Th>
          <Th align="right">Total paid</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
              No patients found for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td className="font-medium">{r.label}</Td>
            <Td className="text-slate-600">{r.email || "—"}</Td>
            <Td className="text-slate-600">{r.phone || "—"}</Td>
            <Td align="right">{r.invoiceCount}</Td>
            <Td align="right">{chf(r.totalBilled)}</Td>
            <Td align="right" className="font-semibold text-emerald-700">
              {chf(r.totalPaid)}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailTable({ rows }: { rows: AgendaPaymentRow[] }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>Payment date</Th>
          <Th>Method</Th>
          <Th align="right">Amount</Th>
          <Th>Invoice</Th>
          <Th>Patient</Th>
          <Th>Email</Th>
          <Th>Phone</Th>
          <Th>Status</Th>
          <Th align="right">Invoice total</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
              No payments found for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r, i) => (
          <tr key={`${r.payment_id}-${i}`} className="hover:bg-slate-50">
            <Td>{(r.payment_date || "").slice(0, 10)}</Td>
            <Td>{r.payment_method || "—"}</Td>
            <Td align="right" className="font-semibold text-emerald-700">
              {chf(r.amount)}
            </Td>
            <Td>
              <div className="font-medium">{r.invoice_number}</div>
              <div className="text-slate-500">{r.invoice_date}</div>
            </Td>
            <Td>
              {`${r.patient_last_name || ""} ${r.patient_first_name || ""}`.trim() || "—"}
            </Td>
            <Td className="text-slate-600">{r.patient_email || "—"}</Td>
            <Td className="text-slate-600">{r.patient_phone || "—"}</Td>
            <Td>
              <span
                className={
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                  (r.invoice_status === "PAID"
                    ? "bg-green-100 text-green-800"
                    : r.invoice_status === "PARTIAL_PAID"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-slate-100 text-slate-800")
                }
              >
                {r.invoice_status}
              </span>
            </Td>
            <Td align="right">{chf(r.invoice_total)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
