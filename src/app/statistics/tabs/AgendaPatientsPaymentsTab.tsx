"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, StatisticsFilters } from "../page";
import { Kpi, Td, Th, ExportButton, SubTabs, chf, buildQS } from "./_shared";

type SubView = "by_month" | "by_payment_method" | "by_patient" | "detail";

type PaymentRow = {
  payment_id: string;
  payment_date: string;
  payment_method: string | null;
  amount: number;
  invoice_number: string;
  invoice_date: string;
  invoice_total: number;
  invoice_paid: number;
  invoice_status: string;
  patient_id: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  notes: string | null;
};

type Group = {
  key: string;
  label: string;
  patientCount: number;
  invoiceCount: number;
  totalPaid: number;
  totalBilled: number;
  email?: string;
  phone?: string;
};

type ApiResponse = {
  rows: PaymentRow[];
  totals: {
    patientCount: number;
    invoiceCount: number;
    totalPaid: number;
    totalBilled: number;
  };
  groups: {
    byMonth: Group[];
    byPaymentMethod: Group[];
    byPatient: Group[];
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
  const [location, setLocation] = useState<string>("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>([]);

  // Fetch available locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/appointments/locations');
        if (response.ok) {
          const data = await response.json();
          setLocations(data.locations || []);
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err);
      }
    };
    fetchLocations();
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
      }) + (location ? `&location=${encodeURIComponent(location)}` : ""),
    [filters, location],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/agenda-patients-payments?${qs}`)
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
  }, [qs]);

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {/* Location filter */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Agenda Location
            </span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="min-w-[200px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500">
            {location ? `Showing patients from "${location}" agenda` : 'Showing patients from all agendas'}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Patients" value={totals?.patientCount ?? 0} loading={loading} />
        <Kpi label="Invoices" value={totals?.invoiceCount ?? 0} loading={loading} />
        <Kpi label="Total billed" value={chf(totals?.totalBilled ?? 0)} loading={loading} />
        <Kpi label="Total paid" value={chf(totals?.totalPaid ?? 0)} loading={loading} highlight />
      </div>

      {/* Sub-tabs */}
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

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !error && <div className="text-sm text-slate-500">Loading…</div>}

      {/* Data tables */}
      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {view === "by_month" && <GroupTable rows={data.groups.byMonth} groupLabel="Month" />}
          {view === "by_payment_method" && (
            <GroupTable rows={data.groups.byPaymentMethod} groupLabel="Payment Method" />
          )}
          {view === "by_patient" && <PatientTable rows={data.groups.byPatient} />}
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

function PatientTable({ rows }: { rows: Group[] }) {
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

function DetailTable({ rows }: { rows: PaymentRow[] }) {
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
          <Th align="right">Paid</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
              No payments found for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.payment_id} className="hover:bg-slate-50">
            <Td>{r.payment_date}</Td>
            <Td>{r.payment_method || "—"}</Td>
            <Td align="right" className="font-semibold text-emerald-700">
              {chf(r.amount)}
            </Td>
            <Td>
              <div>
                <div className="font-medium">{r.invoice_number}</div>
                <div className="text-slate-500">{r.invoice_date}</div>
              </div>
            </Td>
            <Td>
              {`${r.patient_last_name || ""} ${r.patient_first_name || ""}`.trim() || "—"}
            </Td>
            <Td className="text-slate-600">{r.patient_email || "—"}</Td>
            <Td className="text-slate-600">{r.patient_phone || "—"}</Td>
            <Td>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  r.invoice_status === "PAID"
                    ? "bg-green-100 text-green-800"
                    : r.invoice_status === "PARTIAL_PAID"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {r.invoice_status}
              </span>
            </Td>
            <Td align="right">{chf(r.invoice_total)}</Td>
            <Td align="right">{chf(r.invoice_paid)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}