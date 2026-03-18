"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import PatientMergeModal from "@/components/PatientMergeModal";
import { useAuth } from "@/components/AuthContext";

type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  contact_owner_name: string | null;
  dob: string | null;
};

type OwnerFilter = "all" | "owner";

type CreatedDateFilter = "all" | "today" | "last_7_days" | "last_30_days";

type StatusFilter = "all" | "has_deal" | "no_deal";

type SearchCategory = "all" | "name" | "email" | "phone" | "birthday";

type DealStatusByPatient = Record<string, string | null>;

const SEARCH_CATEGORY_CONFIG: Record<SearchCategory, { label: string; placeholder: string; icon: React.ReactNode }> = {
  all: {
    label: "All Fields",
    placeholder: "Search name, email, phone, DOB...",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  name: {
    label: "Name",
    placeholder: "Search by first or last name...",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  email: {
    label: "Email",
    placeholder: "Search by email address...",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  phone: {
    label: "Phone",
    placeholder: "Search by phone number...",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  birthday: {
    label: "Birthday",
    placeholder: "Search by DOB (e.g. 1990, 15/03/1990)...",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
};

const PAGE_SIZE = 50;

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [dealStatusByPatient, setDealStatusByPatient] = useState<DealStatusByPatient>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [ownerNameFilter, setOwnerNameFilter] = useState<string | null>(null);
  const [createdFilter, setCreatedFilter] = useState<CreatedDateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchCategory, setSearchCategory] = useState<SearchCategory>("all");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const [priorityMode, setPriorityMode] = useState<"crm" | "medical">("crm");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Calculate pagination range
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // Build the patients query with server-side search and pagination
        let patientsQuery = supabaseClient
          .from("patients")
          .select(
            "id, first_name, last_name, email, phone, created_at, contact_owner_name, dob",
            { count: "exact" }
          );

        // Apply server-side search filter based on selected category
        if (debouncedSearch.trim()) {
          const trimmed = debouncedSearch.trim();
          const searchTerm = `%${trimmed}%`;
          
          if (searchCategory === "all") {
            // Search all fields
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let orConditions = `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`;
            
            // For multi-word queries, also search each word individually
            if (words.length > 1) {
              for (const word of words) {
                const wordTerm = `%${word}%`;
                orConditions += `,first_name.ilike.${wordTerm},last_name.ilike.${wordTerm}`;
              }
            }
            patientsQuery = patientsQuery.or(orConditions);
          } else if (searchCategory === "name") {
            // Search only name fields
            const words = trimmed.split(/\s+/).filter(w => w.length > 0);
            let orConditions = `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`;
            
            // For multi-word queries, also search each word individually
            if (words.length > 1) {
              for (const word of words) {
                const wordTerm = `%${word}%`;
                orConditions += `,first_name.ilike.${wordTerm},last_name.ilike.${wordTerm}`;
              }
            }
            patientsQuery = patientsQuery.or(orConditions);
          } else if (searchCategory === "email") {
            // Search only email field
            patientsQuery = patientsQuery.ilike("email", searchTerm);
          } else if (searchCategory === "phone") {
            // Search only phone field (strip non-digits for flexibility)
            const digitsOnly = trimmed.replace(/\D/g, "");
            if (digitsOnly.length > 0) {
              patientsQuery = patientsQuery.or(`phone.ilike.${searchTerm},phone.ilike.%${digitsOnly}%`);
            } else {
              patientsQuery = patientsQuery.ilike("phone", searchTerm);
            }
          } else if (searchCategory === "birthday") {
            // Search DOB field with various date format support
            // Try DD/MM/YYYY format (Swiss format)
            const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyyMatch) {
              const day = ddmmyyyyMatch[1].padStart(2, "0");
              const month = ddmmyyyyMatch[2].padStart(2, "0");
              const year = ddmmyyyyMatch[3];
              const isoDate = `${year}-${month}-${day}`;
              patientsQuery = patientsQuery.eq("dob", isoDate);
            } else {
              // Try ISO format or year-only
              const dateMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
              if (dateMatch) {
                patientsQuery = patientsQuery.eq("dob", trimmed);
              } else {
                // Year-only search (e.g. "1990")
                const yearMatch = trimmed.match(/^(\d{4})$/);
                if (yearMatch) {
                  patientsQuery = patientsQuery
                    .gte("dob", `${yearMatch[1]}-01-01`)
                    .lte("dob", `${yearMatch[1]}-12-31`);
                } else {
                  // Partial date search
                  patientsQuery = patientsQuery.ilike("dob", searchTerm);
                }
              }
            }
          }
        }

        // Apply owner filter
        if (ownerFilter === "owner" && ownerNameFilter) {
          patientsQuery = patientsQuery.eq("contact_owner_name", ownerNameFilter);
        }

        // Apply created date filter
        if (createdFilter !== "all") {
          const now = new Date();
          let filterDate: Date;
          if (createdFilter === "today") {
            filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          } else if (createdFilter === "last_7_days") {
            filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          } else {
            filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          }
          patientsQuery = patientsQuery.gte("created_at", filterDate.toISOString());
        }

        // Apply pagination and ordering
        patientsQuery = patientsQuery
          .order("created_at", { ascending: false })
          .range(from, to);

        const patientsResult = await patientsQuery;

        if (!isMounted) return;

        const { data: patientsData, error: patientsError, count } = patientsResult;

        if (patientsError || !patientsData) {
          setError(patientsError?.message ?? "Failed to load patients.");
          setPatients([]);
          setDealStatusByPatient({});
          setTotalCount(0);
          setLoading(false);
          return;
        }

        setPatients(patientsData as PatientRow[]);
        setTotalCount(count ?? 0);

        // Only fetch deals for the patients we just loaded (much smaller query)
        if (patientsData.length > 0) {
          const patientIds = patientsData.map((p: any) => p.id);
          const { data: dealsData } = await supabaseClient
            .from("deals")
            .select("patient_id, stage:deal_stages(name)")
            .in("patient_id", patientIds);

          if (isMounted && dealsData) {
            const statusMap: DealStatusByPatient = {};
            for (const row of dealsData as any[]) {
              const pid = row.patient_id as string | null;
              if (!pid || statusMap[pid] != null) continue;
              const stage = row.stage as { name: string | null } | null;
              statusMap[pid] = stage?.name ?? null;
            }
            setDealStatusByPatient(statusMap);
          }
        } else {
          setDealStatusByPatient({});
        }

        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load patients.");
        setPatients([]);
        setDealStatusByPatient({});
        setTotalCount(0);
        setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [page, debouncedSearch, searchCategory, ownerFilter, ownerNameFilter, createdFilter]);

  // Load priority mode from user metadata
  useEffect(() => {
    if (!user) return;

    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const rawPriority = (meta["priority_mode"] as string) || "";
    const next: "crm" | "medical" =
      rawPriority === "medical" ? "medical" : "crm";
    setPriorityMode(next);
  }, [user]);

  const ownerOptions = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => {
      if (p.contact_owner_name) {
        set.add(p.contact_owner_name);
      }
    });
    return Array.from(set.values()).sort();
  }, [patients]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(dealStatusByPatient).forEach((status) => {
      if (status) set.add(status);
    });
    return Array.from(set.values()).sort();
  }, [dealStatusByPatient]);

  // Client-side filter for status (deal presence) - applied to already paginated results
  const filteredPatients = useMemo(() => {
    if (statusFilter === "all") {
      return patients;
    }
    return patients.filter((patient) => {
      const dealStatus = dealStatusByPatient[patient.id] ?? null;
      if (statusFilter === "has_deal" && !dealStatus) return false;
      if (statusFilter === "no_deal" && dealStatus) return false;
      return true;
    });
  }, [patients, statusFilter, dealStatusByPatient]);

  // Server-side pagination - totalPages based on server count
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [ownerFilter, ownerNameFilter, createdFilter, statusFilter, searchCategory]);

  // For display - use filtered patients directly (already paginated from server)
  const paginatedPatients = filteredPatients;

  function buildPatientHref(id: string) {
    if (priorityMode === "medical") {
      return `/patients/${id}?mode=medical`;
    }
    return `/patients/${id}`;
  }

  function handleToggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => {
        const ids = new Set(prev);
        paginatedPatients.forEach((p) => ids.add(p.id));
        return Array.from(ids.values());
      });
    } else {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedPatients.some((p) => p.id === id)),
      );
    }
  }

  function handleToggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((existing) => existing !== id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Contacts</h1>
          <p className="text-xs text-slate-500">
            Patient contacts for all pipelines. Use filters to narrow down the list.
          </p>
          <p className="mt-1 text-xs font-medium text-sky-600">
            Total Records: {totalCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Top filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter by Owner */}
        <select
          value={ownerFilter === "owner" && ownerNameFilter ? ownerNameFilter : "all"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "all") {
              setOwnerFilter("all");
              setOwnerNameFilter(null);
            } else {
              setOwnerFilter("owner");
              setOwnerNameFilter(value);
            }
          }}
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">Filter by Owner...</option>
          {ownerOptions.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>

        {/* Filter by Create Date */}
        <select
          value={createdFilter}
          onChange={(event) =>
            setCreatedFilter(event.target.value as CreatedDateFilter)
          }
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">Filter by Create Date...</option>
          <option value="today">Created Today</option>
          <option value="last_7_days">Created in Last 7 Days</option>
          <option value="last_30_days">Created in Last 30 Days</option>
        </select>

        {/* Placeholder Last Activity filter (aliases created_at for now) */}
        <select
          value={createdFilter}
          onChange={(event) =>
            setCreatedFilter(event.target.value as CreatedDateFilter)
          }
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">Filter by Last Activity Date...</option>
          <option value="today">Activity Today</option>
          <option value="last_7_days">Activity in Last 7 Days</option>
          <option value="last_30_days">Activity in Last 30 Days</option>
        </select>

        {/* Filter by Status (deal presence) */}
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">Filter by Status...</option>
          <option value="has_deal">With deals</option>
          <option value="no_deal">No deals</option>
        </select>
      </div>

      {/* Main contacts card */}
      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2">
            {/* Search Category Dropdown */}
            <div className="relative">
              <select
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value as SearchCategory)}
                className="h-[30px] appearance-none rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 pl-8 pr-6 text-xs font-medium text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {(Object.keys(SEARCH_CATEGORY_CONFIG) as SearchCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {SEARCH_CATEGORY_CONFIG[cat].label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">
                {SEARCH_CATEGORY_CONFIG[searchCategory].icon}
              </div>
              <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={SEARCH_CATEGORY_CONFIG[searchCategory].placeholder}
                className="h-[30px] w-full rounded-r-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Search Category Pills (active indicator) */}
            {searchCategory !== "all" && (
              <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-medium text-sky-700">
                Searching: {SEARCH_CATEGORY_CONFIG[searchCategory].label}
                <button
                  type="button"
                  onClick={() => setSearchCategory("all")}
                  className="ml-0.5 rounded-full hover:bg-sky-200"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
          </div>
          {selectedIds.length >= 2 && (
            <button
              onClick={() => setShowMergeModal(true)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-700"
            >
              Merge {selectedIds.length} Patients
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-[11px] text-slate-500">Loading contacts...</p>
        ) : error ? (
          <p className="text-[11px] text-red-600">{error}</p>
        ) : filteredPatients.length === 0 ? (
          <p className="text-[11px] text-slate-500">No contacts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead className="border-b text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 py-2 pr-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={
                        paginatedPatients.length > 0 &&
                        paginatedPatients.every((p) =>
                          selectedIds.includes(p.id),
                        )
                      }
                      onChange={(event) => handleToggleAll(event.target.checked)}
                    />
                  </th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">DOB</th>
                  <th className="py-2 pr-3 font-medium">Mobile Number</th>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Contact Owner</th>
                  <th className="py-2 pr-3 font-medium">Deal Status</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPatients.map((patient) => {
                  const fullName = `${patient.first_name} ${patient.last_name}`.trim();
                  const dealStatus = dealStatusByPatient[patient.id] ?? null;
                  const checked = selectedIds.includes(patient.id);

                  return (
                    <tr key={patient.id} className="hover:bg-slate-50/70">
                      <td className="py-2 pr-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          checked={checked}
                          onChange={(event) =>
                            handleToggleRow(patient.id, event.target.checked)
                          }
                        />
                      </td>
                      <td className="py-2 pr-3 align-top text-sky-700">
                        <Link
                          href={buildPatientHref(patient.id)}
                          className="hover:underline"
                        >
                          {fullName || "Unnamed patient"}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 align-top text-slate-700">
                        {patient.dob ? new Date(patient.dob).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-slate-700">
                        {patient.phone || "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-slate-700">
                        {patient.email || "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-slate-700">
                        {patient.contact_owner_name || "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-slate-700">
                        {dealStatus || "—"}
                      </td>
                      <td className="py-2 pr-3 align-top text-slate-700">
                        <div className="flex flex-wrap items-center gap-1">
                          <Link
                            href={buildPatientHref(patient.id)}
                            className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm hover:bg-emerald-600"
                          >
                            Edit
                          </Link>
                          <Link
                            href={buildPatientHref(patient.id)}
                            className="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-600">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages} ({filteredPatients.length.toLocaleString()} results)
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((prev) =>
                    prev < totalPages ? prev + 1 : prev,
                  )
                }
                disabled={currentPage === totalPages}
                className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Patient Merge Modal */}
      {showMergeModal && (
        <PatientMergeModal
          patientIds={selectedIds}
          onClose={() => setShowMergeModal(false)}
          onSuccess={() => {
            setSelectedIds([]);
            setShowMergeModal(false);
            // Reload patients
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
