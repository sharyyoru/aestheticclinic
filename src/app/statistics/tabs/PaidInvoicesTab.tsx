"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, StatisticsFilters } from "../page";
import { Kpi, Td, Th, ExportButton, SubTabs, chf, buildQS } from "./_shared";

type SubView = "by_entity" | "by_doctor" | "by_payment_method" | "detail";

type InvoiceRow = {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  paid_at: string | null;
  payment_method: string | null;
  invoice_title: string | null;
  amount_excl_vat: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  billing_type: string | null;
  health_insurance_law: string | null;
  provider_id: string | null;
  provider_name: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  patient_id: string;
  patient_first_name: string | null;
  patient_last_name: string | null;
  vat_free_amount: number;
  vat_reduced_amount: number;
  vat_full_amount: number;
};

type Group = {
  key: string;
  label: string;
  invoiceCount: number;
  amountExclVat: number;
  totalAmount: number;
  paidAmount: number;
  vatFree: number;
  vatReducedAmount: number;
  vatFullAmount: number;
};

type ApiResponse = {
  rows: InvoiceRow[];
  totals: {
    invoiceCount: number;
    amountExclVat: number;
    totalAmount: number;
    paidAmount: number;
    vatFree: number;
    vatReducedAmount: number;
    vatFullAmount: number;
  };
  groups: { byEntity: Group[]; byDoctor: Group[]; byPaymentMethod: Group[] };
};

export default function PaidInvoicesTab({
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

  const qs = useMemo(
    () =>
      buildQS({
        from: filters.from,
        to: filters.to,
        entityId: filters.entityId,
        doctorId: filters.doctorId,
        law: filters.law,
        billingType: filters.billingType,
      }),
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/statistics/paid-invoices?${qs}`)
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Paid invoices" value={totals?.invoiceCount ?? 0} loading={loading} />
        <Kpi label="Amount excl. VAT" value={chf(totals?.amountExclVat ?? 0)} loading={loading} />
        <Kpi label="Total billed" value={chf(totals?.totalAmount ?? 0)} loading={loading} />
        <Kpi label="Total paid" value={chf(totals?.paidAmount ?? 0)} loading={loading} highlight />
        <Kpi label="VAT reduced" value={chf(totals?.vatReducedAmount ?? 0)} loading={loading} />
        <Kpi label="VAT full" value={chf(totals?.vatFullAmount ?? 0)} loading={loading} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubTabs<SubView>
          tabs={[
            ["by_entity", "By entity"],
            ["by_doctor", "By doctor"],
            ["by_payment_method", "By payment method"],
            ["detail", "Detail"],
          ]}
          active={view}
          onChange={setView}
        />
        <ExportButton href={`/api/statistics/paid-invoices/export?${qs}`} />
      </div>

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
          {view === "by_payment_method" && (
            <GroupTable rows={data.groups.byPaymentMethod} groupLabel="Payment method" />
          )}
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
          <Th align="right">Invoices</Th>
          <Th align="right">Total billed</Th>
          <Th align="right">Total paid</Th>
          <Th align="right">VAT-free</Th>
          <Th align="right">VAT reduced</Th>
          <Th align="right">VAT full</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
              No paid invoices for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>{r.label}</Td>
            <Td align="right">{r.invoiceCount}</Td>
            <Td align="right">{chf(r.totalAmount)}</Td>
            <Td align="right" className="font-semibold text-emerald-700">
              {chf(r.paidAmount)}
            </Td>
            <Td align="right">{chf(r.vatFree)}</Td>
            <Td align="right">{chf(r.vatReducedAmount)}</Td>
            <Td align="right">{chf(r.vatFullAmount)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailTable({ rows }: { rows: InvoiceRow[] }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>Paid at</Th>
          <Th>Date FA</Th>
          <Th>No FA</Th>
          <Th>Subject</Th>
          <Th>Patient</Th>
          <Th>Entity</Th>
          <Th>Doctor</Th>
          <Th>Method</Th>
          <Th>Law</Th>
          <Th align="right">Total</Th>
          <Th align="right">Paid</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
              No paid invoices for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.invoice_id} className="hover:bg-slate-50">
            <Td>{(r.paid_at || "").slice(0, 10)}</Td>
            <Td>{(r.invoice_date || "").slice(0, 10)}</Td>
            <Td>{r.invoice_number}</Td>
            <Td>{r.invoice_title || "—"}</Td>
            <Td>
              {`${r.patient_last_name || ""} ${r.patient_first_name || ""}`.trim() || "—"}
            </Td>
            <Td>{r.provider_name || "—"}</Td>
            <Td>{r.doctor_name || "—"}</Td>
            <Td>{r.payment_method || "—"}</Td>
            <Td>{r.health_insurance_law || "—"}</Td>
            <Td align="right">{chf(r.total_amount)}</Td>
            <Td align="right" className="font-semibold text-emerald-700">
              {chf(r.paid_amount)}
            </Td>
            <Td>{r.status}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
