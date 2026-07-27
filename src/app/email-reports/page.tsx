"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type Email = {
  id: string;
  patient_id: string | null;
  deal_id: string | null;
  to_address: string;
  from_address: string | null;
  subject: string;
  status: string;
  direction: string;
  source: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  body?: string | null;
};

type Patient = {
  first_name: string;
  last_name: string;
  email: string | null;
};

type DoctorInfo = {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type FilterState = {
  direction: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  source: string;
};

type EmailStats = {
  total: number;
  sent: number;
  failed: number;
  read: number;
  inbound: number;
  outbound: number;
  automation: number;
  manual: number;
};

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDoctorName(info: DoctorInfo | null): string {
  if (!info) return "";
  const name = [info.first_name, info.last_name].filter(Boolean).join(" ");
  return name || info.email.split("@")[0];
}

const ITEMS_PER_PAGE = 25;

export default function EmailReportsPage() {
  const searchParams = useSearchParams();
  const doctorEmail = searchParams.get("doctor_email") || "";
  const [emails, setEmails] = useState<Email[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<EmailStats>({
    total: 0, sent: 0, failed: 0, read: 0, inbound: 0, outbound: 0, automation: 0, manual: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const isDoctorInbox = !!doctorEmail;

  const [filters, setFilters] = useState<FilterState>({
    direction: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    searchQuery: "",
    source: "all",
  });

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailBodyLoading, setEmailBodyLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(filters.searchQuery);
    }, 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [filters.searchQuery]);

  // Fetch doctor info when doctorEmail is present
  useEffect(() => {
    if (!doctorEmail) {
      setDoctorInfo(null);
      return;
    }
    supabaseClient
      .from("users")
      .select("first_name, last_name, email")
      .eq("email", doctorEmail)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDoctorInfo({ first_name: data.first_name, last_name: data.last_name, email: data.email });
        } else {
          setDoctorInfo({ first_name: null, last_name: null, email: doctorEmail });
        }
      });
  }, [doctorEmail]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (doctorEmail) params.set("doctor_email", doctorEmail);
      const res = await fetch(`/api/email-reports?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.stats) setStats(data.stats);
    } finally {
      setStatsLoading(false);
    }
  }, [doctorEmail]);

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", String(ITEMS_PER_PAGE));
      params.set("include_stats", "false");
      if (filters.direction !== "all") params.set("direction", filters.direction);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.source !== "all") params.set("source", filters.source);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filters.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters.dateTo) params.set("date_to", filters.dateTo);
      if (doctorEmail) params.set("doctor_email", doctorEmail);

      const res = await fetch(`/api/email-reports?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load emails");
        setLoading(false);
        return;
      }

      setEmails(data.emails || []);
      setPatients(data.patients || {});
      setTotalEmails(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setLoading(false);
      void fetchStats();
    } catch {
      setError("Failed to load email data.");
      setLoading(false);
    }
  }, [currentPage, filters.direction, filters.status, filters.source, filters.dateFrom, filters.dateTo, debouncedSearch, doctorEmail, fetchStats]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.direction, filters.status, filters.source, filters.dateFrom, filters.dateTo, debouncedSearch]);

  async function handleViewEmail(email: Email) {
    setSelectedEmail(email);
    setViewModalOpen(true);
    setEmailBodyLoading(true);

    try {
      const res = await fetch(`/api/email-reports?email_id=${encodeURIComponent(email.id)}`);
      const data = await res.json();
      if (res.ok && data.email) {
        setSelectedEmail((current) => current?.id === email.id ? { ...current, body: data.email.body } : current);
      }
    } catch {
      setSelectedEmail((current) => current?.id === email.id ? { ...current, body: null } : current);
    } finally {
      setEmailBodyLoading(false);
    }
  }

  function resetFilters() {
    setFilters({
      direction: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
      searchQuery: "",
      source: "all",
    });
  }

  const pageTitle = isDoctorInbox
    ? `${formatDoctorName(doctorInfo)}'s Inbox`
    : "Email Reports";
  const pageSubtitle = isDoctorInbox
    ? `Emails sent from and received by ${doctorEmail}`
    : "Smart email analytics and reporting for all system emails";

  return (
    <div className={isDoctorInbox ? "space-y-3" : "space-y-6"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isDoctorInbox && (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600">
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-slate-900">{pageTitle}</h1>
              <p className="truncate text-sm text-slate-500">{pageSubtitle}</p>
            </div>
          </div>
        </div>
        <button
          onClick={resetFilters}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset filters
        </button>
      </div>

      {/* Stats — compact inline row for doctor inbox, full cards for global reports */}
      {isDoctorInbox ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
          <CompactStat label="Total" value={stats.total} loading={statsLoading} color="text-slate-900" />
          <Divider />
          <CompactStat label="Sent" value={stats.sent} loading={statsLoading} color="text-emerald-600" />
          <Divider />
          <CompactStat label="Read" value={stats.read} loading={statsLoading} color="text-green-600" />
          <Divider />
          <CompactStat label="Failed" value={stats.failed} loading={statsLoading} color="text-rose-600" />
          <Divider />
          <CompactStat label="Inbox" value={stats.inbound} loading={statsLoading} color="text-emerald-600" />
          <Divider />
          <CompactStat label="Outbox" value={stats.outbound} loading={statsLoading} color="text-sky-600" />
          <Divider />
          <CompactStat label="Auto" value={stats.automation} loading={statsLoading} color="text-violet-600" />
          <Divider />
          <CompactStat label="Manual" value={stats.manual} loading={statsLoading} color="text-amber-600" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{statsLoading ? "—" : stats.total}</p>
                  <p className="text-xs text-slate-500">Total Emails</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{statsLoading ? "—" : stats.sent}</p>
                  <p className="text-xs text-slate-500">Sent Successfully</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-green-50 text-green-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12l5 5L20 5" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{statsLoading ? "—" : stats.read}</p>
                  <p className="text-xs text-slate-500">Read (Opened)</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{statsLoading ? "—" : stats.failed}</p>
                  <p className="text-xs text-slate-500">Failed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Direction & Source Stats */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Email Direction</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-sky-500"></div>
                  <span className="text-sm text-slate-600">Outbox: <span className="font-semibold text-slate-900">{statsLoading ? "—" : stats.outbound}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  <span className="text-sm text-slate-600">Inbox: <span className="font-semibold text-slate-900">{statsLoading ? "—" : stats.inbound}</span></span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full">
                  <div
                    className="bg-sky-500"
                    style={{ width: `${stats.total > 0 ? (stats.outbound / stats.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${stats.total > 0 ? (stats.inbound / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Email Source</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-violet-500"></div>
                  <span className="text-sm text-slate-600">Automation: <span className="font-semibold text-slate-900">{statsLoading ? "—" : stats.automation}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-slate-600">Manual: <span className="font-semibold text-slate-900">{statsLoading ? "—" : stats.manual}</span></span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full">
                  <div
                    className="bg-violet-500"
                    style={{ width: `${stats.total > 0 ? (stats.automation / stats.total) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-amber-500"
                    style={{ width: `${stats.total > 0 ? (stats.manual / stats.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Filters — compact for doctor inbox, full for global reports */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
        {isDoctorInbox ? (
          <div className="space-y-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => setFilters((f) => ({ ...f, searchQuery: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <select
                value={filters.direction}
                onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Directions</option>
                <option value="inbound">Inbox</option>
                <option value="outbound">Outbox</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">All Sources</option>
                <option value="manual">Manual</option>
                <option value="automation">Automation</option>
                <option value="ai_transcript">AI Transcript</option>
                <option value="appointment_reminder">Reminder</option>
                <option value="marketing">Marketing</option>
                <option value="invoice">Invoice</option>
                <option value="otp">OTP</option>
              </select>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search - Full width */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Search</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters((f) => ({ ...f, searchQuery: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {/* Direction */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Direction</label>
                <select
                  value={filters.direction}
                  onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="all">All</option>
                  <option value="inbound">Inbox</option>
                  <option value="outbound">Outbox</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="queued">Queued</option>
                  <option value="sent">Sent</option>
                  <option value="read">Read</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="all">All</option>
                  <option value="manual">Manual</option>
                  <option value="automation">Automation</option>
                  <option value="ai_transcript">AI Transcript</option>
                  <option value="appointment_reminder">Reminder</option>
                  <option value="marketing">Marketing</option>
                  <option value="invoice">Invoice</option>
                  <option value="otp">OTP</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email List */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">
              Emails <span className="ml-1 text-slate-400">({totalEmails})</span>
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-600">{error}</div>
        ) : emails.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <p className="mt-3 text-sm text-slate-500">No emails match your filters</p>
          </div>
        ) : (
          <>
          <div className="divide-y divide-slate-100">
            {emails.map((email) => {
              const patient = email.patient_id ? patients[email.patient_id] : null;
              const isAutomation = email.source === "automation" || !!email.deal_id;

              return (
                <div
                  key={email.id}
                  className="group flex items-start gap-4 px-4 py-3 hover:bg-slate-50/80 cursor-pointer"
                  onClick={() => handleViewEmail(email)}
                >
                  {/* Direction Icon */}
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    email.direction === "inbound"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-sky-50 text-sky-600"
                  }`}>
                    {email.direction === "inbound" ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {email.subject || "(No subject)"}
                      </p>
                      {isAutomation && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                          </svg>
                          Automation
                        </span>
                      )}
                      {email.read_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700" title={`Read: ${formatDate(email.read_at)}`}>
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12l5 5L20 5" />
                          </svg>
                          Read
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{email.direction === "inbound" ? "From" : "To"}: {email.direction === "inbound" ? (email.from_address || "\u2014") : email.to_address}</span>
                      {patient && (
                        <>
                          <span className="text-slate-300">|</span>
                          <Link
                            href={`/patients/${email.patient_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sky-600 hover:text-sky-700 hover:underline"
                          >
                            {patient.first_name} {patient.last_name}
                          </Link>
                        </>
                      )}
                      {email.source && email.source !== "manual" && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400">{email.source.replace(/_/g, " ")}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status & Date */}
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      email.read_at
                        ? "bg-green-50 text-green-700"
                        : email.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : email.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : email.status === "queued"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {email.read_at ? "Read" : email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(email.read_at || email.sent_at || email.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalEmails)} of {totalEmails} emails
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ←
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${
                        currentPage === pageNum
                          ? "border-sky-500 bg-sky-500 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  →
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* View Email Modal */}
      {viewModalOpen && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewModalOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Email Details</h2>
              <div className="flex items-center gap-1">
                {selectedEmail.patient_id && (
                  <Link
                    href={`/patients/${selectedEmail.patient_id}?tab=emails`}
                    title="Open in patient email tab"
                    className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                    </svg>
                    <span className="sr-only">Open in patient email tab</span>
                  </Link>
                )}
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    selectedEmail.direction === "inbound"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-sky-50 text-sky-600"
                  }`}>
                    {selectedEmail.direction === "inbound" ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {selectedEmail.direction === "inbound" ? "Inbox" : "Outbox"}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(selectedEmail.created_at)}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      selectedEmail.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedEmail.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : selectedEmail.status === "queued"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {selectedEmail.status.charAt(0).toUpperCase() + selectedEmail.status.slice(1)}
                    </span>
                    {selectedEmail.deal_id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83" />
                        </svg>
                        Automation
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="grid gap-3 text-sm">
                    <div className="flex gap-3">
                      <span className="w-16 flex-shrink-0 font-medium text-slate-500">From:</span>
                      <span className="text-slate-700">{selectedEmail.from_address || "—"}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-16 flex-shrink-0 font-medium text-slate-500">To:</span>
                      <span className="text-slate-700">{selectedEmail.to_address}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-16 flex-shrink-0 font-medium text-slate-500">Subject:</span>
                      <span className="font-medium text-slate-900">{selectedEmail.subject || "(No subject)"}</span>
                    </div>
                    {selectedEmail.patient_id && patients[selectedEmail.patient_id] && (
                      <div className="flex gap-3">
                        <span className="w-16 flex-shrink-0 font-medium text-slate-500">Patient:</span>
                        <Link
                          href={`/patients/${selectedEmail.patient_id}`}
                          className="text-sky-600 hover:text-sky-700 hover:underline"
                        >
                          {patients[selectedEmail.patient_id].first_name} {patients[selectedEmail.patient_id].last_name}
                        </Link>
                      </div>
                    )}
                    {selectedEmail.read_at && (
                      <div className="flex gap-3">
                        <span className="w-16 flex-shrink-0 font-medium text-slate-500">Read:</span>
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12l5 5L20 5" />
                          </svg>
                          {formatDate(selectedEmail.read_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <h3 className="mb-2 text-xs font-medium text-slate-500">Email Content</h3>
                  {emailBodyLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                      Loading email content...
                    </div>
                  ) : selectedEmail.body ? (
                    <iframe
                      title={`Email content: ${selectedEmail.subject || selectedEmail.id}`}
                      sandbox=""
                      srcDoc={selectedEmail.body}
                      className="h-80 w-full rounded border border-slate-100 bg-white"
                    />
                  ) : (
                    <p className="py-8 text-sm text-slate-500">Email content is unavailable.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setViewModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactStat({ label, value, loading, color }: { label: string; value: number; loading: boolean; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-sm font-semibold ${loading ? "text-slate-300" : color}`}>
        {loading ? "—" : value}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-4 w-px bg-slate-200" />;
}
