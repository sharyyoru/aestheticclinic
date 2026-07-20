"use client";

import { useEffect, useMemo, useState } from "react";
import type { Provider, StatisticsFilters } from "../page";
import { Kpi, Th, Td, SubTabs, ExportButton, buildQS, chf } from "./_shared";

type SubView = "overview" | "all_invoices" | "stornoed" | "duplicates" | "transmitted" | "not_sent" | "wrong_routing";

type Row = {
  invoice_id: string;
  invoice_number: string;
  patient_name: string;
  invoice_date: string;
  amount: number;
  billing_type: string;
  insurance_name: string;
  insurance_gln: string;
  invoice_status: string;
  sent_to_medidata: boolean;
  submission_status: string;
  final_category: string;
  total_paid: number;
  fully_paid: boolean;
  has_storno: boolean;
  storno_reason: string;
  storno_status: string;
  is_a10_a20: boolean;
  was_resent: boolean;
  replacement_paid: boolean;
  replacement_invoices: string;
  is_duplicate: boolean;
  duplicate_detail: string;
  routing_correct: string;
  routed_to_gln: string;
  routed_to_name: string;
  age_days: number;
  rejection_reason: string;
  bank_paid: number;
  bank_detail: string;
  recommendation: string;
  action_category: string;
};

type ApiResponse = {
  rows: Row[];
  summary: Record<string, number>;
  agingBuckets: Record<string, number>;
  agingAmounts: Record<string, number>;
  recommendationSummary: Record<string, { count: number; amount: number }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  NOT_SENT: "Not Sent",
  DRAFT: "Draft",
  PAID: "Paid",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  TRANSMITTED: "Transmitted (Pending)",
  STORNOED: "Stornoed",
  DUPLICATE: "Duplicate",
  OTHER: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  NOT_SENT: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-slate-50 text-slate-700 border-slate-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  TRANSMITTED: "bg-sky-50 text-sky-700 border-sky-200",
  STORNOED: "bg-purple-50 text-purple-700 border-purple-200",
  DUPLICATE: "bg-orange-50 text-orange-700 border-orange-200",
  OTHER: "bg-slate-50 text-slate-700 border-slate-200",
};

const STORNO_LABELS: Record<string, string> = {
  "N/A": "",
  NOT_RESENT: "Not Resent",
  RESENT_PAID: "Resent & Paid",
  RESENT_NOT_PAID: "Resent, Not Paid",
  PAID_DESPITE_STORNO: "Paid Despite Storno",
  CANCELLED: "Cancelled",
};

const RECOMMENDATION_COLORS: Record<string, string> = {
  "RESEND": "bg-red-50 text-red-700 border-red-200",
  "FIX AND RESEND": "bg-red-50 text-red-700 border-red-200",
  "FIX PATIENT DATA": "bg-orange-50 text-orange-700 border-orange-200",
  "FIX XML": "bg-purple-50 text-purple-700 border-purple-200",
  "REMOVE AND RESEND": "bg-orange-50 text-orange-700 border-orange-200",
  "BILL PATIENT": "bg-amber-50 text-amber-700 border-amber-200",
  "DO NOT RESEND": "bg-slate-100 text-slate-600 border-slate-200",
  "FOLLOW UP": "bg-sky-50 text-sky-700 border-sky-200",
  "CONTACT INSURER": "bg-red-50 text-red-700 border-red-200",
  "SEND": "bg-amber-50 text-amber-700 border-amber-200",
  "ARCHIVE": "bg-slate-100 text-slate-600 border-slate-200",
  "VERIFY": "bg-slate-50 text-slate-600 border-slate-200",
  "WAIT": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "NO ACTION": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "REVIEW": "bg-slate-50 text-slate-600 border-slate-200",
};

export default function MediDataStatusTab({
  filters,
}: {
  filters: StatisticsFilters;
  entities: Provider[];
  doctors: Provider[];
}) {
  const [view, setView] = useState<SubView>("overview");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agingMinDays, setAgingMinDays] = useState(0);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (agingMinDays > 0) p.set("agingMinDays", String(agingMinDays));
    return p.toString();
  }, [filters.from, filters.to, agingMinDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await fetch(`/api/statistics/medidata-status?${queryString}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json: ApiResponse = await resp.json();
        if (cancelled) return;
        setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const s = data?.summary || {};
  const ab = data?.agingBuckets || {};
  const aa = data?.agingAmounts || {};
  const rs = data?.recommendationSummary || {};

  // Filter rows based on sub-view
  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows = data.rows;
    switch (view) {
      case "stornoed":
        return rows.filter((r) => r.has_storno);
      case "duplicates":
        return rows.filter((r) => r.is_duplicate);
      case "transmitted":
        return rows.filter((r) => r.final_category === "TRANSMITTED");
      case "not_sent":
        return rows.filter((r) => !r.sent_to_medidata);
      case "wrong_routing":
        return rows.filter((r) => r.routing_correct === "NO");
      case "all_invoices":
        return rows;
      default:
        return rows;
    }
  }, [data, view]);

  const exportQS = buildQS({
    from: filters.from,
    to: filters.to,
    agingMinDays: agingMinDays > 0 ? String(agingMinDays) : "",
  });

  return (
    <div className="space-y-4">
      {/* Sub-tabs + aging filter + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubTabs<SubView>
          tabs={[
            ["overview", "Overview"],
            ["all_invoices", "All Invoices"],
            ["transmitted", "Transmitted (Pending)"],
            ["stornoed", "Stornoed"],
            ["duplicates", "Duplicates"],
            ["not_sent", "Not Sent"],
            ["wrong_routing", "Wrong Routing"],
          ]}
          active={view}
          onChange={setView}
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-600">
            Min age:
            <select
              value={agingMinDays}
              onChange={(e) => setAgingMinDays(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value={0}>All</option>
              <option value={7}>7+ days</option>
              <option value={30}>30+ days</option>
              <option value={60}>60+ days</option>
              <option value={90}>90+ days</option>
            </select>
          </label>
          <ExportButton href={`/api/statistics/medidata-status/export?${exportQS}`} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {/* Overview KPIs */}
      {view === "overview" && (
        <div className="space-y-4">
          {/* Main KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Total Invoices" value={s.total_invoices ?? "—"} loading={loading} />
            <Kpi label="Total Amount" value={chf(s.total_amount)} loading={loading} />
            <Kpi label="Sent to MediData" value={s.sent ?? "—"} loading={loading} />
            <Kpi label="Not Sent" value={s.not_sent ?? "—"} loading={loading} highlight={s.not_sent > 0} />
            <Kpi label="Duplicates" value={s.duplicates ?? "—"} loading={loading} highlight={s.duplicates > 0} />
            <Kpi label="Wrong Routing" value={s.wrong_routing ?? "—"} loading={loading} highlight={s.wrong_routing > 0} />
          </div>

          {/* Submission status breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Submission Status Breakdown</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <Kpi label="Paid" value={s.paid ?? "—"} loading={loading} highlight />
              <Kpi label="Rejected" value={s.rejected ?? "—"} loading={loading} />
              <Kpi label="Transmitted" value={s.transmitted ?? "—"} loading={loading} />
              <Kpi label="Stornoed" value={s.stornoed ?? "—"} loading={loading} />
              <Kpi label="Not Sent" value={s.not_sent ?? "—"} loading={loading} />
              <Kpi label="Duplicates" value={s.duplicates ?? "—"} loading={loading} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Paid Amount</div>
                <div className="text-sm font-semibold text-emerald-700">{chf(s.paid_amount)}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rejected Amount</div>
                <div className="text-sm font-semibold text-red-700">{chf(s.rejected_amount)}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Transmitted Amount</div>
                <div className="text-sm font-semibold text-sky-700">{chf(s.transmitted_amount)}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Not Sent Amount</div>
                <div className="text-sm font-semibold text-amber-700">{chf(s.not_sent_amount)}</div>
              </div>
            </div>
          </div>

          {/* Aging buckets for transmitted (unpaid) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Aging — Transmitted (Unpaid) Invoices
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["0-7", "0-7 days", "bg-emerald-50 text-emerald-700 border-emerald-200"],
                ["8-30", "8-30 days", "bg-sky-50 text-sky-700 border-sky-200"],
                ["31-60", "31-60 days", "bg-amber-50 text-amber-700 border-amber-200"],
                ["61-90", "61-90 days", "bg-orange-50 text-orange-700 border-orange-200"],
                ["90+", "90+ days", "bg-red-50 text-red-700 border-red-200"],
              ].map(([key, label, color]) => (
                <div key={key} className={`rounded-lg border px-3 py-2.5 ${color}`}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
                  <div className="mt-0.5 text-lg font-bold">{ab[key] ?? 0}</div>
                  <div className="text-xs font-medium opacity-80">{chf(aa[key] || 0)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Storno summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Stornoed Invoices</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <Kpi label="Total Stornoed" value={s.stornoed ?? "—"} loading={loading} />
              <Kpi label="Not Resent" value={s.stornoed_not_resent ?? "—"} loading={loading} highlight={s.stornoed_not_resent > 0} />
              <Kpi label="Resent & Paid" value={s.stornoed_resent_paid ?? "—"} loading={loading} />
              <Kpi label="Resent, Not Paid" value={s.stornoed_resent_not_paid ?? "—"} loading={loading} />
              <Kpi label="A10/A20 Related" value={s.stornoed_a10_a20 ?? "—"} loading={loading} />
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                  Not Resent Amount
                </div>
                <div className="mt-0.5 text-base font-semibold text-red-700">
                  {loading ? "…" : chf(s.stornoed_not_resent_amount)}
                </div>
              </div>
            </div>
          </div>

          {/* Wrong routing breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Wrong Routing Breakdown</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Total Wrong Routing" value={s.wrong_routing ?? "—"} loading={loading} highlight={s.wrong_routing > 0} />
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                  Still Unpaid
                </div>
                <div className="mt-0.5 text-base font-semibold text-red-700">
                  {loading ? "…" : s.wrong_routing_unpaid ?? "—"}
                </div>
                <div className="text-xs font-medium text-red-600">{chf(s.wrong_routing_unpaid_amount)}</div>
              </div>
              <Kpi label="Paid Despite Wrong Routing" value={s.wrong_routing_paid ?? "—"} loading={loading} />
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Wrong Routing Total Amount
                </div>
                <div className="mt-0.5 text-base font-semibold text-slate-900">
                  {loading ? "…" : chf(s.wrong_routing_amount)}
                </div>
              </div>
            </div>
          </div>

          {/* Action needed summary */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-amber-900">Action Needed</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Resend: stornoed not resent */}
              <div className="rounded-lg border border-red-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">Resend</span>
                  <span className="text-xs font-semibold text-slate-700">Stornoed, never resent</span>
                </div>
                <div className="mt-1 text-lg font-bold text-red-700">{s.action_resend_stornoed ?? 0}</div>
                <div className="text-xs text-slate-500">{chf(s.action_resend_stornoed_amount)} outstanding</div>
              </div>

              {/* Resend: wrong routing unpaid */}
              <div className="rounded-lg border border-red-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">Resend</span>
                  <span className="text-xs font-semibold text-slate-700">Wrong routing, still unpaid</span>
                </div>
                <div className="mt-1 text-lg font-bold text-red-700">{s.action_resend_wrong_routing ?? 0}</div>
                <div className="text-xs text-slate-500">{chf(s.action_resend_wrong_routing_amount)} outstanding</div>
              </div>

              {/* Follow up: transmitted correct routing */}
              <div className="rounded-lg border border-sky-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">Follow up</span>
                  <span className="text-xs font-semibold text-slate-700">Transmitted, insurer unresponsive</span>
                </div>
                <div className="mt-1 text-lg font-bold text-sky-700">{s.action_follow_up_transmitted ?? 0}</div>
                <div className="text-xs text-slate-500">{chf(s.action_follow_up_transmitted_amount)} pending</div>
              </div>

              {/* Follow up: rejected not paid */}
              <div className="rounded-lg border border-orange-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">Follow up</span>
                  <span className="text-xs font-semibold text-slate-700">Rejected, not yet paid</span>
                </div>
                <div className="mt-1 text-lg font-bold text-orange-700">{s.action_follow_up_rejected ?? 0}</div>
                <div className="text-xs text-slate-500">{chf(s.action_follow_up_rejected_amount)} at risk</div>
              </div>

              {/* Archive: duplicates */}
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700">Archive</span>
                  <span className="text-xs font-semibold text-slate-700">Duplicates (paid replacement exists)</span>
                </div>
                <div className="mt-1 text-lg font-bold text-slate-700">{s.action_archive_duplicates ?? 0}</div>
                <div className="text-xs text-slate-500">{chf(s.action_archive_duplicates_amount)} to archive</div>
              </div>

              {/* Send: not sent */}
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Send</span>
                  <span className="text-xs font-semibold text-slate-700">Not yet sent to MediData</span>
                </div>
                <div className="mt-1 text-lg font-bold text-amber-700">{s.action_send_not_sent ?? 0}</div>
                <div className="text-xs text-slate-500">{chf(s.action_send_not_sent_amount)} to send</div>
              </div>
            </div>
          </div>

          {/* Recommendation summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Accountant Recommendations</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Action</Th>
                    <Th align="right">Invoices</Th>
                    <Th align="right">Amount (CHF)</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">Loading…</td></tr>
                  )}
                  {!loading && Object.keys(rs).length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">No data</td></tr>
                  )}
                  {!loading && Object.entries(rs)
                    .sort((a, b) => (b[1].amount - a[1].amount))
                    .map(([cat, val]) => {
                      const color = RECOMMENDATION_COLORS[cat] || "bg-slate-50 text-slate-700 border-slate-200";
                      return (
                        <tr key={cat} className="hover:bg-slate-50">
                          <Td>
                            <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
                              {cat}
                            </span>
                          </Td>
                          <Td align="right">{val.count}</Td>
                          <Td align="right">{chf(val.amount)}</Td>
                        </tr>
                      );
                    })}
                </tbody>
                {!loading && Object.keys(rs).length > 0 && (
                  <tfoot className="bg-slate-50">
                    <tr className="font-semibold">
                      <Td>TOTAL</Td>
                      <Td align="right">{Object.values(rs).reduce((s, v) => s + v.count, 0)}</Td>
                      <Td align="right">{chf(Object.values(rs).reduce((s, v) => s + v.amount, 0))}</Td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Table views */}
      {view !== "overview" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <Th>Patient</Th>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
                <Th>Insurance</Th>
                <Th>Status</Th>
                {view === "stornoed" && <Th>Storno Status</Th>}
                {view === "stornoed" && <Th>Storno Reason</Th>}
                {view === "stornoed" && <Th>Resent?</Th>}
                {view === "duplicates" && <Th>Duplicate Detail</Th>}
                {view === "transmitted" && <Th align="right">Age (days)</Th>}
                {view === "transmitted" && <Th align="right">Paid</Th>}
                {view === "wrong_routing" && <Th>Routed To</Th>}
                {view === "wrong_routing" && <Th>User GLN</Th>}
                {view === "wrong_routing" && <Th>Paid?</Th>}
                {view === "not_sent" && <Th>Billing Type</Th>}
                <Th align="right">Total Paid</Th>
                <Th>Recommendation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-slate-400">
                    No invoices found
                  </td>
                </tr>
              )}
              {!loading &&
                filteredRows.map((r) => (
                  <tr key={r.invoice_id} className="hover:bg-slate-50">
                    <Td>{r.patient_name}</Td>
                    <Td>{r.invoice_number}</Td>
                    <Td>{r.invoice_date}</Td>
                    <Td align="right">{chf(r.amount)}</Td>
                    <Td className="max-w-[180px] truncate">{r.insurance_name}</Td>
                    <Td>
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                          CATEGORY_COLORS[r.final_category] || CATEGORY_COLORS.OTHER
                        }`}
                      >
                        {CATEGORY_LABELS[r.final_category] || r.final_category}
                      </span>
                    </Td>
                    {view === "stornoed" && (
                      <Td>
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                            r.storno_status === "NOT_RESENT"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : r.storno_status === "RESENT_PAID"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {STORNO_LABELS[r.storno_status] || r.storno_status}
                        </span>
                      </Td>
                    )}
                    {view === "stornoed" && (
                      <Td className="max-w-[200px] truncate" >
                        <span title={r.storno_reason}>{r.storno_reason}</span>
                        {r.is_a10_a20 && (
                          <span className="ml-1 rounded bg-orange-100 px-1 text-[9px] font-semibold text-orange-700">
                            A10/A20
                          </span>
                        )}
                      </Td>
                    )}
                    {view === "stornoed" && (
                      <Td>
                        {r.was_resent ? (
                          <span className="text-emerald-600">
                            Yes ({r.replacement_invoices})
                            {r.replacement_paid ? " ✓ Paid" : " ⏳ Not paid"}
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">No</span>
                        )}
                      </Td>
                    )}
                    {view === "duplicates" && <Td>{r.duplicate_detail}</Td>}
                    {view === "transmitted" && <Td align="right">{r.age_days}</Td>}
                    {view === "transmitted" && <Td align="right">{chf(r.total_paid)}</Td>}
                    {view === "wrong_routing" && (
                      <Td>
                        <div className="text-xs">{r.routed_to_name}</div>
                        <div className="text-[10px] text-slate-400">{r.routed_to_gln}</div>
                      </Td>
                    )}
                    {view === "wrong_routing" && (
                      <Td className="text-[10px] text-slate-500">{r.insurance_gln}</Td>
                    )}
                    {view === "wrong_routing" && (
                      <Td>
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            r.fully_paid
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {r.fully_paid ? "Yes" : "No — unpaid"}
                        </span>
                      </Td>
                    )}
                    {view === "not_sent" && <Td>{r.billing_type}</Td>}
                    <Td align="right">{chf(r.total_paid)}</Td>
                    <Td className="max-w-[300px]">
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                          RECOMMENDATION_COLORS[r.action_category] || RECOMMENDATION_COLORS.REVIEW
                        }`}
                      >
                        {r.action_category}
                      </span>
                      <div className="mt-1 text-[10px] text-slate-500" title={r.recommendation}>
                        {r.recommendation.substring(0, 120)}
                        {r.recommendation.length > 120 ? "…" : ""}
                      </div>
                    </Td>
                  </tr>
                ))}
            </tbody>
            {!loading && filteredRows.length > 0 && (
              <tfoot className="bg-slate-50">
                <tr className="font-semibold">
                  <Td>Total ({filteredRows.length})</Td>
                  <Td>{""}</Td>
                  <Td>{""}</Td>
                  <Td align="right">{chf(filteredRows.reduce((s, r) => s + r.amount, 0))}</Td>
                  <td colSpan={10} className="px-3 py-1.5 text-right text-slate-700 tabular-nums">
                    Paid: {chf(filteredRows.reduce((s, r) => s + r.total_paid, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
