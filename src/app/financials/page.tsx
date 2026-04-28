"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

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
  status: string;
  is_complimentary: boolean;
  created_by_user_id: string | null;
  created_by_name: string | null;
  is_archived: boolean;
};

type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  name: string;
  service_id: string | null;
  tardoc_code: string | null;
  catalog_nature: "TARIFF_CATALOG" | "CUSTOM" | null;
  uncovered_benefit: boolean;
  code: string | null;
};

type ItemType = "all" | "service" | "tardoc" | "insurance" | "material";

type PatientInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProviderInfo = {
  id: string;
  name: string | null;
};

type PatientsById = Record<string, PatientInfo>;
type ProvidersById = Record<string, ProviderInfo>;

type NormalizedInvoice = InvoiceRow & {
  amount: number;
  isPaid: boolean;
  patientName: string;
  ownerKey: string;
  ownerLabel: string;
  statusLabel: string;
  serviceNames: string[];
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

type DoctorSummaryRow = {
  doctorKey: string;
  doctorName: string;
  invoiceCount: number;
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  firstInvoiceDate: string | null;
  lastInvoiceDate: string | null;
  services: string[];
};

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
  const [invoiceItems, setInvoiceItems] = useState<InvoiceLineItem[]>([]);
  const [patientsById, setPatientsById] = useState<PatientsById>({});
  const [providersById, setProvidersById] = useState<ProvidersById>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemType>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [customDateRange, setCustomDateRange] = useState<{ label: string; from: string; to: string } | null>(null);
  const [invoiceCountMin, setInvoiceCountMin] = useState<string>("");
  const [invoiceCountMax, setInvoiceCountMax] = useState<string>("");
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false);
  const [invoicePage, setInvoicePage] = useState(0);
  const [patientPage, setPatientPage] = useState(0);
  const [doctorPage, setDoctorPage] = useState(0);
  const [activeView, setActiveView] = useState<"overview" | "doctors">("overview");
  const ROWS_PER_PAGE = 50;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: invoicesError } = await supabaseClient
          .from("invoices")
          .select(
            "id, patient_id, invoice_number, invoice_date, doctor_user_id, doctor_name, provider_id, provider_name, payment_method, total_amount, paid_amount, status, is_complimentary, created_by_user_id, created_by_name, is_archived",
          )
          .eq("is_archived", false)
          .is("parent_invoice_id", null)
          .order("invoice_date", { ascending: false });

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

        // Fetch invoice line items for service and item type filtering
        const invoiceIds = rows.map((r) => r.id);
        if (invoiceIds.length > 0) {
          const { data: itemsData, error: itemsError } = await supabaseClient
            .from("invoice_line_items")
            .select("id, invoice_id, name, service_id, tardoc_code, catalog_nature, uncovered_benefit, code")
            .in("invoice_id", invoiceIds.slice(0, 1000)); // Limit to avoid query size issues

          if (!itemsError && itemsData) {
            setInvoiceItems(itemsData as InvoiceLineItem[]);
          } else {
            setInvoiceItems([]);
          }
        } else {
          setInvoiceItems([]);
        }

        const patientIds = Array.from(
          new Set(
            rows
              .map((row) => row.patient_id)
              .filter((id): id is string => typeof id === "string" && !!id),
          ),
        );

        // Fetch patients in batches of 50 to avoid URL length limits
        if (patientIds.length > 0) {
          const BATCH_SIZE = 50;
          const map: PatientsById = {};

          for (let i = 0; i < patientIds.length; i += BATCH_SIZE) {
            if (!isMounted) return;
            const batch = patientIds.slice(i, i + BATCH_SIZE);
            const { data: patientsData, error: patientsError } =
              await supabaseClient
                .from("patients")
                .select("id, first_name, last_name")
                .in("id", batch);

            if (!patientsError && patientsData) {
              for (const row of patientsData as any[]) {
                const id = row.id as string;
                map[id] = {
                  id,
                  first_name: (row.first_name as string | null) ?? null,
                  last_name: (row.last_name as string | null) ?? null,
                };
              }
            }
          }

          if (!isMounted) return;
          setPatientsById(map);
        } else {
          setPatientsById({});
        }

        // Fetch providers for invoice owners
        const providerIds = Array.from(
          new Set(
            rows
              .map((row) => row.provider_id)
              .filter((id): id is string => typeof id === "string" && !!id),
          ),
        );

        if (providerIds.length > 0) {
          const { data: providersData, error: providersError } =
            await supabaseClient
              .from("providers")
              .select("id, name")
              .in("id", providerIds);

          if (!isMounted) return;

          if (!providersError && providersData) {
            const provMap: ProvidersById = {};
            for (const row of providersData as any[]) {
              const id = row.id as string;
              provMap[id] = {
                id,
                name: (row.name as string | null) ?? null,
              };
            }
            setProvidersById(provMap);
          } else {
            setProvidersById({});
          }
        } else {
          setProvidersById({});
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

      const amount = Number(row.total_amount) || 0;
      const isPaid = row.status === "PAID" || row.status === "OVERPAID";

      // Owner: prefer provider (from providers table), then doctor, then creator
      const provider = row.provider_id ? providersById[row.provider_id] : undefined;
      const ownerKey =
        row.provider_id || row.doctor_user_id || row.created_by_user_id || "unknown";

      const ownerLabel =
        provider?.name ||
        row.provider_name ||
        row.doctor_name ||
        row.created_by_name ||
        (ownerKey === "unknown" ? "Unassigned" : ownerKey);

      const statusLabel = row.is_complimentary
        ? "Complimentary"
        : isPaid
        ? "Paid"
        : row.status === "PARTIAL_PAID"
        ? "Partial"
        : row.status === "CANCELLED"
        ? "Cancelled"
        : "Unpaid";

      // Get service names for this invoice
      const serviceNames = invoiceItems
        .filter((item) => item.invoice_id === row.id)
        .map((item) => item.name);

      return {
        ...row,
        amount,
        isPaid,
        patientName,
        ownerKey,
        ownerLabel,
        statusLabel,
        serviceNames,
      };
    });
  }, [invoices, patientsById, providersById, invoiceItems]);

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

  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of normalizedInvoices) {
      const key = row.doctor_user_id || row.doctor_name || "unknown";
      const label = row.doctor_name || (key === "unknown" ? "Unassigned" : key);
      if (!map.has(key)) {
        map.set(key, label);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [normalizedInvoices]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of normalizedInvoices) {
      for (const serviceName of row.serviceNames) {
        if (serviceName) set.add(serviceName);
      }
    }
    return Array.from(set).sort();
  }, [normalizedInvoices]);

  // Helper function to determine item type
  function getItemType(item: InvoiceLineItem): "service" | "tardoc" | "insurance" | "material" {
    if (item.service_id) return "service";
    if (item.tardoc_code) return "tardoc";
    if (item.code && !item.uncovered_benefit) return "insurance";
    return "material";
  }

  // Check if invoice has items of a specific type
  function invoiceHasItemType(invoiceId: string, type: ItemType): boolean {
    if (type === "all") return true;
    const items = invoiceItems.filter((item) => item.invoice_id === invoiceId);
    if (items.length === 0) return false;
    return items.some((item) => getItemType(item) === type);
  }

  const filteredInvoices = useMemo(() => {
    return normalizedInvoices.filter((row) => {
      // Patient filter
      if (patientFilter !== "all" && row.patient_id !== patientFilter) {
        return false;
      }
      // Owner filter
      if (ownerFilter !== "all" && row.ownerKey !== ownerFilter) {
        return false;
      }
      // Doctor filter
      if (doctorFilter !== "all") {
        const rowDoctorKey = row.doctor_user_id || row.doctor_name || "unknown";
        if (rowDoctorKey !== doctorFilter) return false;
      }
      // Service filter
      if (serviceFilter !== "all") {
        if (!row.serviceNames.some((name) => name === serviceFilter)) {
          return false;
        }
      }
      // Item type filter
      if (itemTypeFilter !== "all") {
        if (!invoiceHasItemType(row.id, itemTypeFilter)) {
          return false;
        }
      }
      // Date range filter
      if (dateFrom && row.invoice_date) {
        if (row.invoice_date < dateFrom) return false;
      }
      if (dateTo && row.invoice_date) {
        if (row.invoice_date > dateTo) return false;
      }
      // Unpaid only filter
      if (showOnlyUnpaid) {
        if (row.is_complimentary) return false;
        if (row.isPaid) return false;
      }
      return true;
    });
  }, [normalizedInvoices, patientFilter, ownerFilter, doctorFilter, serviceFilter, itemTypeFilter, dateFrom, dateTo, showOnlyUnpaid, invoiceItems]);

  // Reset pages when filters change
  useEffect(() => {
    setInvoicePage(0);
    setPatientPage(0);
    setDoctorPage(0);
  }, [patientFilter, ownerFilter, doctorFilter, serviceFilter, itemTypeFilter, dateFrom, dateTo, showOnlyUnpaid]);

  const totalInvoicePages = Math.max(1, Math.ceil(filteredInvoices.length / ROWS_PER_PAGE));
  const paginatedInvoices = useMemo(() => {
    const start = invoicePage * ROWS_PER_PAGE;
    return filteredInvoices.slice(start, start + ROWS_PER_PAGE);
  }, [filteredInvoices, invoicePage, ROWS_PER_PAGE]);

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

      if (row.is_complimentary) {
        totalComplimentary += amount;
        continue;
      }

      totalAmount += amount;

      if (row.isPaid) {
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

        if (row.is_complimentary) {
          existing.totalComplimentary += amount;
        } else {
          existing.totalAmount += amount;
          if (row.isPaid) {
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

  const totalPatientPages = Math.max(1, Math.ceil(patientSummaryRows.length / ROWS_PER_PAGE));
  const paginatedPatientRows = useMemo(() => {
    const start = patientPage * ROWS_PER_PAGE;
    return patientSummaryRows.slice(start, start + ROWS_PER_PAGE);
  }, [patientSummaryRows, patientPage, ROWS_PER_PAGE]);

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

        if (row.is_complimentary) {
          existing.totalComplimentary += amount;
        } else {
          existing.totalAmount += amount;
          if (row.isPaid) {
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

  const doctorSummaryRows: DoctorSummaryRow[] = useMemo(() => {
    const byDoctor = new Map<string, DoctorSummaryRow>();

    for (const row of filteredInvoices) {
      const key = row.doctor_user_id || row.doctor_name || "unknown";
      const name = row.doctor_name || (key === "unknown" ? "Unassigned" : key);

      let existing = byDoctor.get(key);
      if (!existing) {
        existing = {
          doctorKey: key,
          doctorName: name,
          invoiceCount: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          firstInvoiceDate: null,
          lastInvoiceDate: null,
          services: [],
        };
      }

      const amount = row.amount;
      if (Number.isFinite(amount) && amount > 0) {
        existing.invoiceCount += 1;

        if (!row.is_complimentary) {
          existing.totalAmount += amount;
          if (row.isPaid) {
            existing.totalPaid += amount;
          } else {
            existing.totalUnpaid += amount;
          }
        }

        // Track date range
        if (row.invoice_date) {
          if (!existing.firstInvoiceDate || row.invoice_date < existing.firstInvoiceDate) {
            existing.firstInvoiceDate = row.invoice_date;
          }
          if (!existing.lastInvoiceDate || row.invoice_date > existing.lastInvoiceDate) {
            existing.lastInvoiceDate = row.invoice_date;
          }
        }

        // Collect services
        for (const serviceName of row.serviceNames) {
          if (serviceName && !existing.services.includes(serviceName)) {
            existing.services.push(serviceName);
          }
        }
      }

      byDoctor.set(key, existing);
    }

    return Array.from(byDoctor.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
  }, [filteredInvoices]);

  // Apply invoice count filter to doctor rows
  const filteredDoctorRows = useMemo(() => {
    const min = parseInt(invoiceCountMin, 10);
    const max = parseInt(invoiceCountMax, 10);

    return doctorSummaryRows.filter((row) => {
      if (!Number.isNaN(min) && row.invoiceCount < min) return false;
      if (!Number.isNaN(max) && row.invoiceCount > max) return false;
      return true;
    });
  }, [doctorSummaryRows, invoiceCountMin, invoiceCountMax]);

  const totalDoctorPages = Math.max(1, Math.ceil(filteredDoctorRows.length / ROWS_PER_PAGE));
  const paginatedDoctorRows = useMemo(() => {
    const start = doctorPage * ROWS_PER_PAGE;
    return filteredDoctorRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredDoctorRows, doctorPage, ROWS_PER_PAGE]);

  const [activeTab, setActiveTab] = useState<"overview" | "receipts" | "import_history">("overview");

  function handleExportPdf() {
    if (typeof window === "undefined") return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("Financial Report", pageWidth / 2, 20, { align: "center" });

    // Date range info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const today = new Date().toLocaleDateString();
    doc.text(`Generated on: ${today}`, pageWidth / 2, 28, { align: "center" });

    if (dateFrom || dateTo) {
      const dateRange = `${dateFrom || "Start"} - ${dateTo || "End"}`;
      doc.text(`Period: ${dateRange}`, pageWidth / 2, 34, { align: "center" });
    }

    // Summary section
    let y = 45;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Summary", margin, y);

    const summaryData = [
      ["Total Billed", formatCurrency(summary.totalAmount)],
      ["Total Paid", formatCurrency(summary.totalPaid)],
      ["Outstanding", formatCurrency(summary.totalUnpaid)],
      ["Complimentary", formatCurrency(summary.totalComplimentary)],
      ["Invoice Count", summary.invoiceCount.toString()],
    ];

    (doc as any).autoTable({
      startY: y + 5,
      head: [["Metric", "Value"]],
      body: summaryData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: margin, right: margin },
    });

    // Doctor summary section
    y = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Doctor Performance", margin, y);

    const doctorData = filteredDoctorRows.map((row) => [
      row.doctorName,
      row.invoiceCount.toString(),
      formatCurrency(row.totalAmount),
      formatCurrency(row.totalPaid),
      formatCurrency(row.totalUnpaid),
      row.services.slice(0, 3).join(", ") + (row.services.length > 3 ? "..." : ""),
    ]);

    (doc as any).autoTable({
      startY: y + 5,
      head: [["Doctor", "Invoices", "Billed", "Paid", "Unpaid", "Services"]],
      body: doctorData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });

    // Patient summary section
    y = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Top Patients", margin, y);

    const patientData = patientSummaryRows.slice(0, 20).map((row) => [
      row.patientName,
      row.invoiceCount.toString(),
      formatCurrency(row.totalAmount),
      formatCurrency(row.totalPaid),
      formatCurrency(row.totalUnpaid),
    ]);

    (doc as any).autoTable({
      startY: y + 5,
      head: [["Patient", "Invoices", "Billed", "Paid", "Unpaid"]],
      body: patientData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    // Save the PDF
    const filename = `financial_report_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
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
        {activeTab === "overview" && (
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Export current view (PDF)
          </button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200 financials-hide-on-print">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("receipts")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "receipts"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          Bank Payment Receipts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("import_history")}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "import_history"
              ? "border-sky-500 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          Payment Import History
        </button>
      </div>

      {activeTab === "overview" && <>
      {/* ── View Toggle & Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 financials-hide-on-print">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">View:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setActiveView("overview")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeView === "overview"
                  ? "bg-sky-500 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView("doctors")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeView === "doctors"
                  ? "bg-sky-500 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Doctors
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 financials-hide-on-print">
        {/* Patient Filter */}
        <select
          value={patientFilter}
          onChange={(event) => setPatientFilter(event.target.value)}
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All patients</option>
          {patientOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        {/* Owner Filter */}
        <select
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All owners</option>
          {ownerOptions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Doctor Filter */}
        <select
          value={doctorFilter}
          onChange={(event) => setDoctorFilter(event.target.value)}
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All doctors</option>
          {doctorOptions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Service Filter */}
        <select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All services</option>
          {serviceOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {/* Item Type Filter */}
        <select
          value={itemTypeFilter}
          onChange={(event) => setItemTypeFilter(event.target.value as ItemType)}
          className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          title="Filter by invoice item type"
        >
          <option value="all">All item types</option>
          <option value="service">Services</option>
          <option value="tardoc">Tardoc</option>
          <option value="insurance">Insurance</option>
          <option value="material">Material</option>
        </select>

        {/* Custom Date Presets */}
        <select
          value={customDateRange ? `${customDateRange.from}|${customDateRange.to}` : "custom"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "custom") {
              setCustomDateRange(null);
              return;
            }
            const [from, to, label] = value.split("|");
            setDateFrom(from);
            setDateTo(to);
            setCustomDateRange({ label: label || "Custom", from, to });
          }}
          className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="custom">Custom date...</option>
          <option value={`${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]}|${new Date().toISOString().split("T")[0]}|This Month`}>This Month</option>
          <option value={`${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0]}|${new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0]}|Last Month`}>Last Month</option>
          <option value={`${new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]}|${new Date().toISOString().split("T")[0]}|This Year`}>This Year</option>
          <option value={`${new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split("T")[0]}|${new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split("T")[0]}|Last Year`}>Last Year</option>
          <option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}|${new Date().toISOString().split("T")[0]}|Last 7 Days`}>Last 7 Days</option>
          <option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}|${new Date().toISOString().split("T")[0]}|Last 30 Days`}>Last 30 Days</option>
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setCustomDateRange(null);
            }}
            className="w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="From"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setCustomDateRange(null);
            }}
            className="w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="To"
          />
        </div>

        {/* Invoice Count Range (Doctor View Only) */}
        {activeView === "doctors" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Invoices:</span>
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={invoiceCountMin}
              onChange={(event) => setInvoiceCountMin(event.target.value)}
              className="w-[70px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <span className="text-xs text-slate-400">-</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              value={invoiceCountMax}
              onChange={(event) => setInvoiceCountMax(event.target.value)}
              className="w-[70px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showOnlyUnpaid}
            onChange={(event) => setShowOnlyUnpaid(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Unpaid only</span>
        </label>

        {/* Clear Filters */}
        <button
          type="button"
          onClick={() => {
            setPatientFilter("all");
            setOwnerFilter("all");
            setDoctorFilter("all");
            setServiceFilter("all");
            setItemTypeFilter("all");
            setDateFrom("");
            setDateTo("");
            setCustomDateRange(null);
            setInvoiceCountMin("");
            setInvoiceCountMax("");
            setShowOnlyUnpaid(false);
          }}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          Clear all
        </button>
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
                    {patientSummaryRows.length > 0
                      ? `${patientPage * ROWS_PER_PAGE + 1}\u2013${Math.min((patientPage + 1) * ROWS_PER_PAGE, patientSummaryRows.length)} of ${patientSummaryRows.length} patients`
                      : "Financial summary per patient."}
                  </p>
                </div>
                {patientSummaryRows.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No invoices for the current filters.
                  </p>
                ) : (
                  <>
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
                          {paginatedPatientRows.map((row) => (
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
                    {totalPatientPages > 1 && (
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          disabled={patientPage === 0}
                          onClick={() => setPatientPage((p) => Math.max(0, p - 1))}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-[11px] text-slate-500">
                          Page {patientPage + 1} of {totalPatientPages}
                        </span>
                        <button
                          type="button"
                          disabled={patientPage >= totalPatientPages - 1}
                          onClick={() => setPatientPage((p) => Math.min(totalPatientPages - 1, p + 1))}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
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
                  Showing {invoicePage * ROWS_PER_PAGE + 1}&ndash;{Math.min((invoicePage + 1) * ROWS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length}
                  {" "}invoices.
                </p>
              </div>
              {filteredInvoices.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No invoices match the current filters.
                </p>
              ) : (
                <>
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
                        {paginatedInvoices.map((invoice) => (
                          <tr key={invoice.id} className="align-top">
                            <td className="py-1.5 pr-3 text-slate-700">
                              {formatShortDate(invoice.invoice_date)}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-900">
                              {invoice.patientName}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {invoice.ownerLabel}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-700">
                              {invoice.invoice_number || "Invoice"}
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
                                  invoice.is_complimentary
                                    ? "inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-50"
                                    : invoice.isPaid
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
                  {totalInvoicePages > 1 && (
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={invoicePage === 0}
                        onClick={() => setInvoicePage((p) => Math.max(0, p - 1))}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-[11px] text-slate-500">
                        Page {invoicePage + 1} of {totalInvoicePages}
                      </span>
                      <button
                        type="button"
                        disabled={invoicePage >= totalInvoicePages - 1}
                        onClick={() => setInvoicePage((p) => Math.min(totalInvoicePages - 1, p + 1))}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Doctors View ────────────────────────────────────────────────── */}
      {activeView === "doctors" && (
        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Doctor Performance Report
              </h2>
              <p className="text-[11px] text-slate-500">
                Summary by doctor with invoice counts, date ranges, and services.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              {filteredDoctorRows.length > 0
                ? `${doctorPage * ROWS_PER_PAGE + 1}–${Math.min((doctorPage + 1) * ROWS_PER_PAGE, filteredDoctorRows.length)} of ${filteredDoctorRows.length} doctors`
                : "No doctors match the current filters."}
            </p>
          </div>

          {filteredDoctorRows.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              No doctors match the current filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="border-b text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Doctor</th>
                      <th className="py-2 pr-3 font-medium text-center"># of Invoices</th>
                      <th className="py-2 pr-3 font-medium">From Date</th>
                      <th className="py-2 pr-3 font-medium">To Date</th>
                      <th className="py-2 pr-3 font-medium">Billed</th>
                      <th className="py-2 pr-3 font-medium">Paid</th>
                      <th className="py-2 pr-3 font-medium">Unpaid</th>
                      <th className="py-2 pr-0 font-medium">Services</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedDoctorRows.map((row) => (
                      <tr key={row.doctorKey} className="align-top hover:bg-slate-50/50">
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {row.doctorName}
                        </td>
                        <td className="py-2 pr-3 text-slate-700 text-center font-semibold">
                          {row.invoiceCount}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {formatShortDate(row.firstInvoiceDate)}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {formatShortDate(row.lastInvoiceDate)}
                        </td>
                        <td className="py-2 pr-3 text-slate-700 font-medium">
                          {formatCurrency(row.totalAmount)}
                        </td>
                        <td className="py-2 pr-3 text-emerald-600">
                          {formatCurrency(row.totalPaid)}
                        </td>
                        <td className="py-2 pr-3 text-amber-600">
                          {formatCurrency(row.totalUnpaid)}
                        </td>
                        <td className="py-2 pr-0">
                          <div className="max-w-[200px] truncate" title={row.services.join(", ")}>
                            {row.services.length > 0 ? (
                              <span className="text-[10px] text-slate-500">
                                {row.services.slice(0, 2).join(", ")}
                                {row.services.length > 2 && ` +${row.services.length - 2} more`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalDoctorPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    disabled={doctorPage === 0}
                    onClick={() => setDoctorPage((p) => Math.max(0, p - 1))}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Page {doctorPage + 1} of {totalDoctorPages}
                  </span>
                  <button
                    type="button"
                    disabled={doctorPage >= totalDoctorPages - 1}
                    onClick={() => setDoctorPage((p) => Math.min(totalDoctorPages - 1, p + 1))}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      </>}
      {activeTab === "receipts" && <BankPaymentReceipts />}
      {activeTab === "import_history" && <PaymentImportHistory />}

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

// ─── Bank Payment Receipts Tab ────────────────────────────────────────────────

type ReceiptFile = {
  name: string;
  created_at: string;
  size: number;
  url: string;
};

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isImage(name: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(fileExt(name));
}

function isHeicImage(name: string) {
  return ["heic", "heif"].includes(fileExt(name));
}

function isRegularImage(name: string) {
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt(name));
}

function isPdf(name: string) {
  return fileExt(name) === "pdf";
}

function isXml(name: string) {
  return fileExt(name) === "xml";
}

function displayName(raw: string) {
  return raw.replace(/^\d+_/, "");
}

// Parse camt.054 XML bank statement
type ParsedTransaction = {
  date: string;
  amount: string;
  currency: string;
  debtor: string;
  reference: string;
  description: string;
};

function parseCamt054Xml(xmlText: string): ParsedTransaction[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    
    // Check for parsing errors
    const parserError = doc.querySelector("parsererror");
    if (parserError) return [];

    const transactions: ParsedTransaction[] = [];
    const entries = doc.querySelectorAll("Ntry");

    entries.forEach((entry) => {
      const date = entry.querySelector("BookgDt Dt")?.textContent || "";
      const amtEl = entry.querySelector("Amt");
      const amount = amtEl?.textContent || "0";
      const currency = amtEl?.getAttribute("Ccy") || "";
      const cdtDbtInd = entry.querySelector("CdtDbtInd")?.textContent || "";
      
      // Get debtor name from transaction details
      const debtor = entry.querySelector("TxDtls RltdPties Dbtr Pty Nm")?.textContent || 
                     entry.querySelector("TxDtls RltdPties UltmtDbtr Pty Nm")?.textContent || 
                     "Unknown";
      
      // Get reference (QRR or other)
      const reference = entry.querySelector("TxDtls RmtInf Strd CdtrRefInf Ref")?.textContent || 
                       entry.querySelector("TxDtls Refs EndToEndId")?.textContent || 
                       "";
      
      const description = entry.querySelector("AddtlNtryInf")?.textContent || 
                         entry.querySelector("TxDtls AddtlTxInf")?.textContent || 
                         "";

      transactions.push({
        date,
        amount: `${cdtDbtInd === "DBIT" ? "-" : ""}${amount}`,
        currency,
        debtor,
        reference,
        description,
      });
    });

    return transactions;
  } catch {
    return [];
  }
}

function BankPaymentReceipts() {
  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReceiptFile | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlTransactions, setXmlTransactions] = useState<ParsedTransaction[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BUCKET = "finance-documents";

  // Fetch and parse XML when preview changes
  useEffect(() => {
    if (!preview || !isXml(preview.name)) {
      setXmlContent(null);
      setXmlTransactions([]);
      return;
    }

    const previewUrl = preview.url;
    async function fetchXml() {
      try {
        const response = await fetch(previewUrl);
        const text = await response.text();
        setXmlContent(text);
        const parsed = parseCamt054Xml(text);
        setXmlTransactions(parsed);
      } catch {
        setXmlContent(null);
        setXmlTransactions([]);
      }
    }

    void fetchXml();
  }, [preview]);

  async function handleProcessPayments() {
    if (!xmlContent || !preview) return;
    setProcessing(true);
    setProcessResult(null);
    setError(null);
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const user = authData?.user;
      const meta = (user?.user_metadata || {}) as Record<string, unknown>;
      const userName = [meta.first_name, meta.last_name].filter(Boolean).join(" ") || user?.email || null;

      const res = await fetch("/api/bank-payments/process-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xmlContent,
          fileName: displayName(preview.name),
          fileUrl: preview.url,
          userId: user?.id || null,
          userName,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to process payments");
      } else {
        setProcessResult(json);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process payments");
    }
    setProcessing(false);
  }

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: listError } = await supabaseClient.storage
        .from(BUCKET)
        .list("", { sortBy: { column: "created_at", order: "desc" } });

      if (listError) {
        setError(listError.message);
        setFiles([]);
      } else {
        const items: ReceiptFile[] = (data || [])
          .filter((f) => f.name && !f.name.startsWith("."))
          .map((f) => {
            const { data: urlData } = supabaseClient.storage
              .from(BUCKET)
              .getPublicUrl(f.name);
            const baseUrl = urlData?.publicUrl || "";
            
            // Use appropriate API for image display
            let displayUrl = baseUrl;
            if (baseUrl && isHeicImage(f.name)) {
              displayUrl = `/api/documents/convert-heic?url=${encodeURIComponent(baseUrl)}`;
            } else if (baseUrl && isRegularImage(f.name)) {
              displayUrl = `/api/documents/proxy-image?url=${encodeURIComponent(baseUrl)}`;
            }
            
            return {
              name: f.name,
              created_at: f.created_at || "",
              size: (f.metadata as any)?.size || 0,
              url: displayUrl,
            };
          });
        setFiles(items);
      }
    } catch {
      setError("Failed to load files.");
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;
      setUploading(true);
      setError(null);

      const errors: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabaseClient.storage
          .from(BUCKET)
          .upload(safeName, file, { upsert: false });
        if (uploadError) {
          errors.push(`${file.name}: ${uploadError.message}`);
        }
      }

      if (errors.length > 0) setError(errors.join("; "));
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploading(false);
      void loadFiles();
    },
    [loadFiles],
  );

  const handleDelete = useCallback(
    async (file: ReceiptFile) => {
      if (!window.confirm(`Delete "${displayName(file.name)}"?`)) return;
      const { error: delError } = await supabaseClient.storage
        .from(BUCKET)
        .remove([file.name]);
      if (delError) {
        setError(delError.message);
      } else {
        if (preview?.name === file.name) setPreview(null);
        void loadFiles();
      }
    },
    [loadFiles, preview],
  );

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bank Payment Receipts</h2>
          <p className="mt-0.5 text-sm text-slate-500">Upload and manage bank payment receipt documents.</p>
        </div>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm hover:bg-sky-100 transition-colors ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {uploading ? "Uploading..." : "Upload File"}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.xml"
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Split pane: list + preview */}
      <div className="flex min-h-[520px]">
        {/* ── File list ── */}
        <div className={`flex flex-col ${preview ? "w-2/5 border-r border-slate-100" : "w-full"} transition-all`}>
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <p className="text-sm text-slate-400">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <svg className="h-14 w-14 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="mt-3 text-sm font-medium text-slate-500">No receipts uploaded yet</p>
              <p className="mt-1 text-xs text-slate-400">Click &ldquo;Upload File&rdquo; to get started.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">File Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded</th>
                  {!preview && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Size</th>}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {files.map((file) => {
                  const isSelected = preview?.name === file.name;
                  return (
                    <tr
                      key={file.name}
                      onClick={() => setPreview(isSelected ? null : file)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-sky-50"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {/* File type icon */}
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase ${
                            isPdf(file.name) ? "bg-red-100 text-red-600" :
                            isImage(file.name) ? "bg-emerald-100 text-emerald-600" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            {fileExt(file.name) || "?"}
                          </div>
                          <span className={`text-sm font-medium truncate max-w-[180px] ${isSelected ? "text-sky-700" : "text-slate-800"}`}>
                            {displayName(file.name)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                        {file.created_at
                          ? new Date(file.created_at).toLocaleDateString(undefined, {
                              year: "numeric", month: "short", day: "numeric",
                            })
                          : "-"}
                      </td>
                      {!preview && (
                        <td className="px-4 py-3.5 text-sm text-slate-400">{formatFileSize(file.size)}</td>
                      )}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 hover:text-sky-800"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(file)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Preview panel ── */}
        {preview && (
          <div className="flex w-3/5 flex-col">
            {/* Preview header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{displayName(preview.name)}</p>
                <p className="text-xs text-slate-400">{formatFileSize(preview.size)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Open in new tab ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex flex-1 bg-slate-100/60 p-4 overflow-auto">
              {isPdf(preview.name) ? (
                <iframe
                  src={preview.url}
                  className="h-full w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                  style={{ minHeight: "460px" }}
                  title={displayName(preview.name)}
                />
              ) : isImage(preview.name) ? (
                <div className="flex flex-1 items-center justify-center">
                  <img
                    src={preview.url}
                    alt={displayName(preview.name)}
                    className="max-h-[460px] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                  />
                </div>
              ) : isXml(preview.name) && xmlTransactions.length > 0 ? (
                <div className="flex-1 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Bank Transactions</h3>
                      <p className="text-xs text-slate-500">{xmlTransactions.length} transaction{xmlTransactions.length !== 1 ? "s" : ""} found</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleProcessPayments}
                      disabled={processing}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors ${
                        processing
                          ? "bg-slate-400 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {processing ? "Processing..." : "Match & Tag Payments"}
                    </button>
                  </div>

                  {/* Process Results */}
                  {processResult && (
                    <div className="border-b border-slate-100 px-4 py-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          Matched: {processResult.summary.matched}
                        </span>
                        {processResult.summary.underpaid > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            Underpaid: {processResult.summary.underpaid}
                          </span>
                        )}
                        {processResult.summary.overpaid > 0 && (
                          <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold text-orange-700 border border-orange-200">
                            Overpaid: {processResult.summary.overpaid}
                          </span>
                        )}
                        {processResult.summary.alreadyPaid > 0 && (
                          <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700 border border-sky-200">
                            Already Paid: {processResult.summary.alreadyPaid}
                          </span>
                        )}
                        {processResult.summary.unmatched > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700 border border-red-200">
                            Unmatched: {processResult.summary.unmatched}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 border border-slate-200">
                          Total: CHF {processResult.summary.totalAmount?.toFixed(2)}
                        </span>
                      </div>
                      {processResult.summary.bankName && (
                        <p className="text-[10px] text-slate-500">
                          Bank: {processResult.summary.bankName} | IBAN: {processResult.summary.iban}
                        </p>
                      )}
                      {/* Per-transaction results */}
                      <div className="space-y-1">
                        {processResult.results?.map((r: any, i: number) => {
                          const statusColors: Record<string, string> = {
                            matched: "bg-emerald-50 text-emerald-800 border-emerald-200",
                            underpaid: "bg-amber-50 text-amber-800 border-amber-200",
                            overpaid: "bg-orange-50 text-orange-800 border-orange-200",
                            already_paid: "bg-sky-50 text-sky-800 border-sky-200",
                            unmatched: "bg-red-50 text-red-800 border-red-200",
                            duplicate: "bg-purple-50 text-purple-800 border-purple-200",
                            error: "bg-red-100 text-red-900 border-red-300",
                          };
                          return (
                            <div key={i} className={`rounded-md border px-3 py-2 text-[11px] ${statusColors[r.matchStatus] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{r.amount?.toFixed(2)} {r.currency}</span>
                                <span className="uppercase text-[9px] font-bold tracking-wider">{r.matchStatus.replace("_", " ")}</span>
                              </div>
                              <p className="mt-0.5">{r.matchNotes}</p>
                              {r.debtorName && <p className="text-[10px] opacity-70">From: {r.debtorName}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="overflow-auto" style={{ maxHeight: processResult ? "250px" : "420px" }}>
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
                          <th className="px-4 py-2.5 font-semibold text-slate-600">Amount</th>
                          <th className="px-4 py-2.5 font-semibold text-slate-600">Debtor</th>
                          <th className="px-4 py-2.5 font-semibold text-slate-600">Reference</th>
                          <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {xmlTransactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                              {tx.date ? new Date(tx.date).toLocaleDateString(undefined, {
                                year: "numeric", month: "short", day: "numeric"
                              }) : "-"}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`font-semibold ${tx.amount.startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>
                                {tx.amount} {tx.currency}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate" title={tx.debtor}>
                              {tx.debtor}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px] max-w-[180px] truncate" title={tx.reference}>
                              {tx.reference || "-"}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-[11px] max-w-[220px] truncate" title={tx.description}>
                              {tx.description || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-lg font-bold uppercase text-slate-500">
                    {fileExt(preview.name)}
                  </div>
                  <p className="text-sm text-slate-500">Preview not available for this file type.</p>
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    Download / Open
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payment Import History Tab ──────────────────────────────────────────────

type ImportRecord = {
  id: string;
  file_name: string;
  file_url: string | null;
  imported_at: string;
  imported_by_name: string | null;
  total_transactions: number;
  matched_count: number;
  unmatched_count: number;
  already_paid_count: number;
  overpaid_count: number;
  underpaid_count: number;
  total_amount: number;
  matched_amount: number;
  message_id: string | null;
  iban: string | null;
  bank_name: string | null;
  statement_date_from: string | null;
  statement_date_to: string | null;
  status: string;
  error_message: string | null;
};

type ImportItem = {
  id: string;
  import_id: string;
  booking_date: string | null;
  amount: number;
  currency: string;
  reference_number: string | null;
  debtor_name: string | null;
  ultimate_debtor_name: string | null;
  debtor_iban: string | null;
  description: string | null;
  bank_reference: string | null;
  end_to_end_id: string | null;
  credit_debit: string;
  match_status: string;
  match_notes: string | null;
  matched_invoice_id: string | null;
  matched_installment_id: string | null;
  matched_invoice_number: string | null;
  previous_paid_amount: number | null;
  new_paid_amount: number | null;
};

function PaymentImportHistory() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabaseClient
        .from("bank_payment_imports")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(50);
      setImports((data as ImportRecord[]) || []);
      setLoading(false);
    }
    void load();
  }, []);

  async function loadItems(importId: string) {
    setItemsLoading(true);
    const { data } = await supabaseClient
      .from("bank_payment_import_items")
      .select("*")
      .eq("import_id", importId)
      .order("booking_date", { ascending: true });
    setItems((data as ImportItem[]) || []);
    setItemsLoading(false);
  }

  function handleSelectImport(rec: ImportRecord) {
    if (selectedImport?.id === rec.id) {
      setSelectedImport(null);
      setItems([]);
    } else {
      setSelectedImport(rec);
      void loadItems(rec.id);
    }
  }

  const statusColors: Record<string, string> = {
    matched: "bg-emerald-50 text-emerald-700 border-emerald-200",
    underpaid: "bg-amber-50 text-amber-700 border-amber-200",
    overpaid: "bg-orange-50 text-orange-700 border-orange-200",
    already_paid: "bg-sky-50 text-sky-700 border-sky-200",
    unmatched: "bg-red-50 text-red-700 border-red-200",
    duplicate: "bg-purple-50 text-purple-700 border-purple-200",
    error: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Payment Import History</h2>
        <p className="mt-0.5 text-sm text-slate-500">History of bank XML payment file imports and matching results.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-slate-400">Loading import history...</p>
        </div>
      ) : imports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="h-14 w-14 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-500">No payment imports yet</p>
          <p className="mt-1 text-xs text-slate-400">Upload and process a bank XML file from the Bank Payment Receipts tab.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {imports.map((rec) => {
            const isSelected = selectedImport?.id === rec.id;
            const importStatus = rec.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                                 rec.status === "partial" ? "bg-amber-50 text-amber-700" :
                                 "bg-red-50 text-red-700";
            return (
              <div key={rec.id}>
                <button
                  type="button"
                  onClick={() => handleSelectImport(rec)}
                  className={`w-full text-left px-6 py-4 transition-colors hover:bg-slate-50 ${isSelected ? "bg-sky-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{rec.file_name}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${importStatus}`}>
                          {rec.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{new Date(rec.imported_at).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {rec.imported_by_name && <span>by {rec.imported_by_name}</span>}
                        {rec.bank_name && <span>{rec.bank_name}</span>}
                        {rec.iban && <span className="font-mono text-[10px]">{rec.iban}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                        {rec.total_transactions} txns
                      </span>
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        {rec.matched_count} matched
                      </span>
                      {rec.unmatched_count > 0 && (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                          {rec.unmatched_count} unmatched
                        </span>
                      )}
                      {rec.underpaid_count > 0 && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                          {rec.underpaid_count} underpaid
                        </span>
                      )}
                      {rec.overpaid_count > 0 && (
                        <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                          {rec.overpaid_count} overpaid
                        </span>
                      )}
                      {rec.already_paid_count > 0 && (
                        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">
                          {rec.already_paid_count} already paid
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>Total: <strong className="text-slate-700">CHF {Number(rec.total_amount).toFixed(2)}</strong></span>
                    <span>Matched: <strong className="text-emerald-700">CHF {Number(rec.matched_amount).toFixed(2)}</strong></span>
                    {rec.statement_date_from && rec.statement_date_to && (
                      <span>Period: {rec.statement_date_from.split("T")[0]} → {rec.statement_date_to.split("T")[0]}</span>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                    {rec.error_message && (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {rec.error_message}
                      </div>
                    )}
                    {itemsLoading ? (
                      <p className="text-xs text-slate-400 py-4 text-center">Loading transactions...</p>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No transaction details available.</p>
                    ) : (
                      <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: "400px" }}>
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 font-semibold text-slate-600">Status</th>
                              <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
                              <th className="px-3 py-2 font-semibold text-slate-600">Amount</th>
                              <th className="px-3 py-2 font-semibold text-slate-600">Debtor</th>
                              <th className="px-3 py-2 font-semibold text-slate-600">Reference</th>
                              <th className="px-3 py-2 font-semibold text-slate-600">Invoice</th>
                              <th className="px-3 py-2 font-semibold text-slate-600">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {items.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusColors[item.match_status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                    {item.match_status.replace("_", " ")}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                  {item.booking_date ? new Date(item.booking_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="font-semibold text-emerald-600">
                                    {Number(item.amount).toFixed(2)} {item.currency}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-700 max-w-[140px] truncate" title={item.debtor_name || item.ultimate_debtor_name || ""}>
                                  {item.ultimate_debtor_name || item.debtor_name || "-"}
                                </td>
                                <td className="px-3 py-2 text-slate-500 font-mono text-[9px] max-w-[140px] truncate" title={item.reference_number || ""}>
                                  {item.reference_number || "-"}
                                </td>
                                <td className="px-3 py-2 text-slate-700 font-medium">
                                  {item.matched_invoice_number || "-"}
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-[10px] max-w-[200px]" title={item.match_notes || ""}>
                                  <span className="line-clamp-2">{item.match_notes || "-"}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
