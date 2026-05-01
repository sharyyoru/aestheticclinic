"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ===== Types =====
type UnlinkedInvoice = {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  title: string | null;
  created_by_name: string | null;
  created_at: string;
  patient_id: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_dob: string | null;
  doctor_name: string | null;
  provider_name: string | null;
};

type PatientConsultation = {
  consultation_id: string;
  title: string | null;
  scheduled_at: string;
  doctor_name: string | null;
  record_type: string;
  linked_invoice_id: string | null;
  linked_invoice_number: string | null;
  linked_invoice_total: number | null;
};

const YEAR_OPTIONS = ["", "2026", "2025", "2024", "2023", "2022", "2021"];

function chf(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
  }).format(Number(n));
}

function shortDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fullDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function InvoiceLinkerPage() {
  const [invoices, setInvoices] = useState<UnlinkedInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const [selected, setSelected] = useState<UnlinkedInvoice | null>(null);
  const [consultations, setConsultations] = useState<PatientConsultation[]>([]);
  const [loadingConsults, setLoadingConsults] = useState(false);
  const [consultsError, setConsultsError] = useState<string | null>(null);

  const [linking, setLinking] = useState(false);
  const [toast, setToast] = useState<
    | null
    | { tone: "success" | "error" | "info"; message: string }
  >(null);

  // ----- Load unlinked invoices -----
  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    setInvoicesError(null);
    try {
      const qs = new URLSearchParams();
      if (yearFilter) qs.set("year", yearFilter);
      if (search.trim()) qs.set("q", search.trim());
      qs.set("limit", "500");
      const res = await fetch(`/api/invoice-linker/unlinked-invoices?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setInvoices(json.rows || []);
    } catch (e: any) {
      setInvoicesError(e.message || "Unknown error");
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [search, yearFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ----- Client-side patient name filter (server handles invoice_number/title) -----
  const filteredInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((i) => {
      const name = `${i.patient_first_name ?? ""} ${i.patient_last_name ?? ""}`
        .toLowerCase()
        .trim();
      return (
        name.includes(needle) ||
        (i.invoice_number || "").toLowerCase().includes(needle) ||
        (i.title || "").toLowerCase().includes(needle)
      );
    });
  }, [invoices, search]);

  // ----- Load consultations when invoice selected -----
  const loadConsultations = useCallback(async (patientId: string) => {
    setLoadingConsults(true);
    setConsultsError(null);
    try {
      const qs = new URLSearchParams({ patientId });
      const res = await fetch(
        `/api/invoice-linker/patient-consultations?${qs.toString()}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setConsultations(json.rows || []);
    } catch (e: any) {
      setConsultsError(e.message || "Unknown error");
      setConsultations([]);
    } finally {
      setLoadingConsults(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.patient_id) {
      loadConsultations(selected.patient_id);
    } else {
      setConsultations([]);
    }
  }, [selected?.patient_id, loadConsultations]);

  // ----- Link action -----
  async function doLink(consult: PatientConsultation) {
    if (!selected) return;

    // If consultation is already linked, confirm
    let force = false;
    if (consult.linked_invoice_id) {
      const ok = window.confirm(
        `This consultation is already linked to invoice #${consult.linked_invoice_number}.\n\n` +
          `Linking invoice #${selected.invoice_number} here will UNLINK invoice #${consult.linked_invoice_number} first.\n\nContinue?`,
      );
      if (!ok) return;
      force = true;
    }

    setLinking(true);
    setToast(null);
    try {
      const res = await fetch("/api/invoice-linker/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: selected.invoice_id,
          consultation_id: consult.consultation_id,
          force,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Handle 409 ALREADY_LINKED by re-prompting
        if (res.status === 409 && json.code === "ALREADY_LINKED") {
          const ok = window.confirm(
            `Invoice #${json.existing_invoice_number} is already linked to this consultation.\n\nUnlink it and link #${selected.invoice_number} instead?`,
          );
          if (!ok) {
            setLinking(false);
            return;
          }
          // retry with force
          const res2 = await fetch("/api/invoice-linker/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoice_id: selected.invoice_id,
              consultation_id: consult.consultation_id,
              force: true,
            }),
          });
          const json2 = await res2.json();
          if (!res2.ok) throw new Error(json2.error || "Link failed");
        } else {
          throw new Error(json.error || "Link failed");
        }
      }
      setToast({
        tone: "success",
        message: `Invoice #${selected.invoice_number} linked successfully.`,
      });
      // Remove the invoice from the unlinked list and clear selection
      setInvoices((prev) =>
        prev.filter((i) => i.invoice_id !== selected.invoice_id),
      );
      setSelected(null);
      setConsultations([]);
    } catch (e: any) {
      setToast({ tone: "error", message: e.message || "Unknown error" });
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-60px)] flex-col gap-3 px-4 py-4 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">
          Invoice ↔ Consultation Linker
        </h1>
        <p className="text-sm text-slate-500">
          Link invoices to the consultations they were created from. One
          consultation can only have one invoice — re-linking unlinks the
          previous one.
        </p>
      </header>

      {toast && (
        <div
          className={
            "rounded-md border px-3 py-2 text-sm " +
            (toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-sky-200 bg-sky-50 text-sky-900")
          }
        >
          {toast.message}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-5">
        {/* ---------- LEFT: unlinked invoices ---------- */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <div className="space-y-2 border-b border-slate-100 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Unlinked invoices
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {filteredInvoices.length}
                {filteredInvoices.length !== invoices.length ? `/${invoices.length}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                placeholder="Search invoice #, title, patient name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y || "all"} value={y}>
                    {y || "All years"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingInvoices ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Loading…
              </div>
            ) : invoicesError ? (
              <div className="p-4 text-xs text-rose-700">{invoicesError}</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No unlinked invoices.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const active = selected?.invoice_id === inv.invoice_id;
                  return (
                    <li key={inv.invoice_id}>
                      <button
                        type="button"
                        onClick={() => setSelected(inv)}
                        className={
                          "w-full px-3 py-2.5 text-left transition-colors " +
                          (active
                            ? "bg-sky-50 ring-2 ring-inset ring-sky-400"
                            : "hover:bg-slate-50")
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            #{inv.invoice_number}
                          </span>
                          <span className="text-xs font-medium text-slate-600">
                            {chf(inv.total_amount)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>{shortDate(inv.invoice_date)}</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                            {inv.status}
                          </span>
                        </div>
                        {(inv.patient_first_name || inv.patient_last_name) && (
                          <div className="mt-1 truncate text-xs text-slate-700">
                            {inv.patient_first_name} {inv.patient_last_name}
                          </div>
                        )}
                        {inv.title && (
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            {inv.title}
                          </div>
                        )}
                        {inv.created_by_name && (
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            by {inv.created_by_name}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ---------- RIGHT: patient consultations ---------- */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-3">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
              Select an invoice on the left to view the patient's consultations.
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Consultations for{" "}
                      <span className="text-sky-700">
                        {selected.patient_first_name} {selected.patient_last_name}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Linking invoice <strong>#{selected.invoice_number}</strong>{" "}
                      ({chf(selected.total_amount)}, {shortDate(selected.invoice_date)})
                      {selected.title ? ` — ${selected.title}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {loadingConsults ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Loading consultations…
                  </div>
                ) : consultsError ? (
                  <div className="p-4 text-xs text-rose-700">{consultsError}</div>
                ) : consultations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No consultations found for this patient.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {consultations.map((c) => {
                      const isLinkedElsewhere = !!c.linked_invoice_id;
                      return (
                        <li
                          key={c.consultation_id}
                          className={
                            "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm " +
                            (isLinkedElsewhere
                              ? "border-amber-200 bg-amber-50/50"
                              : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/30")
                          }
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {c.record_type}
                              </span>
                              <span className="text-xs font-medium text-slate-900">
                                {fullDate(c.scheduled_at)}
                              </span>
                              {c.doctor_name && (
                                <span className="text-xs text-slate-600">
                                  · {c.doctor_name}
                                </span>
                              )}
                            </div>
                            {c.title && (
                              <div className="mt-1 truncate text-xs text-slate-700">
                                {c.title}
                              </div>
                            )}
                            <div className="mt-1 font-mono text-[10px] text-slate-400">
                              {c.consultation_id}
                            </div>
                            {isLinkedElsewhere && (
                              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Already linked to invoice #
                                {c.linked_invoice_number}
                                {c.linked_invoice_total != null
                                  ? ` (${chf(c.linked_invoice_total)})`
                                  : ""}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={linking}
                            onClick={() => doLink(c)}
                            className={
                              "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors " +
                              (isLinkedElsewhere
                                ? "border border-amber-400 bg-white text-amber-800 hover:bg-amber-50"
                                : "bg-sky-600 text-white hover:bg-sky-700") +
                              (linking ? " opacity-50" : "")
                            }
                          >
                            {isLinkedElsewhere ? "Re-link" : "Link"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
