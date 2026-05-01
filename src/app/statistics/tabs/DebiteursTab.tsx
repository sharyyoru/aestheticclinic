"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, StatisticsFilters } from "../page";

type SubView = "by_entity" | "by_doctor" | "by_patient" | "detail" | "contentieux";

type DebiteurRow = {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  reminder_fees: number;
  open_amount: number;
  loss_amount: number;
  status: string;
  reminder_level: number;
  billing_type: string | null;
  health_insurance_law: string | null;
  provider_id: string | null;
  provider_name: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  patient_email: string | null;
  days_overdue: number;
  invoice_title: string | null;
};

type Group = {
  key: string;
  label: string;
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  openAmount: number;
  lossAmount: number;
  reminderFees: number;
};

type ApiResponse = {
  rows: DebiteurRow[];
  totals: {
    invoiceCount: number;
    totalAmount: number;
    paidAmount: number;
    reminderFees: number;
    openAmount: number;
    lossAmount: number;
  };
  groups: { byEntity: Group[]; byDoctor: Group[]; byPatient: Group[] };
};

function chf(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export default function DebiteursTab({
  filters,
}: {
  filters: StatisticsFilters;
  entities: Provider[];
  doctors: Provider[];
}) {
  const [view, setView] = useState<SubView>("by_entity");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.to) p.set("asOf", filters.to);
    if (filters.entityId) p.set("entityId", filters.entityId);
    if (filters.doctorId) p.set("doctorId", filters.doctorId);
    if (filters.law) p.set("law", filters.law);
    if (filters.billingType) p.set("billingType", filters.billingType);
    if (view === "contentieux") p.set("minLevel", "3");
    return p.toString();
  }, [filters, view]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/debiteurs?${queryString}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${r.status}`);
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
  }, [queryString]);

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Open invoices" value={totals?.invoiceCount ?? 0} loading={loading} />
        <Kpi label="Total billed" value={chf(totals?.totalAmount ?? 0)} loading={loading} />
        <Kpi label="Paid" value={chf(totals?.paidAmount ?? 0)} loading={loading} />
        <Kpi label="Reminder fees" value={chf(totals?.reminderFees ?? 0)} loading={loading} />
        <Kpi label="Open amount" value={chf(totals?.openAmount ?? 0)} loading={loading} highlight />
        <Kpi label="Loss" value={chf(totals?.lossAmount ?? 0)} loading={loading} />
      </div>

      {/* Sub-tabs + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              ["by_entity", "By entity"],
              ["by_doctor", "By doctor"],
              ["by_patient", "By patient"],
              ["detail", "Detail"],
              ["contentieux", "Contentieux"],
            ] as [SubView, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium " +
                (view === k
                  ? "bg-sky-600 text-white"
                  : "text-slate-600 hover:bg-slate-50")
              }
            >
              {l}
            </button>
          ))}
        </div>
        <a
          href={`/api/statistics/debiteurs/export?${queryString}`}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Excel
        </a>
      </div>

      {/* Body */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && !error && <div className="text-sm text-slate-500">Loading…</div>}
      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {view === "by_entity" && <GroupTable rows={data.groups.byEntity} groupLabel="Entity" />}
          {view === "by_doctor" && <GroupTable rows={data.groups.byDoctor} groupLabel="Doctor" />}
          {view === "by_patient" && <GroupTable rows={data.groups.byPatient} groupLabel="Patient" />}
          {(view === "detail" || view === "contentieux") && <DetailTable rows={data.rows} />}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border px-3 py-2.5 " +
        (highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={"mt-0.5 text-base font-semibold " + (highlight ? "text-amber-700" : "text-slate-900")}>
        {loading ? "…" : value}
      </div>
    </div>
  );
}

function GroupTable({ rows, groupLabel }: { rows: Group[]; groupLabel: string }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>{groupLabel}</Th>
          <Th align="right">Invoices</Th>
          <Th align="right">Total billed</Th>
          <Th align="right">Paid</Th>
          <Th align="right">Reminder fees</Th>
          <Th align="right">Open amount</Th>
          <Th align="right">Loss</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
              No data for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>{r.label}</Td>
            <Td align="right">{r.invoiceCount}</Td>
            <Td align="right">{chf(r.totalAmount)}</Td>
            <Td align="right">{chf(r.paidAmount)}</Td>
            <Td align="right">{chf(r.reminderFees)}</Td>
            <Td align="right" className="font-semibold text-amber-700">{chf(r.openAmount)}</Td>
            <Td align="right">{chf(r.lossAmount)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailTable({ rows }: { rows: DebiteurRow[] }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>Date FA</Th>
          <Th>No FA</Th>
          <Th>Patient</Th>
          <Th>Entity</Th>
          <Th>Doctor</Th>
          <Th>Law</Th>
          <Th align="right">Total</Th>
          <Th align="right">Paid</Th>
          <Th align="right">Open</Th>
          <Th align="right">Days late</Th>
          <Th>Reminder</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
              No open invoices for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.invoice_id} className="hover:bg-slate-50">
            <Td>{(r.invoice_date || "").slice(0, 10)}</Td>
            <Td>{r.invoice_number}</Td>
            <Td>
              {`${r.last_name || ""} ${r.first_name || ""}`.trim() || "—"}
            </Td>
            <Td>{r.provider_name || "—"}</Td>
            <Td>{r.doctor_name || "—"}</Td>
            <Td>{r.health_insurance_law || "—"}</Td>
            <Td align="right">{chf(r.total_amount)}</Td>
            <Td align="right">{chf(r.paid_amount)}</Td>
            <Td align="right" className="font-semibold text-amber-700">{chf(r.open_amount)}</Td>
            <Td align="right">
              <span className={r.days_overdue > 30 ? "text-red-600 font-medium" : ""}>
                {r.days_overdue}
              </span>
            </Td>
            <Td>{reminderLabel(r.reminder_level)}</Td>
            <Td>
              <span className={statusBadgeClass(r.status)}>{r.status}</span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={
        "px-3 py-2 font-semibold text-slate-700 " +
        (align === "right" ? "text-right" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={
        "px-3 py-1.5 text-slate-700 " +
        (align === "right" ? "text-right tabular-nums " : "") +
        (className || "")
      }
    >
      {children}
    </td>
  );
}

function reminderLabel(lvl: number): string {
  switch (lvl) {
    case 0:
      return "—";
    case 1:
      return "1st";
    case 2:
      return "2nd";
    case 3:
      return "3rd";
    case 4:
      return "Contentieux";
    default:
      return String(lvl);
  }
}

function statusBadgeClass(status: string): string {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium ";
  switch (status) {
    case "OPEN":
      return base + "bg-slate-100 text-slate-700";
    case "PARTIAL_PAID":
      return base + "bg-yellow-100 text-yellow-700";
    case "PARTIAL_LOSS":
      return base + "bg-red-100 text-red-700";
    default:
      return base + "bg-slate-100 text-slate-700";
  }
}
