"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceStatus = "OPEN" | "PAID" | "CANCELLED" | "PARTIAL_PAID" | "PARTIAL_LOSS" | "OVERPAID";

type InvoiceRow = {
  id: string;
  patient_id: string | null;
  invoice_number: string;
  invoice_date: string | null;
  doctor_user_id: string | null;
  doctor_name: string | null;
  provider_id: string | null;
  provider_name: string | null;
  payment_method: string | null;
  total_amount: number;
  paid_amount: number | null;
  status: InvoiceStatus;
  is_complimentary: boolean;
  pdf_path: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  is_archived: boolean;
  health_insurance_law: string | null;
  billing_type: string | null;
};

type PatientInfo = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type PatientsById = Record<string, PatientInfo>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0.00";
  return amount.toFixed(2);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function statusBadge(status: InvoiceStatus, isComplimentary: boolean) {
  if (isComplimentary) return { label: "Complimentary", cls: "bg-purple-50 text-purple-700 border-purple-200" };
  switch (status) {
    case "PAID": return { label: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "PARTIAL_PAID": return { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "PARTIAL_LOSS": return { label: "Partial Loss", cls: "bg-orange-50 text-orange-700 border-orange-200" };
    case "OVERPAID": return { label: "Overpaid", cls: "bg-sky-50 text-sky-700 border-sky-200" };
    case "CANCELLED": return { label: "Cancelled", cls: "bg-slate-100 text-slate-500 border-slate-200" };
    default: return { label: "Open", cls: "bg-red-50 text-red-700 border-red-200" };
  }
}

const RECEIPT_STATUSES: InvoiceStatus[] = ["PAID", "PARTIAL_PAID", "PARTIAL_LOSS", "OVERPAID"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [patientsById, setPatientsById] = useState<PatientsById>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const ROWS_PER_PAGE = 50;
  const [page, setPage] = useState(0);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Action states
  const [generatingPdf, setGeneratingPdf] = useState<Set<string>>(new Set());
  const [sendingEmail, setSendingEmail] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabaseClient
          .from("invoices")
          .select("id, patient_id, invoice_number, invoice_date, doctor_user_id, doctor_name, provider_id, provider_name, payment_method, total_amount, paid_amount, status, is_complimentary, pdf_path, created_by_user_id, created_by_name, is_archived, health_insurance_law, billing_type")
          .eq("is_archived", false)
          .is("parent_invoice_id", null)
          .order("invoice_date", { ascending: false });

        if (!isMounted) return;
        if (err || !data) { setError(err?.message ?? "Failed to load"); setInvoices([]); setLoading(false); return; }

        const rows = data as InvoiceRow[];
        setInvoices(rows);

        // Fetch patients
        const patientIds = Array.from(new Set(rows.map(r => r.patient_id).filter(Boolean) as string[]));
        if (patientIds.length > 0) {
          const map: PatientsById = {};
          const BATCH = 50;
          for (let i = 0; i < patientIds.length; i += BATCH) {
            if (!isMounted) return;
            const batch = patientIds.slice(i, i + BATCH);
            const { data: pd } = await supabaseClient.from("patients").select("id, first_name, last_name, email").in("id", batch);
            if (pd) for (const p of pd as any[]) map[p.id] = { id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email };
          }
          if (isMounted) setPatientsById(map);
        }
        setLoading(false);
      } catch {
        if (isMounted) { setError("Failed to load invoices."); setInvoices([]); setLoading(false); }
      }
    }

    void load();
    return () => { isMounted = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived / filtered data
  // ---------------------------------------------------------------------------

  const patientName = useCallback((pid: string | null) => {
    if (!pid) return "Unknown";
    const p = patientsById[pid];
    if (!p) return pid.slice(0, 8);
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
  }, [patientsById]);

  const patientEmail = useCallback((pid: string | null) => {
    if (!pid) return null;
    return patientsById[pid]?.email ?? null;
  }, [patientsById]);

  const paymentMethods = useMemo(() => {
    const s = new Set<string>();
    for (const r of invoices) if (r.payment_method) s.add(r.payment_method);
    return Array.from(s).sort();
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return invoices.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (paymentMethodFilter !== "all" && r.payment_method !== paymentMethodFilter) return false;
      if (dateFrom && r.invoice_date && r.invoice_date < dateFrom) return false;
      if (dateTo && r.invoice_date && r.invoice_date > dateTo) return false;
      if (q) {
        const pName = patientName(r.patient_id).toLowerCase();
        const invNum = (r.invoice_number || "").toLowerCase();
        const docName = (r.doctor_name || "").toLowerCase();
        if (!pName.includes(q) && !invNum.includes(q) && !docName.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, search, statusFilter, paymentMethodFilter, dateFrom, dateTo, patientName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return filtered.slice(start, start + ROWS_PER_PAGE);
  }, [filtered, page]);

  // Summary
  const summary = useMemo(() => {
    let total = 0, paid = 0, unpaid = 0, count = 0;
    for (const r of filtered) {
      if (r.is_complimentary) continue;
      const amt = Number(r.total_amount) || 0;
      if (amt <= 0) continue;
      count++;
      total += amt;
      const pa = Number(r.paid_amount) || 0;
      paid += pa;
      unpaid += amt - pa;
    }
    return { total, paid, unpaid, count };
  }, [filtered]);

  // Reset page on filter change
  useEffect(() => { setPage(0); setSelected(new Set()); }, [search, statusFilter, paymentMethodFilter, dateFrom, dateTo]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map(r => r.id)));
    }
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleViewPdf = (pdfPath: string) => {
    const { data } = supabaseClient.storage.from("invoice-pdfs").getPublicUrl(pdfPath);
    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
  };

  const handleGeneratePdf = async (invoiceId: string) => {
    setGeneratingPdf(prev => new Set(prev).add(invoiceId));
    try {
      const res = await fetch("/api/invoices/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
        setInvoices(prev => prev.map(r => r.id === invoiceId ? { ...r, pdf_path: data.pdfPath || r.pdf_path } : r));
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to generate PDF");
    } finally {
      setGeneratingPdf(prev => { const n = new Set(prev); n.delete(invoiceId); return n; });
    }
  };

  const handleSendEmail = async (invoice: InvoiceRow) => {
    const email = patientEmail(invoice.patient_id);
    if (!email) { alert("Patient has no email address."); return; }
    if (!invoice.pdf_path) { alert("Please generate the PDF first."); return; }
    if (!confirm(`Send invoice ${invoice.invoice_number} to ${email}?`)) return;

    setSendingEmail(prev => new Set(prev).add(invoice.id));
    try {
      const res = await fetch("/api/invoices/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, recipientEmail: email }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Email sent to ${email}`);
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch {
      alert("Failed to send email");
    } finally {
      setSendingEmail(prev => { const n = new Set(prev); n.delete(invoice.id); return n; });
    }
  };

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const handleBulkGeneratePdf = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Generate/regenerate PDF for ${ids.length} invoice(s)?`)) return;
    setBulkAction("pdf");
    for (const id of ids) {
      await handleGeneratePdf(id);
    }
    setBulkAction(null);
  };

  const handleBulkGenerateReceipt = async () => {
    const receiptIds = Array.from(selected).filter(id => {
      const inv = invoices.find(r => r.id === id);
      return inv && RECEIPT_STATUSES.includes(inv.status);
    });
    if (receiptIds.length === 0) { alert("No paid/partial invoices selected."); return; }
    if (!confirm(`Generate receipt PDF for ${receiptIds.length} invoice(s)?`)) return;
    setBulkAction("receipt");
    for (const id of receiptIds) {
      await handleGeneratePdf(id);
    }
    setBulkAction(null);
  };

  const handleBulkSendEmail = async () => {
    const toSend = Array.from(selected).map(id => invoices.find(r => r.id === id)).filter(Boolean) as InvoiceRow[];
    const withEmail = toSend.filter(r => r.pdf_path && patientEmail(r.patient_id));
    if (withEmail.length === 0) { alert("No selected invoices have both a PDF and patient email."); return; }
    if (!confirm(`Send ${withEmail.length} invoice(s) by email?`)) return;
    setBulkAction("email");
    for (const inv of withEmail) {
      await handleSendEmail(inv);
    }
    setBulkAction(null);
  };

  const handleExportCsv = () => {
    const header = "Invoice #,Date,Patient,Amount,Paid,Remaining,Status,Payment Method,Doctor\n";
    const rows = filtered.map(r => {
      const amt = Number(r.total_amount) || 0;
      const pa = Number(r.paid_amount) || 0;
      return [
        r.invoice_number,
        r.invoice_date || "",
        `"${patientName(r.patient_id).replace(/"/g, '""')}"`,
        amt.toFixed(2),
        pa.toFixed(2),
        (amt - pa).toFixed(2),
        r.is_complimentary ? "Complimentary" : r.status,
        r.payment_method || "",
        `"${(r.doctor_name || "").replace(/"/g, '""')}"`,
      ].join(",");
    });
    const csv = header + rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">Manage, search, and take action on all invoices.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Invoices</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">{summary.count}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Total Billed</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900">CHF {formatCurrency(summary.total)}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 shadow-sm">
          <p className="text-[11px] font-medium text-emerald-600">Total Paid</p>
          <p className="mt-0.5 text-lg font-semibold text-emerald-700">CHF {formatCurrency(summary.paid)}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 shadow-sm">
          <p className="text-[11px] font-medium text-amber-600">Outstanding</p>
          <p className="mt-0.5 text-lg font-semibold text-amber-700">CHF {formatCurrency(summary.unpaid)}</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" /></svg>
          <input
            type="text"
            placeholder="Search by invoice #, patient, doctor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
          <option value="all">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL_PAID">Partial Paid</option>
          <option value="PARTIAL_LOSS">Partial Loss</option>
          <option value="OVERPAID">Overpaid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
          <option value="all">All methods</option>
          {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" placeholder="To" />
        {(search || statusFilter !== "all" || paymentMethodFilter !== "all" || dateFrom || dateTo) && (
          <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setPaymentMethodFilter("all"); setDateFrom(""); setDateTo(""); }} className="text-[10px] text-sky-600 hover:text-sky-800 font-medium">
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs">
          <span className="font-semibold text-sky-800">{selected.size} selected</span>
          <div className="h-4 w-px bg-sky-200" />
          <button type="button" onClick={handleBulkGeneratePdf} disabled={!!bulkAction} className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition-colors">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {bulkAction === "pdf" ? "Generating..." : "Bulk Generate PDF"}
          </button>
          <button type="button" onClick={handleBulkGenerateReceipt} disabled={!!bulkAction} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {bulkAction === "receipt" ? "Generating..." : "Bulk Generate Receipt"}
          </button>
          <button type="button" onClick={handleBulkSendEmail} disabled={!!bulkAction} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {bulkAction === "email" ? "Sending..." : "Bulk Send Email"}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[10px] text-sky-600 hover:text-sky-800 font-medium">
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading invoices...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No invoices match your filters.</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="w-8 px-3 py-2.5">
                  <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0} onChange={toggleSelectAll} className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                </th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Invoice #</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Patient</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Amount</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Paid</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Remaining</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Method</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Doctor</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 text-center">PDF</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map(row => {
                const badge = statusBadge(row.status, row.is_complimentary);
                const amt = Number(row.total_amount) || 0;
                const pa = Number(row.paid_amount) || 0;
                const remaining = Math.max(0, amt - pa);
                const isReceipt = RECEIPT_STATUSES.includes(row.status);
                const isGenerating = generatingPdf.has(row.id);
                const isSending = sendingEmail.has(row.id);

                return (
                  <tr key={row.id} className={`hover:bg-sky-50/30 transition-colors ${selected.has(row.id) ? "bg-sky-50/50" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{row.invoice_number}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(row.invoice_date)}</td>
                    <td className="px-3 py-2">
                      {row.patient_id ? (
                        <Link href={`/patients/${row.patient_id}`} className="text-sky-700 hover:text-sky-900 hover:underline font-medium">
                          {patientName(row.patient_id)}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900 whitespace-nowrap">{formatCurrency(amt)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 whitespace-nowrap">{pa > 0 ? formatCurrency(pa) : "-"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {remaining > 0.01 ? <span className="text-amber-700 font-medium">{formatCurrency(remaining)}</span> : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.payment_method || "-"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[120px] truncate">{row.doctor_name || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {row.pdf_path ? (
                        <button type="button" onClick={() => handleViewPdf(row.pdf_path!)} className="text-indigo-600 hover:text-indigo-800" title="View PDF">
                          <svg className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                      ) : (
                        <span className="text-slate-300" title="No PDF">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleGeneratePdf(row.id)}
                          disabled={isGenerating}
                          className="inline-flex items-center gap-0.5 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                          title={row.pdf_path ? "Regenerate PDF" : "Generate PDF"}
                        >
                          {isGenerating ? "..." : "PDF"}
                        </button>
                        {isReceipt && (
                          <button
                            type="button"
                            onClick={() => handleGeneratePdf(row.id)}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                            title="Generate Receipt (with paid status)"
                          >
                            {isGenerating ? "..." : "Receipt"}
                          </button>
                        )}
                        {row.pdf_path && patientEmail(row.patient_id) && (
                          <button
                            type="button"
                            onClick={() => handleSendEmail(row)}
                            disabled={isSending}
                            className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                            title="Send to patient email"
                          >
                            {isSending ? "..." : "Email"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Showing {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
