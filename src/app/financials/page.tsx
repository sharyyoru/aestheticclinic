"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type InvoiceRow = {
  id: string;
  patient_id: string | null;
  title: string | null;
  content: string | null;
  record_type: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  scheduled_at: string | null;
  payment_method: string | null;
  invoice_total_amount: number | null;
  invoice_is_complimentary: boolean | null;
  invoice_is_paid: boolean | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  is_archived: boolean | null;
};

type PatientInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type PatientsById = Record<string, PatientInfo>;

type NormalizedInvoice = InvoiceRow & {
  amount: number;
  isComplimentaryDerived: boolean;
  isPaidDerived: boolean;
  patientName: string;
  ownerKey: string;
  ownerLabel: string;
  statusLabel: string;
};

type Summary = {
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  totalComplimentary: number;
  invoiceCount: number;
};

type PatientSummaryRow = {
  patientId: string;
  patientName: string;
  invoiceCount: number;
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  totalComplimentary: number;
};

type OwnerSummaryRow = {
  ownerKey: string;
  ownerLabel: string;
  invoiceCount: number;
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  totalComplimentary: number;
};

function extractInvoiceInfoFromContent(content: string | null): {
  total: number;
  isComplimentary: boolean;
} {
  if (!content) {
    return { total: 0, isComplimentary: false };
  }

  const html = content;

  const isComplimentary =
    html.includes("Extra option:</strong> Complimentary service") ||
    html.includes("Extra option:</strong> Complimentary Service");

  let total = 0;
  const match = html.match(
    /Estimated total:<\/strong>\s*CHF\s*([0-9]+(?:\.[0-9]{1,2})?)/,
  );
  if (match) {
    const parsed = Number.parseFloat(match[1].replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) {
      total = parsed;
    }
  }

  return { total, isComplimentary };
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0.00 CHF";
  return `${amount.toFixed(2)} CHF`;
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FinancialsPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [patientsById, setPatientsById] = useState<PatientsById>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: invoicesError } = await supabaseClient
          .from("consultations")
          .select(
            "id, patient_id, title, content, record_type, doctor_user_id, doctor_name, scheduled_at, payment_method, invoice_total_amount, invoice_is_complimentary, invoice_is_paid, created_by_user_id, created_by_name, is_archived",
          )
          .eq("record_type", "invoice")
          .eq("is_archived", false)
          .order("scheduled_at", { ascending: false });

        if (!isMounted) return;

        if (invoicesError || !data) {
          setError(invoicesError?.message ?? "Failed to load invoices.");
          setInvoices([]);
          setPatientsById({});
          setLoading(false);
          return;
        }

        const rows = data as InvoiceRow[];
        setInvoices(rows);

        const patientIds = Array.from(
          new Set(
            rows
              .map((row) => row.patient_id)
              .filter((id): id is string => typeof id === "string" && !!id),
          ),
        );

        if (patientIds.length > 0) {
          const { data: patientsData, error: patientsError } =
            await supabaseClient
              .from("patients")
              .select("id, first_name, last_name")
              .in("id", patientIds);

          if (!isMounted) return;

          if (!patientsError && patientsData) {
            const map: PatientsById = {};
            for (const row of patientsData as any[]) {
              const id = row.id as string;
              map[id] = {
                id,
                first_name: (row.first_name as string | null) ?? null,
                last_name: (row.last_name as string | null) ?? null,
              };
            }
            setPatientsById(map);
          } else {
            setPatientsById({});
          }
        } else {
          setPatientsById({});
        }

        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load invoices.");
        setInvoices([]);
        setPatientsById({});
        setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedInvoices = useMemo<NormalizedInvoice[]>(() => {
    if (!invoices || invoices.length === 0) return [];

    return invoices.map((row) => {
      const patient = row.patient_id ? patientsById[row.patient_id] : undefined;
      const nameParts = [
        patient?.first_name ? patient.first_name.trim() : "",
        patient?.last_name ? patient.last_name.trim() : "",
      ].filter(Boolean);
      const patientName =
        nameParts.join(" ") || row.patient_id || "Unknown patient";

      const { total: parsedTotal, isComplimentary: parsedComplimentary } =
        extractInvoiceInfoFromContent(row.content ?? null);

      let amount = 0;
      const rawAmount = row.invoice_total_amount;
      if (rawAmount !== null && rawAmount !== undefined) {
        const numeric = Number(rawAmount);
        if (Number.isFinite(numeric) && numeric > 0) {
          amount = numeric;
        }
      } else if (parsedTotal > 0) {
        amount = parsedTotal;
      }

      const isComplimentary =
        ((typeof row.invoice_is_complimentary === "boolean"
          ? row.invoice_is_complimentary
          : false) || parsedComplimentary) && amount > 0;

      const isPaid =
        typeof row.invoice_is_paid === "boolean" ? row.invoice_is_paid : false;

      const ownerKey =
        (row.doctor_user_id || row.created_by_user_id || "unknown") ??
        "unknown";

      const ownerLabel =
        row.doctor_name ||
        row.created_by_name ||
        (ownerKey === "unknown" ? "Unassigned" : ownerKey);

      const statusLabel = isComplimentary
        ? "Complimentary"
        : isPaid
        ? "Paid"
        : "Unpaid";

      return {
        ...row,
        amount,
        isComplimentaryDerived: isComplimentary,
        isPaidDerived: isPaid,
        patientName,
        ownerKey,
        ownerLabel,
        statusLabel,
      };
    });
  }, [invoices, patientsById]);

  const patientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of normalizedInvoices) {
      if (!row.patient_id) continue;
      if (!map.has(row.patient_id)) {
        map.set(row.patient_id, row.patientName);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [normalizedInvoices]);

  const ownerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of normalizedInvoices) {
      const key = row.ownerKey || "unknown";
      if (!map.has(key)) {
        map.set(key, row.ownerLabel || "Unassigned");
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [normalizedInvoices]);

  const filteredInvoices = useMemo(() => {
    return normalizedInvoices.filter((row) => {
      if (patientFilter !== "all" && row.patient_id !== patientFilter) {
        return false;
      }
      if (ownerFilter !== "all" && row.ownerKey !== ownerFilter) {
        return false;
      }
      if (showOnlyUnpaid) {
        if (row.isComplimentaryDerived) return false;
        if (row.isPaidDerived) return false;
      }
      return true;
    });
  }, [normalizedInvoices, patientFilter, ownerFilter, showOnlyUnpaid]);

  const summary: Summary = useMemo(() => {
    let totalAmount = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalComplimentary = 0;
    let invoiceCount = 0;

    for (const row of filteredInvoices) {
      const amount = row.amount;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      invoiceCount += 1;

      if (row.isComplimentaryDerived) {
        totalComplimentary += amount;
        continue;
      }

      totalAmount += amount;

      if (row.isPaidDerived) {
        totalPaid += amount;
      } else {
        totalUnpaid += amount;
      }
    }

    return { totalAmount, totalPaid, totalUnpaid, totalComplimentary, invoiceCount };
  }, [filteredInvoices]);

  const patientSummaryRows: PatientSummaryRow[] = useMemo(() => {
    const byPatient = new Map<string, PatientSummaryRow>();

    for (const row of filteredInvoices) {
      if (!row.patient_id) continue;

      const existing = byPatient.get(row.patient_id) || {
        patientId: row.patient_id,
        patientName: row.patientName,
        invoiceCount: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        totalComplimentary: 0,
      };

      const amount = row.amount;
      if (Number.isFinite(amount) && amount > 0) {
        existing.invoiceCount += 1;

        if (row.isComplimentaryDerived) {
          existing.totalComplimentary += amount;
        } else {
          existing.totalAmount += amount;
          if (row.isPaidDerived) {
            existing.totalPaid += amount;
          } else {
            existing.totalUnpaid += amount;
          }
        }
      }

      byPatient.set(row.patient_id, existing);
    }

    return Array.from(byPatient.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
  }, [filteredInvoices]);

  const ownerSummaryRows: OwnerSummaryRow[] = useMemo(() => {
    const byOwner = new Map<string, OwnerSummaryRow>();

    for (const row of filteredInvoices) {
      const key = row.ownerKey || "unknown";
      const label = row.ownerLabel || "Unassigned";

      let existing = byOwner.get(key);
      if (!existing) {
        existing = {
          ownerKey: key,
          ownerLabel: label,
          invoiceCount: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          totalComplimentary: 0,
        };
      }

      const amount = row.amount;
      if (Number.isFinite(amount) && amount > 0) {
        existing.invoiceCount += 1;

        if (row.isComplimentaryDerived) {
          existing.totalComplimentary += amount;
        } else {
          existing.totalAmount += amount;
          if (row.isPaidDerived) {
            existing.totalPaid += amount;
          } else {
            existing.totalUnpaid += amount;
          }
        }
      }

      byOwner.set(key, existing);
    }

    return Array.from(byOwner.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
  }, [filteredInvoices]);

  function handleExportPdf() {
    if (typeof window === "undefined") return;
    window.print();
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 financials-hide-on-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Financials</h1>
          <p className="text-sm text-slate-500">
            Overview of revenue, invoices, and outstanding balances across all
            patients.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Export current view (PDF)
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 financials-hide-on-print">
        <select
          value={patientFilter}
          onChange={(event) => setPatientFilter(event.target.value)}
          className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All patients</option>
          {patientOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
          className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All invoice owners</option>
          {ownerOptions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showOnlyUnpaid}
            onChange={(event) => setShowOnlyUnpaid(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Show only unpaid invoices</span>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        {loading ? (
          <p className="text-[11px] text-slate-500">Loading financial data...</p>
        ) : error ? (
          <p className="text-[11px] text-red-600">{error}</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 financials-hide-on-print">
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Total billed (non-complimentary)
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatCurrency(summary.totalAmount)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Total paid
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Outstanding (unpaid)
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatCurrency(summary.totalUnpaid)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[11px] font-medium text-slate-500">
                  Complimentary value
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {formatCurrency(summary.totalComplimentary)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-slate-900">
                    Patients
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    Financial summary per patient.
                  </p>
                </div>
                {patientSummaryRows.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No invoices for the current filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="border-b text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Patient</th>
                          <th className="py-1.5 pr-3 font-medium">Invoices</th>
                          <th className="py-1.5 pr-3 font-medium">Billed</th>
                          <th className="py-1.5 pr-3 font-medium">Paid</th>
                          <th className="py-1.5 pr-0 font-medium">Unpaid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patientSummaryRows.map((row) => (
                          <tr key={row.patientId} className="align-top">
                            <td className="py-1.5 pr-3 text-slate-900">
                              {row.patientName}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {row.invoiceCount}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {formatCurrency(row.totalAmount)}
                            </td>
                            <td className="py-1.5 pr-3 text-emerald-700">
                              {formatCurrency(row.totalPaid)}
                            </td>
                            <td className="py-1.5 pr-0 text-amber-700">
                              {formatCurrency(row.totalUnpaid)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-slate-900">
                    Invoice owners
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    Who is generating the most revenue.
                  </p>
                </div>
                {ownerSummaryRows.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No invoices for the current filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="border-b text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-1.5 pr-3 font-medium">Owner</th>
                          <th className="py-1.5 pr-3 font-medium">Invoices</th>
                          <th className="py-1.5 pr-3 font-medium">Billed</th>
                          <th className="py-1.5 pr-0 font-medium">Paid %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ownerSummaryRows.map((row) => {
                          const paidPercent =
                            row.totalAmount > 0
                              ? Math.round(
                                  (row.totalPaid / row.totalAmount) * 100,
                                )
                              : 0;
                          return (
                            <tr key={row.ownerKey} className="align-top">
                              <td className="py-1.5 pr-3 text-slate-900">
                                {row.ownerLabel}
                              </td>
                              <td className="py-1.5 pr-3 text-slate-700">
                                {row.invoiceCount}
                              </td>
                              <td className="py-1.5 pr-3 text-slate-700">
                                {formatCurrency(row.totalAmount)}
                              </td>
                              <td className="py-1.5 pr-0 text-slate-700">
                                {paidPercent}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-900">Invoices</h2>
                <p className="text-[10px] text-slate-500">
                  Showing {filteredInvoices.length} of {normalizedInvoices.length}
                  {" "}
                  invoices.
                </p>
              </div>
              {filteredInvoices.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No invoices match the current filters.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-[11px]">
                    <thead className="border-b text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-1.5 pr-3 font-medium">Date</th>
                        <th className="py-1.5 pr-3 font-medium">Patient</th>
                        <th className="py-1.5 pr-3 font-medium">Owner</th>
                        <th className="py-1.5 pr-3 font-medium">Title</th>
                        <th className="py-1.5 pr-3 font-medium">Payment</th>
                        <th className="py-1.5 pr-3 font-medium">Amount</th>
                        <th className="py-1.5 pr-0 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className="align-top">
                          <td className="py-1.5 pr-3 text-slate-700">
                            {formatShortDate(invoice.scheduled_at)}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-900">
                            {invoice.patientName}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-700">
                            {invoice.ownerLabel}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-700">
                            {invoice.title || "Invoice"}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-700">
                            {invoice.payment_method || "-"}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-900">
                            {invoice.amount > 0
                              ? formatCurrency(invoice.amount)
                              : "-"}
                          </td>
                          <td className="py-1.5 pr-0">
                            <span
                              className={
                                invoice.isComplimentaryDerived
                                  ? "inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-50"
                                  : invoice.isPaidDerived
                                  ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                                  : "inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                              }
                            >
                              {invoice.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <style jsx global>{`
        @media print {
          .financials-hide-on-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
