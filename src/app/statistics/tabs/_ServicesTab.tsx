"use client";

import { useEffect, useMemo, useState } from "react";
import type { StatisticsFilters } from "../page";
import { Kpi, Td, Th, ExportButton, SubTabs, chf, buildQS } from "./_shared";

type SubView = "by_entity" | "by_doctor" | "by_tariff_code" | "by_catalog" | "detail";

type ServiceRow = {
  line_id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  paid_at: string | null;
  invoice_status: string;
  health_insurance_law: string | null;
  billing_type: string | null;
  provider_name: string | null;
  doctor_name: string | null;
  patient_id: string;
  code: string | null;
  line_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_rate: string | null;
  vat_rate_value: number | null;
  vat_amount: number;
  tariff_code: number | null;
  catalog_name: string | null;
  catalog_nature: string | null;
  line_paid_amount: number;
};

type Group = {
  key: string;
  label: string;
  lineCount: number;
  invoiceCount: number;
  totalPrice: number;
  paidPrice: number;
  vatAmount: number;
};

type ApiResponse = {
  rows: ServiceRow[];
  totals: {
    lineCount: number;
    invoiceCount: number;
    totalPrice: number;
    paidPrice: number;
    vatAmount: number;
  };
  groups: {
    byEntity: Group[];
    byDoctor: Group[];
    byTariffCode: Group[];
    byCatalog: Group[];
  };
};

export type ServicesTabConfig = {
  endpoint: string; // /api/statistics/invoiced-services or /paid-services
  exportEndpoint: string;
  /** Whether to show the "paid" column / KPI prominently. */
  paidMode: boolean;
};

export default function ServicesTab({
  filters,
  config,
}: {
  filters: StatisticsFilters;
  config: ServicesTabConfig;
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
        includeCancelled: filters.includeCancelled,
      }),
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${config.endpoint}?${qs}`)
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
  }, [qs, config.endpoint]);

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Service lines" value={totals?.lineCount ?? 0} loading={loading} />
        <Kpi label="Invoices" value={totals?.invoiceCount ?? 0} loading={loading} />
        <Kpi
          label={config.paidMode ? "Total billed" : "Total invoiced"}
          value={chf(totals?.totalPrice ?? 0)}
          loading={loading}
          highlight={!config.paidMode}
        />
        <Kpi
          label="Total paid (lines)"
          value={chf(totals?.paidPrice ?? 0)}
          loading={loading}
          highlight={config.paidMode}
        />
        <Kpi label="VAT amount" value={chf(totals?.vatAmount ?? 0)} loading={loading} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubTabs<SubView>
          tabs={[
            ["by_entity", "By entity"],
            ["by_doctor", "By doctor"],
            ["by_tariff_code", "By tariff code"],
            ["by_catalog", "By catalog"],
            ["detail", "Detail"],
          ]}
          active={view}
          onChange={setView}
        />
        <ExportButton href={`${config.exportEndpoint}?${qs}`} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && !error && <div className="text-sm text-slate-500">Loading…</div>}
      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {view === "by_entity" && (
            <GroupTable rows={data.groups.byEntity} groupLabel="Entity" paidMode={config.paidMode} />
          )}
          {view === "by_doctor" && (
            <GroupTable rows={data.groups.byDoctor} groupLabel="Doctor" paidMode={config.paidMode} />
          )}
          {view === "by_tariff_code" && (
            <GroupTable
              rows={data.groups.byTariffCode}
              groupLabel="Tariff code"
              paidMode={config.paidMode}
            />
          )}
          {view === "by_catalog" && (
            <GroupTable
              rows={data.groups.byCatalog}
              groupLabel="Catalog"
              paidMode={config.paidMode}
            />
          )}
          {view === "detail" && <DetailTable rows={data.rows} paidMode={config.paidMode} />}
        </div>
      )}
    </div>
  );
}

function GroupTable({
  rows,
  groupLabel,
  paidMode,
}: {
  rows: Group[];
  groupLabel: string;
  paidMode: boolean;
}) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>{groupLabel}</Th>
          <Th align="right">Lines</Th>
          <Th align="right">Invoices</Th>
          <Th align="right">{paidMode ? "Total billed" : "Total invoiced"}</Th>
          <Th align="right">Total paid</Th>
          <Th align="right">VAT</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
              No service lines for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.key} className="hover:bg-slate-50">
            <Td>{r.label}</Td>
            <Td align="right">{r.lineCount}</Td>
            <Td align="right">{r.invoiceCount}</Td>
            <Td
              align="right"
              className={paidMode ? "" : "font-semibold text-emerald-700"}
            >
              {chf(r.totalPrice)}
            </Td>
            <Td
              align="right"
              className={paidMode ? "font-semibold text-emerald-700" : ""}
            >
              {chf(r.paidPrice)}
            </Td>
            <Td align="right">{chf(r.vatAmount)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailTable({ rows, paidMode }: { rows: ServiceRow[]; paidMode: boolean }) {
  return (
    <table className="min-w-full divide-y divide-slate-200 text-xs">
      <thead className="bg-slate-50">
        <tr>
          <Th>Date FA</Th>
          {paidMode && <Th>Paid at</Th>}
          <Th>No FA</Th>
          <Th>Entity</Th>
          <Th>Doctor</Th>
          <Th>Catalog</Th>
          <Th>Code</Th>
          <Th>Designation</Th>
          <Th align="right">Qty</Th>
          <Th align="right">Unit price</Th>
          <Th align="right">Total</Th>
          {paidMode && <Th align="right">Paid (line)</Th>}
          <Th>VAT</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={paidMode ? 13 : 11}
              className="px-3 py-6 text-center text-slate-400"
            >
              No service lines for the selected filters.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.line_id} className="hover:bg-slate-50">
            <Td>{(r.invoice_date || "").slice(0, 10)}</Td>
            {paidMode && <Td>{(r.paid_at || "").slice(0, 10)}</Td>}
            <Td>{r.invoice_number}</Td>
            <Td>{r.provider_name || "—"}</Td>
            <Td>{r.doctor_name || "—"}</Td>
            <Td>{r.catalog_name || "—"}</Td>
            <Td>{r.code || "—"}</Td>
            <Td>{r.line_name}</Td>
            <Td align="right">{r.quantity}</Td>
            <Td align="right">{chf(r.unit_price)}</Td>
            <Td align="right" className="font-semibold">
              {chf(r.total_price)}
            </Td>
            {paidMode && (
              <Td align="right" className="text-emerald-700">
                {chf(r.line_paid_amount)}
              </Td>
            )}
            <Td>
              {r.vat_rate || "—"}
              {r.vat_rate_value
                ? ` (${(Number(r.vat_rate_value) * 100).toFixed(1)}%)`
                : ""}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
