"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  TARDOC_MEDICINES,
  TARDOC_TARIFF_ITEMS,
  DEFAULT_CANTON,
  CANTON_TAX_POINT_VALUES,
  calculateTardocPrice,
  formatChf,
  type TardocMedicine,
  type SwissCanton,
} from "@/lib/tardoc";
import InsuranceBillingModal from "@/components/InsuranceBillingModal";
import InvoiceStatusBadge from "@/components/InvoiceStatusBadge";
import { type MediDataInvoiceStatus } from "@/lib/medidata";

type TaskPriority = "low" | "medium" | "high";

type TaskType = "todo" | "call" | "email" | "other";

type ConsultationRecordType =
  | "notes"
  | "prescription"
  | "invoice"
  | "file"
  | "photo"
  | "3d"
  | "patient_information"
  | "documents"
  | "form_photos";

type SortOrder = "desc" | "asc";

type InvoiceStatus =
  | "OPEN"
  | "PAID"
  | "CANCELLED"
  | "OVERPAID"
  | "PARTIAL_LOSS"
  | "PARTIAL_PAID";

const INVOICE_STATUS_DISPLAY: Record<InvoiceStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  OPEN: { label: "Open", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  PAID: { label: "Paid", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
  CANCELLED: { label: "Cancelled", color: "text-slate-500", bgColor: "bg-slate-50", borderColor: "border-slate-200" },
  OVERPAID: { label: "Overpaid", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  PARTIAL_LOSS: { label: "Partial Loss", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
  PARTIAL_PAID: { label: "Partial Paid", color: "text-cyan-700", bgColor: "bg-cyan-50", borderColor: "border-cyan-200" },
};

type ConsultationRow = {
  id: string;
  patient_id: string;
  consultation_id: string;
  title: string;
  content: string | null;
  record_type: ConsultationRecordType;
  doctor_user_id: string | null;
  doctor_name: string | null;
  scheduled_at: string;
  payment_method: string | null;
  duration_seconds: number | null;
  invoice_total_amount: number | null;
  invoice_is_complimentary: boolean;
  invoice_is_paid: boolean | null;
  invoice_status: InvoiceStatus | null;
  invoice_paid_amount: number | null;
  cash_receipt_path: string | null;
  invoice_pdf_path: string | null;
  payment_link_token: string | null;
  payrexx_payment_link: string | null;
  payrexx_payment_status: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  is_archived: boolean;
  archived_at: string | null;
};

type PlatformUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type PrescriptionLine = {
  medicineId: string;
  dosageId: string;
};

type InvoiceServiceLine = {
  serviceId: string;
  quantity: number;
  unitPrice: number | null;
  groupId: string | null;
  discountPercent: number | null;
};

type InvoiceService = {
  id: string;
  name: string;
  code: string | null;
  base_price: number | null;
  category_id: string | null;
};

type InvoiceServiceGroup = {
  id: string;
  name: string;
  discount_percent: number | null;
};

type InvoiceServiceCategory = {
  id: string;
  name: string;
};

type InvoiceGroupServiceLink = {
  group_id: string;
  service_id: string;
  discount_percent: number | null;
};

type InvoicePaymentTerm = "full" | "installment";

type InvoiceExtraOption = "complimentary" | null;

type InvoiceInstallment = {
  id: string;
  percent: number;
  dueDate: string;
};

// TARDOC-compliant medicines for Swiss healthcare billing
// Transformed from TARDOC_MEDICINES for UI compatibility
const CLINIC_MEDICINES = TARDOC_MEDICINES.filter(med => med.isActive).map(med => ({
  id: med.id,
  name: med.name,
  nameFr: med.nameFr,
  atcCode: med.atcCode,
  swissmedicNumber: med.swissmedicNumber,
  pharmacode: med.pharmacode,
  requiresPrescription: med.requiresPrescription,
  dosages: [
    {
      id: `${med.id}_standard`,
      label: `${med.unitSize} - Standard dose`,
      price: med.pricePublic
    },
    {
      id: `${med.id}_double`,
      label: `${med.unitSize} x2 - Double quantity`,
      price: med.pricePublic * 2
    },
  ],
}));

// Legacy alias for backward compatibility
const TEST_MEDICINES = CLINIC_MEDICINES;

function formatLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds =
    Number.isFinite(totalSeconds) && totalSeconds > 0
      ? Math.floor(totalSeconds)
      : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

type AxenitaPdfDocument = {
  folderName: string;
  fileName: string;
  fileType: "ap" | "af" | "notes" | "consultation";
  content: string;
  firstName: string | null;
  lastName: string | null;
};

export default function MedicalConsultationsCard({
  patientId,
  recordTypeFilter,
  patientFirstName,
  patientLastName,
}: {
  patientId: string;
  recordTypeFilter?: ConsultationRecordType;
  patientFirstName?: string;
  patientLastName?: string;
}) {
  const router = useRouter();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskContent, setTaskContent] = useState("");
  const [taskActivityDate, setTaskActivityDate] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("todo");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskAssignedUserId, setTaskAssignedUserId] = useState<string>("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskSaveError, setTaskSaveError] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<PlatformUser[]>([]);

  const [newConsultationOpen, setNewConsultationOpen] = useState(false);
  const [consultationDate, setConsultationDate] = useState(
    formatLocalDateInputValue(new Date()),
  );
  const [consultationHour, setConsultationHour] = useState("");
  const [consultationMinute, setConsultationMinute] = useState("");
  const [consultationDoctorId, setConsultationDoctorId] = useState<string>("");
  const [consultationSaving, setConsultationSaving] = useState(false);
  const [consultationError, setConsultationError] = useState<string | null>(
    null,
  );
  const [consultationTitle, setConsultationTitle] = useState("");
  const [consultationRecordType, setConsultationRecordType] =
    useState<ConsultationRecordType>("notes");
  const [consultationContentHtml, setConsultationContentHtml] = useState("");
  const [consultationMentionActive, setConsultationMentionActive] = useState(false);
  const [consultationMentionQuery, setConsultationMentionQuery] = useState("");
  const [consultationMentionUserIds, setConsultationMentionUserIds] = useState<string[]>([]);
  const [prescriptionLines, setPrescriptionLines] = useState<PrescriptionLine[]>(
    [],
  );
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState("");
  const [invoiceMode, setInvoiceMode] = useState<"group" | "individual" | "tardoc">(
    "individual", // default to Individual Services
  );
  const [selectedTardocCode, setSelectedTardocCode] = useState("");
  const [invoiceCanton, setInvoiceCanton] = useState<SwissCanton>(DEFAULT_CANTON);
  const [invoiceGroupId, setInvoiceGroupId] = useState("");
  const [invoicePaymentTerm, setInvoicePaymentTerm] =
    useState<InvoicePaymentTerm>("full");
  const [invoiceExtraOption, setInvoiceExtraOption] =
    useState<InvoiceExtraOption>(null);
  const [invoiceInstallments, setInvoiceInstallments] = useState<
    InvoiceInstallment[]
  >([]);
  const [invoiceServiceLines, setInvoiceServiceLines] = useState<
    InvoiceServiceLine[]
  >([]);
  const [invoiceServiceGroups, setInvoiceServiceGroups] = useState<
    InvoiceServiceGroup[]
  >([]);
  const [invoiceServices, setInvoiceServices] = useState<InvoiceService[]>([]);
  const [invoiceServiceCategories, setInvoiceServiceCategories] = useState<
    InvoiceServiceCategory[]
  >([]);
  const [invoiceGroupServices, setInvoiceGroupServices] = useState<
    InvoiceGroupServiceLink[]
  >([]);
  const [invoiceSelectedCategoryId, setInvoiceSelectedCategoryId] =
    useState("");
  const [invoiceSelectedServiceId, setInvoiceSelectedServiceId] =
    useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [consultationsLoading, setConsultationsLoading] = useState(false);
  const [consultationsError, setConsultationsError] = useState<string | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [dateFrom, setDateFrom] = useState<string | "">("");
  const [dateTo, setDateTo] = useState<string | "">("");
  const [consultationDurationSeconds, setConsultationDurationSeconds] =
    useState<number>(0);
  const [
    consultationStopwatchStartedAt,
    setConsultationStopwatchStartedAt,
  ] = useState<number | null>(null);
  const [
    consultationStopwatchNow,
    setConsultationStopwatchNow,
  ] = useState<number>(Date.now());

  const [cashReceiptModalOpen, setCashReceiptModalOpen] = useState(false);
  const [cashReceiptTarget, setCashReceiptTarget] =
    useState<ConsultationRow | null>(null);
  const [cashReceiptFile, setCashReceiptFile] = useState<File | null>(null);
  const [cashReceiptUploading, setCashReceiptUploading] = useState(false);
  const [cashReceiptError, setCashReceiptError] = useState<string | null>(null);

  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<{ consultationId: string; url: string } | null>(null);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);

  const [editInvoiceModalOpen, setEditInvoiceModalOpen] = useState(false);
  const [editInvoiceTarget, setEditInvoiceTarget] = useState<ConsultationRow | null>(null);

  const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState(false);
  const [paymentStatusTarget, setPaymentStatusTarget] = useState<ConsultationRow | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const [insuranceBillingModalOpen, setInsuranceBillingModalOpen] = useState(false);
  const [insuranceBillingTarget, setInsuranceBillingTarget] = useState<ConsultationRow | null>(null);

  const [axenitaPdfDocs, setAxenitaPdfDocs] = useState<AxenitaPdfDocument[]>([]);
  const [axenitaPdfLoading, setAxenitaPdfLoading] = useState(false);
  const [axenitaPdfError, setAxenitaPdfError] = useState<string | null>(null);

  const consultationRecordTypeOptions: {
    value: ConsultationRecordType;
    label: string;
  }[] = [
      { value: "notes", label: "Notes" },
      { value: "prescription", label: "Prescription" },
      { value: "invoice", label: "Invoice" },
      { value: "file", label: "File" },
      { value: "photo", label: "Photo" },
      { value: "3d", label: "3D" },
      { value: "patient_information", label: "Patient Information" },
      { value: "documents", label: "Documents" },
      { value: "form_photos", label: "Form Photos" },
    ];

  const filteredSortedConsultations = useMemo(() => {
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const filtered = consultations.filter((row) => {
      const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null;
      if (!scheduled || Number.isNaN(scheduled.getTime())) return false;

      if (recordTypeFilter && row.record_type !== recordTypeFilter) return false;

      if (fromDate && scheduled < fromDate) return false;
      if (toDate) {
        const toInclusive = new Date(toDate);
        toInclusive.setHours(23, 59, 59, 999);
        if (scheduled > toInclusive) return false;
      }

      return true;
    });

    return filtered
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.scheduled_at).getTime();
        const bTime = new Date(b.scheduled_at).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
        return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [consultations, dateFrom, dateTo, sortOrder, recordTypeFilter]);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        const response = await fetch("/api/users/list");
        if (!response.ok) return;
        const json = (await response.json()) as PlatformUser[];
        if (!isMounted) return;
        setUserOptions(json);
      } catch {
      }
    }

    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!consultationStopwatchStartedAt) return;

    const intervalId = window.setInterval(() => {
      setConsultationStopwatchNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [consultationStopwatchStartedAt]);

  useEffect(() => {
    let isMounted = true;

    async function loadConsultations() {
      try {
        setConsultationsLoading(true);
        setConsultationsError(null);

        const { data, error } = await supabaseClient
          .from("consultations")
          .select(
            "id, patient_id, consultation_id, title, content, record_type, doctor_user_id, doctor_name, scheduled_at, payment_method, duration_seconds, invoice_total_amount, invoice_is_complimentary, invoice_is_paid, cash_receipt_path, invoice_pdf_path, payment_link_token, payrexx_payment_link, payrexx_payment_status, created_by_user_id, created_by_name, is_archived, archived_at",
          )
          .eq("patient_id", patientId)
          .eq("is_archived", showArchived ? true : false)
          .order("scheduled_at", { ascending: false });

        if (!isMounted) return;

        if (error || !data) {
          setConsultationsError(
            error?.message ?? "Failed to load consultations.",
          );
          setConsultations([]);
          setConsultationsLoading(false);
          return;
        }

        setConsultations(data as ConsultationRow[]);
        setConsultationsLoading(false);
      } catch {
        if (!isMounted) return;
        setConsultationsError("Failed to load consultations.");
        setConsultations([]);
        setConsultationsLoading(false);
      }
    }

    void loadConsultations();

    return () => {
      isMounted = false;
    };
  }, [patientId, showArchived]);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (!isMounted) return;
        const user = data?.user ?? null;
        if (user) {
          setCurrentUserId(user.id);
        } else {
          setCurrentUserId(null);
        }
      } catch {
        if (!isMounted) return;
        setCurrentUserId(null);
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAxenitaPdfDocuments() {
      if (!patientFirstName || !patientLastName) return;

      try {
        setAxenitaPdfLoading(true);
        setAxenitaPdfError(null);

        const response = await fetch("/api/patient-docs/parse-pdfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: patientFirstName,
            lastName: patientLastName,
            patientId,
          }),
        });

        if (!isMounted) return;

        if (!response.ok) {
          const errorData = await response.json();
          setAxenitaPdfError(errorData.error || "Failed to load PDF documents");
          setAxenitaPdfDocs([]);
          setAxenitaPdfLoading(false);
          return;
        }

        const data = await response.json();
        setAxenitaPdfDocs(data.documents || []);
        setAxenitaPdfLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        setAxenitaPdfError(err.message || "Failed to load PDF documents");
        setAxenitaPdfDocs([]);
        setAxenitaPdfLoading(false);
      }
    }

    void loadAxenitaPdfDocuments();

    return () => {
      isMounted = false;
    };
  }, [patientFirstName, patientLastName, patientId]);

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceOptions() {
      try {
        const [
          { data: groupData },
          { data: serviceData },
          { data: categoryData },
          { data: groupServiceData },
        ] = await Promise.all([
          supabaseClient
            .from("service_groups")
            .select("id, name, discount_percent")
            .order("name", { ascending: true }),
          supabaseClient
            .from("services")
            .select("id, name, code, base_price, category_id")
            .order("name", { ascending: true }),
          supabaseClient
            .from("service_categories")
            .select("id, name")
            .order("name", { ascending: true }),
          supabaseClient
            .from("service_group_services")
            .select("group_id, service_id, discount_percent"),
        ]);

        if (!isMounted) return;

        if (groupData) {
          setInvoiceServiceGroups(groupData as InvoiceServiceGroup[]);
        } else {
          setInvoiceServiceGroups([]);
        }

        if (serviceData) {
          const normalized = (serviceData as any[]).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            code: (row.code as string | null) ?? null,
            base_price:
              row.base_price !== null && row.base_price !== undefined
                ? Number(row.base_price)
                : 0,
            category_id:
              (row.category_id as string | null | undefined) ?? null,
          }));
          setInvoiceServices(normalized as InvoiceService[]);
        } else {
          setInvoiceServices([]);
        }

        if (categoryData) {
          setInvoiceServiceCategories(categoryData as InvoiceServiceCategory[]);
        } else {
          setInvoiceServiceCategories([]);
        }

        if (groupServiceData) {
          setInvoiceGroupServices(groupServiceData as InvoiceGroupServiceLink[]);
        } else {
          setInvoiceGroupServices([]);
        }
      } catch {
        if (!isMounted) return;
        setInvoiceServiceGroups([]);
        setInvoiceServices([]);
        setInvoiceServiceCategories([]);
        setInvoiceGroupServices([]);
      }
    }

    void loadInvoiceOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = taskName.trim();
    const content = taskContent.trim();

    if (!name) {
      setTaskSaveError("Task name is required.");
      return;
    }

    try {
      setTaskSaving(true);
      setTaskSaveError(null);

      const { data: authData } = await supabaseClient.auth.getUser();
      const authUser = authData?.user ?? null;

      let createdByUserId: string | null = null;
      let createdBy: string | null = null;

      if (authUser) {
        const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
        const first = (meta["first_name"] as string) || "";
        const last = (meta["last_name"] as string) || "";
        const fullName =
          [first, last].filter(Boolean).join(" ") || authUser.email || null;

        createdByUserId = authUser.id;
        createdBy = fullName;
      }

      const activityDateIso = taskActivityDate
        ? new Date(taskActivityDate).toISOString()
        : null;

      const assignedUserId = taskAssignedUserId || null;
      let assignedUserName: string | null = null;
      if (assignedUserId) {
        const assignedUser = userOptions.find((user) => user.id === assignedUserId);
        assignedUserName =
          (assignedUser?.full_name || assignedUser?.email || null) as
          | string
          | null;
      }

      const { error } = await supabaseClient.from("tasks").insert({
        patient_id: patientId,
        name,
        content: content || null,
        status: "not_started",
        priority: taskPriority,
        type: taskType,
        activity_date: activityDateIso,
        created_by_user_id: createdByUserId,
        created_by_name: createdBy,
        assigned_user_id: assignedUserId,
        assigned_user_name: assignedUserName,
      });

      if (error) {
        setTaskSaveError(error.message ?? "Failed to create task.");
        setTaskSaving(false);
        return;
      }

      setTaskName("");
      setTaskContent("");
      setTaskActivityDate("");
      setTaskAssignedUserId("");
      setTaskPriority("medium");
      setTaskType("todo");
      setTaskSaving(false);
      setTaskSaveError(null);
      setTaskModalOpen(false);
    } catch {
      setTaskSaveError("Unexpected error saving task.");
      setTaskSaving(false);
    }
  }

  async function handleArchiveConsultation(consultationId: string) {
    if (!consultationId) return;

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Archive this consultation? It will be moved to the archive and can be permanently deleted from there.",
      );
      if (!confirmed) return;
    }

    try {
      setConsultationsError(null);
      const { error } = await supabaseClient
        .from("consultations")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq("id", consultationId);

      if (error) {
        setConsultationsError(
          error.message ?? "Failed to archive consultation.",
        );
        return;
      }

      setConsultations((prev) =>
        prev.filter((row) => row.id !== consultationId),
      );
    } catch {
      setConsultationsError("Failed to archive consultation.");
    }
  }

  async function handleDeleteConsultation(consultationId: string) {
    if (!consultationId) return;

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Permanently delete this consultation? This cannot be undone.",
      );
      if (!confirmed) return;
    }

    try {
      setConsultationsError(null);
      const { error } = await supabaseClient
        .from("consultations")
        .delete()
        .eq("id", consultationId);

      if (error) {
        setConsultationsError(
          error.message ?? "Failed to delete consultation.",
        );
        return;
      }

      setConsultations((prev) =>
        prev.filter((row) => row.id !== consultationId),
      );
    } catch {
      setConsultationsError("Failed to delete consultation.");
    }
  }

  async function handleToggleInvoicePaid(
    consultationId: string,
    currentPaid: boolean,
  ) {
    if (!consultationId) return;

    try {
      setConsultationsError(null);
      const nextPaid = !currentPaid;

      const { error } = await supabaseClient
        .from("consultations")
        .update({ invoice_is_paid: nextPaid })
        .eq("id", consultationId);

      if (error) {
        setConsultationsError(
          error.message ?? "Failed to update invoice status.",
        );
        return;
      }

      setConsultations((prev) =>
        prev.map((row) =>
          row.id === consultationId ? { ...row, invoice_is_paid: nextPaid } : row,
        ),
      );

      router.refresh();
    } catch {
      setConsultationsError("Failed to update invoice status.");
    }
  }

  function openCashReceiptModal(target: ConsultationRow) {
    setCashReceiptTarget(target);
    setCashReceiptFile(null);
    setCashReceiptError(null);
    setCashReceiptModalOpen(true);
  }

  async function handleCashReceiptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cashReceiptTarget || !cashReceiptFile) {
      setCashReceiptError("Please choose a receipt file to upload.");
      return;
    }

    try {
      setCashReceiptUploading(true);
      setCashReceiptError(null);

      const ext = cashReceiptFile.name.split(".").pop() || "bin";
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "bin";
      const path = `${cashReceiptTarget.patient_id}/${cashReceiptTarget.consultation_id}-${Date.now()}.${safeExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("cash-receipts")
        .upload(path, cashReceiptFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: cashReceiptFile.type || undefined,
        });

      if (uploadError) {
        setCashReceiptError(
          uploadError.message ?? "Failed to upload receipt.",
        );
        setCashReceiptUploading(false);
        return;
      }

      // Get current user for audit trail
      const { data: authData } = await supabaseClient.auth.getUser();
      const userId = authData?.user?.id || null;
      const paidAt = new Date().toISOString();

      const { error } = await supabaseClient
        .from("consultations")
        .update({
          invoice_is_paid: true,
          cash_receipt_path: path,
          paid_at: paidAt,
          paid_by_user_id: userId,
        })
        .eq("id", cashReceiptTarget.id);

      if (error) {
        setCashReceiptError(error.message ?? "Failed to update invoice.");
        setCashReceiptUploading(false);
        return;
      }

      setConsultations((prev) =>
        prev.map((row) =>
          row.id === cashReceiptTarget.id
            ? { ...row, invoice_is_paid: true, cash_receipt_path: path }
            : row,
        ),
      );

      setCashReceiptUploading(false);
      setCashReceiptModalOpen(false);
      setCashReceiptTarget(null);
      setCashReceiptFile(null);

      router.refresh();
    } catch {
      setCashReceiptError("Unexpected error uploading receipt.");
      setCashReceiptUploading(false);
    }
  }

  function handleViewCashReceipt(path: string | null) {
    if (!path) return;
    try {
      const { data } = supabaseClient.storage
        .from("cash-receipts")
        .getPublicUrl(path);
      const url = data?.publicUrl;
      if (url && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setConsultationsError("Failed to open receipt.");
    }
  }

  async function handleGenerateInvoicePdf(consultationId: string) {
    try {
      setGeneratingPdf(consultationId);
      setPdfError(null);

      const response = await fetch("/api/invoices/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate PDF");
      }

      if (data.pdfUrl && typeof window !== "undefined") {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
      }

      if (data.paymentUrl) {
        setGeneratedPaymentLink({ consultationId, url: data.paymentUrl });
        setPaymentLinkCopied(false);
      }

      // Refresh consultation data to get updated invoice_pdf_path
      router.refresh();
      setGeneratingPdf(null);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setPdfError(error instanceof Error ? error.message : "Failed to generate PDF");
      setGeneratingPdf(null);
    }
  }

  function handleViewPdf(pdfPath: string) {
    try {
      const { data } = supabaseClient.storage
        .from("invoice-pdfs")
        .getPublicUrl(pdfPath);
      const url = data?.publicUrl;
      if (url) {
        setPdfViewerUrl(url);
        setPdfViewerOpen(true);
      }
    } catch (error) {
      console.error("Error viewing PDF:", error);
      alert("Failed to load PDF. Please try again.");
    }
  }

  function handleEditInvoice(invoice: ConsultationRow) {
    setEditInvoiceTarget(invoice);
    setEditInvoiceModalOpen(true);
  }

  function handleManagePaymentStatus(invoice: ConsultationRow) {
    setPaymentStatusTarget(invoice);
    setPaymentStatusModalOpen(true);
  }

  async function handleMarkInvoicePaid(consultationId: string, status: InvoiceStatus = "PAID", paidAmount?: number) {
    try {
      setMarkingPaid(true);

      // Get current user for audit trail
      const { data: authData } = await supabaseClient.auth.getUser();
      const userId = authData?.user?.id || null;
      const paidAt = new Date().toISOString();

      // Note: invoice_status and invoice_paid_amount columns don't exist in DB yet
      // For now, we only update invoice_is_paid which determines paid/unpaid status
      const updateData: Record<string, unknown> = {
        invoice_is_paid: status === "PAID" || status === "OVERPAID" || status === "PARTIAL_PAID",
        paid_at: paidAt,
        paid_by_user_id: userId,
      };

      const { error } = await supabaseClient
        .from("consultations")
        .update(updateData)
        .eq("id", consultationId);

      if (error) throw error;

      setConsultations(prev =>
        prev.map(c =>
          c.id === consultationId ? {
            ...c,
            invoice_is_paid: status === "PAID" || status === "OVERPAID" || status === "PARTIAL_PAID",
          } : c
        )
      );
      setPaymentStatusModalOpen(false);
      setMarkingPaid(false);
    } catch (error) {
      console.error("Error marking invoice paid:", error);
      alert("Failed to update payment status. Please try again.");
      setMarkingPaid(false);
    }
  }

  const formBaseSeconds = consultationDurationSeconds;
  const formRunningSeconds = consultationStopwatchStartedAt
    ? formBaseSeconds +
    Math.max(
      0,
      Math.floor(
        (consultationStopwatchNow - consultationStopwatchStartedAt) / 1000,
      ),
    )
    : formBaseSeconds;
  const formDisplayDuration = formatDuration(formRunningSeconds);
  const formStopwatchRunning = consultationStopwatchStartedAt !== null;

  const invoiceTotal = invoiceServiceLines.reduce((sum, line) => {
    if (!line.serviceId) return sum;
    const quantity = line.quantity > 0 ? line.quantity : 1;

    const unit = (() => {
      if (line.unitPrice !== null && Number.isFinite(line.unitPrice)) {
        return Math.max(0, line.unitPrice);
      }
      const service = invoiceServices.find(
        (s) => s.id === line.serviceId,
      );
      const base =
        service?.base_price !== null && service?.base_price !== undefined
          ? Number(service.base_price)
          : 0;
      return Number.isFinite(base) && base > 0 ? base : 0;
    })();

    return sum + unit * quantity;
  }, 0);

  const invoiceInstallmentsTotalPercent = invoiceInstallments.reduce(
    (sum, installment) =>
      sum +
      (Number.isFinite(installment.percent) ? Math.max(0, installment.percent) : 0),
    0,
  );
  const invoiceInstallmentsTotalPercentRounded = Number.isFinite(
    invoiceInstallmentsTotalPercent,
  )
    ? Math.round(invoiceInstallmentsTotalPercent * 100) / 100
    : 0;
  const invoiceInstallmentsPlanComplete =
    invoiceInstallmentsTotalPercentRounded === 100;

  return (
    <>
      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {showArchived ? "Archived consultations" : "Consultations"}
          </h3>
          <div className="flex items-center gap-3 text-sky-700">
            {!showArchived ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (consultationSaving) return;
                    const now = new Date();
                    const datePart = formatLocalDateInputValue(now);
                    const hourPart = now
                      .getHours()
                      .toString()
                      .padStart(2, "0");
                    const minutePart = now
                      .getMinutes()
                      .toString()
                      .padStart(2, "0");
                    setConsultationDate(datePart);
                    setConsultationHour(hourPart);
                    setConsultationMinute(minutePart);
                    setConsultationDoctorId("");
                    setConsultationError(null);
                    setConsultationTitle("");
                    setConsultationRecordType("prescription");
                    setConsultationContentHtml("");
                    setConsultationDurationSeconds(0);
                    setConsultationStopwatchStartedAt(null);
                    setConsultationStopwatchNow(Date.now());
                    setPrescriptionLines([
                      { medicineId: "", dosageId: "" },
                    ]);
                    setInvoicePaymentMethod("");
                    setInvoiceMode("individual");
                    setInvoiceGroupId("");
                    setInvoicePaymentTerm("full");
                    setInvoiceExtraOption(null);
                    setInvoiceInstallments([]);
                    setInvoiceServiceLines([]);
                    setInvoiceSelectedCategoryId("");
                    setInvoiceSelectedServiceId("");
                    if (currentUserId) {
                      setConsultationDoctorId(currentUserId);
                    }
                    setNewConsultationOpen(true);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm hover:bg-sky-100 hover:text-sky-800"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                  >
                    <path
                      d="M7 3.5h6M9 3.5v3.17L6.3 13.7A1.5 1.5 0 0 0 7.7 15.5h4.6a1.5 1.5 0 0 0 1.4-1.8L11 6.67V3.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (taskSaving) return;
                    setTaskModalOpen(true);
                    setTaskSaveError(null);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm hover:bg-sky-100 hover:text-sky-800"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                  >
                    <rect
                      x="4"
                      y="4"
                      width="12"
                      height="12"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M7.5 10.5 9.5 12.5 13 8.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="h-5 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => {
                    if (consultationSaving) return;
                    const now = new Date();
                    const datePart = formatLocalDateInputValue(now);
                    const hourPart = now
                      .getHours()
                      .toString()
                      .padStart(2, "0");
                    const minutePart = now
                      .getMinutes()
                      .toString()
                      .padStart(2, "0");
                    setConsultationDate(datePart);
                    setConsultationHour(hourPart);
                    setConsultationMinute(minutePart);
                    setConsultationDoctorId("");
                    setConsultationError(null);
                    setConsultationTitle("");
                    setConsultationRecordType("notes");
                    setConsultationContentHtml("");
                    setConsultationDurationSeconds(0);
                    setConsultationStopwatchStartedAt(null);
                    setConsultationStopwatchNow(Date.now());
                    setPrescriptionLines([]);
                    setInvoicePaymentMethod("");
                    setInvoiceMode("individual");
                    setInvoiceGroupId("");
                    setInvoicePaymentTerm("full");
                    setInvoiceExtraOption(null);
                    setInvoiceInstallments([]);
                    setInvoiceServiceLines([]);
                    setInvoiceSelectedCategoryId("");
                    setInvoiceSelectedServiceId("");
                    if (currentUserId) {
                      setConsultationDoctorId(currentUserId);
                    }
                    setNewConsultationOpen(true);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm hover:bg-sky-100 hover:text-sky-800"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                  >
                    <path
                      d="M10 4v12M4 10h12"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {showArchived ? "Back to active" : "View archive"}
            </button>
          </div>
        </div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/80 px-1 py-0.5">
            <span className="hidden sm:inline px-2 text-slate-500">Sort</span>
            <button
              type="button"
              onClick={() => setSortOrder("desc")}
              className={
                "rounded-full px-2 py-0.5 text-[11px] " +
                (sortOrder === "desc"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setSortOrder("asc")}
              className={
                "rounded-full px-2 py-0.5 text-[11px] " +
                (sortOrder === "asc"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Oldest
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
        {newConsultationOpen ? (
          <div className="mb-3 rounded-lg border border-sky-200/70 bg-sky-50/60 p-3 text-xs">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const hour = consultationHour.trim();
                const minute = consultationMinute.trim();
                if (!consultationDate || !hour || !minute || !consultationDoctorId) {
                  setConsultationError(
                    "Please select date, time, and doctor before creating a consultation.",
                  );
                  return;
                }

                const hourNumber = Number.parseInt(hour, 10);
                const minuteNumber = Number.parseInt(minute, 10);
                if (
                  Number.isNaN(hourNumber) ||
                  Number.isNaN(minuteNumber) ||
                  hourNumber < 0 ||
                  hourNumber > 23 ||
                  minuteNumber < 0 ||
                  minuteNumber > 59
                ) {
                  setConsultationError("Please enter a valid time.");
                  return;
                }

                const scheduledAtLocal = new Date(
                  `${consultationDate}T${hourNumber
                    .toString()
                    .padStart(2, "0")}:${minuteNumber
                      .toString()
                      .padStart(2, "0")}:00`,
                );
                if (Number.isNaN(scheduledAtLocal.getTime())) {
                  setConsultationError("Please enter a valid date and time.");
                  return;
                }

                const scheduledAtIso = scheduledAtLocal.toISOString();

                if (
                  consultationRecordType === "notes" &&
                  (!consultationContentHtml ||
                    consultationContentHtml.replace(/<[^>]+>/g, "").trim() === "")
                ) {
                  setConsultationError(
                    "Please enter note content before creating a consultation.",
                  );
                  return;
                }

                if (consultationRecordType === "prescription") {
                  const hasValidLine = prescriptionLines.some(
                    (line) => line.medicineId && line.dosageId,
                  );
                  if (!hasValidLine) {
                    setConsultationError(
                      "Please add at least one medicine and dosage before creating a prescription.",
                    );
                    return;
                  }
                }

                if (consultationRecordType === "invoice") {
                  if (!invoicePaymentMethod.trim()) {
                    setConsultationError(
                      "Please select a payment method before creating an invoice.",
                    );
                    return;
                  }

                  const hasService = invoiceServiceLines.some(
                    (line) => line.serviceId,
                  );
                  if (!hasService) {
                    setConsultationError(
                      "Please add at least one service to the invoice.",
                    );
                    return;
                  }

                  if (invoicePaymentTerm === "installment") {
                    const validInstallments = invoiceInstallments.filter(
                      (installment) =>
                        Number.isFinite(installment.percent) &&
                        installment.percent > 0,
                    );

                    if (validInstallments.length === 0) {
                      setConsultationError(
                        "Please add at least one installment for the invoice.",
                      );
                      return;
                    }

                    if (!invoiceInstallmentsPlanComplete) {
                      setConsultationError(
                        "Installment percentages must total 100% before saving the invoice.",
                      );
                      return;
                    }
                  }
                }

                void (async () => {
                  try {
                    setConsultationSaving(true);
                    setConsultationError(null);

                    const consultationId = `CONS-${Date.now()
                      .toString(36)
                      .toUpperCase()}`;
                    const effectiveTitle =
                      consultationTitle.trim() || consultationId;

                    const { data: authData } =
                      await supabaseClient.auth.getUser();
                    const authUser = authData?.user ?? null;

                    let createdByUserId: string | null = null;
                    let createdByName: string | null = null;
                    if (authUser) {
                      const meta = (authUser.user_metadata || {}) as Record<
                        string,
                        unknown
                      >;
                      const first = (meta["first_name"] as string) || "";
                      const last = (meta["last_name"] as string) || "";
                      const fullName =
                        [first, last].filter(Boolean).join(" ") ||
                        authUser.email ||
                        null;

                      createdByUserId = authUser.id;
                      createdByName = fullName;
                    }

                    let doctorName: string | null = null;
                    const doctor = userOptions.find(
                      (user) => user.id === consultationDoctorId,
                    );
                    if (doctor) {
                      doctorName =
                        (doctor.full_name || doctor.email || "Doctor") as string;
                    }

                    let durationSeconds = consultationDurationSeconds;
                    if (consultationStopwatchStartedAt) {
                      const elapsedSeconds = Math.max(
                        0,
                        Math.floor(
                          (Date.now() - consultationStopwatchStartedAt) / 1000,
                        ),
                      );
                      durationSeconds += elapsedSeconds;
                    }

                    let contentHtml: string | null = null;
                    let invoiceTotalAmountForInsert: number | null = null;
                    let invoiceIsComplimentaryForInsert = false;
                    let invoiceIsPaidForInsert = false;
                    if (consultationRecordType === "notes") {
                      contentHtml = consultationContentHtml;
                    } else if (consultationRecordType === "prescription") {
                      const lines = prescriptionLines.filter(
                        (line) => line.medicineId && line.dosageId,
                      );
                      const totalPrice = lines.reduce((sum, line) => {
                        const med = TEST_MEDICINES.find(
                          (m) => m.id === line.medicineId,
                        );
                        const dosage = med?.dosages.find(
                          (d) => d.id === line.dosageId,
                        );
                        return sum + (dosage?.price ?? 0);
                      }, 0);

                      const itemsHtml = lines
                        .map((line, index) => {
                          const med = TEST_MEDICINES.find(
                            (m) => m.id === line.medicineId,
                          );
                          if (!med) return "";
                          const dosage = med.dosages.find(
                            (d) => d.id === line.dosageId,
                          );
                          if (!dosage) return "";
                          const code = (index + 1).toString().padStart(4, "0");
                          const description = `${med.name} — ${dosage.label}`;
                          return `<tr><td class="px-2 py-1 border-t border-slate-100 align-top text-slate-500">${code}</td><td class="px-2 py-1 border-t border-slate-100 align-top">${description}</td><td class="px-2 py-1 border-t border-slate-100 text-right align-top">1</td><td class="px-2 py-1 border-t border-slate-100 text-left align-top">Stk</td><td class="px-2 py-1 border-t border-slate-100 text-right align-top">CHF ${dosage.price.toFixed(
                            2,
                          )}</td></tr>`;
                        })
                        .join("");

                      if (itemsHtml) {
                        contentHtml = `<div class="mt-1"><p class="mb-1 text-[11px]"><strong>Prescription</strong></p><table class="w-full border-collapse text-[11px]"><thead><tr class="bg-slate-50 text-slate-600"><th class="px-2 py-1 text-left font-semibold">Code</th><th class="px-2 py-1 text-left font-semibold">Item</th><th class="px-2 py-1 text-right font-semibold">Qty</th><th class="px-2 py-1 text-left font-semibold">Unit</th><th class="px-2 py-1 text-right font-semibold">Price</th></tr></thead><tbody>${itemsHtml}</tbody></table><p class="mt-1 text-[11px] text-slate-700"><strong>Estimated total:</strong> CHF ${totalPrice.toFixed(
                          2,
                        )}</p></div>`;
                      }
                    } else if (consultationRecordType === "invoice") {
                      const invoiceLines = invoiceServiceLines
                        .filter((line) => line.serviceId)
                        .map((line) => {
                          const service = invoiceServices.find(
                            (s) => s.id === line.serviceId,
                          );
                          const quantity = line.quantity > 0 ? line.quantity : 1;
                          const resolvedUnitPrice = (() => {
                            if (
                              line.unitPrice !== null &&
                              Number.isFinite(line.unitPrice)
                            ) {
                              return Math.max(0, line.unitPrice);
                            }
                            const base =
                              service?.base_price !== null &&
                                service?.base_price !== undefined
                                ? Number(service.base_price)
                                : 0;
                            return Number.isFinite(base) && base > 0 ? base : 0;
                          })();

                          return {
                            label: service?.name ?? "Service",
                            code: (service as any)?.code ?? null,
                            quantity,
                            unitPrice: resolvedUnitPrice,
                          };
                        });

                      let totalAmount = 0;

                      const itemsHtml = invoiceLines
                        .map((line, index) => {
                          const code = line.code || (index + 1).toString().padStart(4, "0");
                          const qtyLabel = line.quantity.toString();
                          const unitLabel = `CHF ${line.unitPrice.toFixed(2)}`;
                          const lineTotal = line.unitPrice * line.quantity;
                          totalAmount += lineTotal;
                          const lineTotalLabel = `CHF ${lineTotal.toFixed(2)}`;
                          return `<tr><td class="px-2 py-1 border-t border-slate-100 align-top text-slate-500">${code}</td><td class="px-2 py-1 border-t border-slate-100 align-top">${line.label}</td><td class="px-2 py-1 border-t border-slate-100 text-right align-top">${qtyLabel}</td><td class="px-2 py-1 border-t border-slate-100 text-right align-top">${unitLabel}</td><td class="px-2 py-1 border-t border-slate-100 text-right align-top">${lineTotalLabel}</td></tr>`;
                        })
                        .join("");

                      const paymentTermLabel =
                        invoicePaymentTerm === "installment"
                          ? "Installment"
                          : "Full payment";

                      const extraOptionLabel =
                        invoiceExtraOption === "complimentary"
                          ? "Complimentary service"
                          : null;

                      invoiceTotalAmountForInsert = totalAmount;
                      invoiceIsComplimentaryForInsert =
                        invoiceExtraOption === "complimentary";
                      invoiceIsPaidForInsert = false;

                      const paymentMethodLabel = invoicePaymentMethod.trim();

                      const invoiceIdLabel = consultationId;

                      let headerHtml = `<p class="mb-1 text-[11px]"><strong>Invoice #${invoiceIdLabel}</strong></p><p class="mb-0.5 text-[11px] text-slate-700"><strong>Payment method:</strong> ${paymentMethodLabel}</p><p class="mb-0.5 text-[11px] text-slate-700"><strong>Payment terms:</strong> ${paymentTermLabel}</p>`;

                      if (extraOptionLabel) {
                        headerHtml += `<p class="mb-0.5 text-[11px] text-slate-700"><strong>Extra option:</strong> ${extraOptionLabel}</p>`;
                      }

                      let installmentHtml = "";
                      if (
                        invoicePaymentTerm === "installment" &&
                        invoiceInstallments.length > 0 &&
                        totalAmount > 0
                      ) {
                        const rows = invoiceInstallments
                          .filter(
                            (installment) =>
                              Number.isFinite(installment.percent) &&
                              installment.percent > 0,
                          )
                          .map((installment, index) => {
                            const safePercent = Math.max(
                              0,
                              Math.min(100, installment.percent),
                            );
                            const amount = (totalAmount * safePercent) / 100;
                            let dueLabel = "—";
                            if (installment.dueDate) {
                              const dueDateObj = new Date(installment.dueDate);
                              if (!Number.isNaN(dueDateObj.getTime())) {
                                dueLabel = dueDateObj.toLocaleDateString();
                              }
                            }
                            const indexLabel = (index + 1)
                              .toString()
                              .padStart(2, "0");
                            return `<tr><td class="px-2 py-1 border-t border-slate-100 align-top text-slate-500">${indexLabel}</td><td class="px-2 py-1 border-t border-slate-100 align-top">${safePercent.toFixed(
                              2,
                            )}%</td><td class="px-2 py-1 border-t border-slate-100 align-top">${dueLabel}</td><td class="px-2 py-1 border-t border-slate-100 text-right align-top">CHF ${amount.toFixed(
                              2,
                            )}</td></tr>`;
                          })
                          .join("");

                        if (rows) {
                          const totalPercentLabel =
                            invoiceInstallmentsTotalPercentRounded.toFixed(2);
                          installmentHtml = `<p class="mt-2 text-[11px] text-slate-700"><strong>Installment plan</strong> (total ${totalPercentLabel}%)</p><table class="mt-1 w-full border-collapse text-[11px]"><thead><tr class="bg-slate-50 text-slate-600"><th class="px-2 py-1 text-left font-semibold">#</th><th class="px-2 py-1 text-left font-semibold">% of total</th><th class="px-2 py-1 text-left font-semibold">Due date</th><th class="px-2 py-1 text-right font-semibold">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
                        }
                      }

                      if (itemsHtml) {
                        contentHtml = `<div class="mt-1">${headerHtml}<table class="mt-2 w-full border-collapse text-[11px]"><thead><tr class="bg-slate-50 text-slate-600"><th class="px-2 py-1 text-left font-semibold">Code</th><th class="px-2 py-1 text-left font-semibold">Item</th><th class="px-2 py-1 text-right font-semibold">Qty</th><th class="px-2 py-1 text-right font-semibold">Unit price</th><th class="px-2 py-1 text-right font-semibold">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>`;
                        if (totalAmount > 0) {
                          contentHtml += `<p class="mt-1 text-[11px] text-slate-700"><strong>Estimated total:</strong> CHF ${totalAmount.toFixed(
                            2,
                          )}</p>`;
                        }
                        if (installmentHtml) {
                          contentHtml += installmentHtml;
                        }
                        contentHtml += "</div>";
                      } else {
                        contentHtml = `<div class="mt-1">${headerHtml}`;
                        if (installmentHtml) {
                          contentHtml += installmentHtml;
                        }
                        contentHtml += "</div>";
                      }
                    }
                    let paymentMethod: string | null = null;
                    if (consultationRecordType === "invoice") {
                      paymentMethod = invoicePaymentMethod.trim()
                        ? invoicePaymentMethod.trim()
                        : null;
                    }

                    const insertPayload: Record<string, unknown> = {
                      patient_id: patientId,
                      consultation_id: consultationId,
                      title: effectiveTitle,
                      content: contentHtml,
                      record_type: consultationRecordType,
                      doctor_user_id: consultationDoctorId,
                      doctor_name: doctorName,
                      scheduled_at: scheduledAtIso,
                      payment_method: paymentMethod,
                      duration_seconds: durationSeconds || 0,
                      created_by_user_id: createdByUserId,
                      created_by_name: createdByName,
                      is_archived: false,
                      archived_at: null,
                    };

                    if (consultationRecordType === "invoice") {
                      insertPayload.invoice_total_amount =
                        invoiceTotalAmountForInsert;
                      insertPayload.invoice_is_complimentary =
                        invoiceIsComplimentaryForInsert;
                      insertPayload.invoice_is_paid = invoiceIsPaidForInsert;
                    }

                    const { data, error } = await supabaseClient
                      .from("consultations")
                      .insert(insertPayload)
                      .select(
                        "id, patient_id, consultation_id, title, content, record_type, doctor_user_id, doctor_name, scheduled_at, payment_method, duration_seconds, invoice_total_amount, invoice_is_complimentary, invoice_is_paid, cash_receipt_path, invoice_pdf_path, payment_link_token, payrexx_payment_link, payrexx_payment_status, created_by_user_id, created_by_name, is_archived, archived_at",
                      )
                      .single();

                    if (error || !data) {
                      setConsultationError(
                        error.message ?? "Failed to create consultation.",
                      );
                      setConsultationSaving(false);
                      return;
                    }

                    const inserted = data as ConsultationRow;
                    setConsultations((prev) => [inserted, ...prev]);

                    if (inserted.record_type === "invoice") {
                      // Create Payrexx payment gateway for invoices with payment methods containing 'cash' or 'online'
                      const paymentMethod = inserted.payment_method?.toLowerCase() || "";
                      if (paymentMethod.includes("cash") || paymentMethod.includes("online")) {
                        try {
                          const payrexxResponse = await fetch("/api/payments/create-payrexx-gateway", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ consultationId: inserted.id }),
                          });

                          if (!payrexxResponse.ok) {
                            console.error("Failed to create Payrexx payment gateway");
                          }
                        } catch (payrexxError) {
                          console.error("Error creating Payrexx gateway:", payrexxError);
                        }
                      }
                      router.refresh();
                    }

                    setConsultationSaving(false);
                    setNewConsultationOpen(false);
                    setConsultationDurationSeconds(0);
                    setConsultationStopwatchStartedAt(null);
                    setConsultationStopwatchNow(Date.now());
                    setInvoicePaymentMethod("");
                    setInvoiceMode("individual");
                    setInvoiceGroupId("");
                    setInvoicePaymentTerm("full");
                    setInvoiceExtraOption(null);
                    setInvoiceInstallments([]);
                    setInvoiceServiceLines([]);
                    setInvoiceSelectedCategoryId("");
                    setInvoiceSelectedServiceId("");
                  } catch {
                    setConsultationError("Unexpected error creating consultation.");
                    setConsultationSaving(false);
                  }
                })();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1.4fr)] gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={consultationDate}
                    onChange={(event) => setConsultationDate(event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Time
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={consultationHour}
                      onChange={(event) =>
                        setConsultationHour(event.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="21"
                      className="w-10 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="text-xs text-slate-500">:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={consultationMinute}
                      onChange={(event) =>
                        setConsultationMinute(
                          event.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="52"
                      className="w-10 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Doctor
                  </label>
                  <select
                    value={consultationDoctorId}
                    onChange={(event) => setConsultationDoctorId(event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Select doctor</option>
                    {userOptions.map((user) => {
                      const label =
                        user.full_name || user.email || "Unnamed doctor";
                      return (
                        <option key={user.id} value={user.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Title
                  </label>
                  <input
                    type="text"
                    value={consultationTitle}
                    onChange={(event) => setConsultationTitle(event.target.value)}
                    placeholder="Consultation ID:"
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Record type
                  </label>
                  <select
                    value={consultationRecordType}
                    onChange={(event) => {
                      const nextType =
                        event.target.value as ConsultationRecordType;
                      setConsultationRecordType(nextType);
                      if (nextType === "prescription") {
                        setPrescriptionLines((prev) =>
                          prev.length > 0 ? prev : [{ medicineId: "", dosageId: "" }],
                        );
                      }
                    }
                    }
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    {consultationRecordTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {consultationRecordType === "notes" ? (
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Notes
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          if (typeof document !== "undefined") {
                            document.execCommand("bold");
                          }
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          if (typeof document !== "undefined") {
                            document.execCommand("italic");
                          }
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-[11px] font-medium italic text-slate-700 hover:bg-slate-100"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          if (typeof document !== "undefined") {
                            document.execCommand("insertUnorderedList");
                          }
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-[13px] text-slate-700 hover:bg-slate-100"
                      >
                        7
                      </button>
                    </div>
                    <div className="relative">
                      <div
                        className="min-h-[80px] max-h-64 overflow-y-auto px-2 py-1.5 text-[11px] text-slate-900 focus:outline-none"
                        contentEditable
                        onInput={(event) => {
                          const html = (event.currentTarget as HTMLDivElement).innerHTML;
                          setConsultationContentHtml(html);

                          // Detect @ mentions
                          const text = (event.currentTarget as HTMLDivElement).textContent || "";
                          const match = text.match(/@([^\s@]{0,50})$/);
                          if (match) {
                            setConsultationMentionActive(true);
                            setConsultationMentionQuery(match[1].toLowerCase());
                          } else if (consultationMentionActive) {
                            setConsultationMentionActive(false);
                            setConsultationMentionQuery("");
                          }
                        }}
                      />
                      {consultationMentionActive && (() => {
                        const mentionQuery = consultationMentionQuery.trim();
                        const mentionOptions = (Array.isArray(userOptions) ? userOptions : [])
                          .filter((u) => {
                            const hay = (u.full_name || u.email || "").toLowerCase();
                            return hay.includes(mentionQuery);
                          })
                          .slice(0, 6);

                        if (mentionOptions.length === 0) return null;

                        return (
                          <div className="absolute bottom-full left-0 mb-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white text-[10px] shadow-lg z-10">
                            {mentionOptions.map((user) => {
                              const display = user.full_name || user.email || "Unnamed user";
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    const display = user.full_name || user.email || "User";
                                    const currentHtml = consultationContentHtml;
                                    const newHtml = currentHtml.replace(/@([^\s@]{0,50})$/, `@${display} `);
                                    setConsultationContentHtml(newHtml);

                                    if (!consultationMentionUserIds.includes(user.id)) {
                                      setConsultationMentionUserIds((prev) => [...prev, user.id]);
                                    }

                                    setConsultationMentionActive(false);
                                    setConsultationMentionQuery("");

                                    // Update the contentEditable div
                                    const editableDiv = document.querySelector('[contenteditable="true"]');
                                    if (editableDiv) {
                                      (editableDiv as HTMLDivElement).innerHTML = newHtml;
                                    }
                                  }}
                                  className="block w-full cursor-pointer px-2 py-1 text-left text-slate-700 hover:bg-slate-50"
                                >
                                  {display}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : null}

              {consultationRecordType === "prescription" ? (
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Prescription
                  </label>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                    {prescriptionLines.map((line, index) => {
                      const medicine = TEST_MEDICINES.find(
                        (med) => med.id === line.medicineId,
                      );
                      const dosageOptions = medicine?.dosages ?? [];
                      const selectedDosage = dosageOptions.find(
                        (d) => d.id === line.dosageId,
                      );
                      const linePrice = selectedDosage?.price ?? 0;

                      return (
                        <div
                          key={index}
                          className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.8fr)_minmax(0,1fr)] gap-2"
                        >
                          <div className="space-y-1">
                            <span className="block text-[10px] font-medium text-slate-600">
                              Medicine
                            </span>
                            <select
                              value={line.medicineId}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPrescriptionLines((prev) => {
                                  const next = [...prev];
                                  next[index] = {
                                    medicineId: value,
                                    dosageId: "",
                                  };
                                  return next;
                                });
                              }}
                              className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="">Select medicine</option>
                              {TEST_MEDICINES.map((med) => (
                                <option key={med.id} value={med.id}>
                                  {med.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[10px] font-medium text-slate-600">
                              Dosage
                            </span>
                            <select
                              value={line.dosageId}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPrescriptionLines((prev) => {
                                  const next = [...prev];
                                  next[index] = {
                                    ...next[index],
                                    dosageId: value,
                                  };
                                  return next;
                                });
                              }}
                              disabled={!medicine}
                              className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                            >
                              <option value="">Select dosage</option>
                              {dosageOptions.map((dosage) => (
                                <option key={dosage.id} value={dosage.id}>
                                  {dosage.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col items-end justify-between gap-1 text-[10px] text-slate-600">
                            <span>
                              Price:
                              <span className="ml-1 font-semibold">
                                CHF {linePrice.toFixed(2)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setPrescriptionLines((prev) =>
                                  prev.filter((_, i) => i !== index),
                                );
                              }}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 shadow-sm hover:bg-slate-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() =>
                        setPrescriptionLines((prev) => [
                          ...prev,
                          { medicineId: "", dosageId: "" },
                        ])
                      }
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      + Add medicine
                    </button>

                    <div className="mt-1 text-[11px] text-slate-600">
                      Estimated total:
                      <span className="ml-1 font-semibold">
                        CHF
                        {" "}
                        {prescriptionLines
                          .reduce((sum, line) => {
                            const med = TEST_MEDICINES.find(
                              (m) => m.id === line.medicineId,
                            );
                            const dosage = med?.dosages.find(
                              (d) => d.id === line.dosageId,
                            );
                            return sum + (dosage?.price ?? 0);
                          }, 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {consultationRecordType === "invoice" ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-semibold text-slate-900">
                      Create Invoice
                    </h4>
                    {invoiceTotal > 0 ? (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-white">
                        CHF {invoiceTotal.toFixed(2)}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Payment Method
                      </label>
                      <select
                        value={invoicePaymentMethod}
                        onChange={(event) =>
                          setInvoicePaymentMethod(event.target.value)
                        }
                        className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="">Select payment method</option>
                        <option value="Cash">Cash</option>
                        <option value="Online Payment">Online Payment</option>
                        <option value="Bank transfer">Bank transfer</option>
                        <option value="Insurance">Insurance</option>
                      </select>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
                      <div className="space-y-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80">
                          <div className="flex text-[11px]">
                            <button
                              type="button"
                              onClick={() => setInvoiceMode("individual")}
                              className={
                                "flex-1 px-2 py-1.5 text-center text-[10px] font-medium " +
                                (invoiceMode === "individual"
                                  ? "bg-sky-600 text-white"
                                  : "bg-transparent text-slate-600")
                              }
                            >
                              Services
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvoiceMode("group")}
                              className={
                                "flex-1 px-2 py-1.5 text-center text-[10px] font-medium " +
                                (invoiceMode === "group"
                                  ? "bg-sky-600 text-white"
                                  : "bg-transparent text-slate-600")
                              }
                            >
                              Groups
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvoiceMode("tardoc")}
                              className={
                                "flex-1 px-2 py-1.5 text-center text-[10px] font-medium " +
                                (invoiceMode === "tardoc"
                                  ? "bg-red-600 text-white"
                                  : "bg-transparent text-slate-600")
                              }
                            >
                              TARDOC
                            </button>
                          </div>

                          {invoiceMode === "individual" ? (
                            <div className="space-y-2 px-3 py-3">
                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium text-slate-600">
                                  Service Category
                                </span>
                                <select
                                  value={invoiceSelectedCategoryId}
                                  onChange={(event) =>
                                    setInvoiceSelectedCategoryId(
                                      event.target.value,
                                    )
                                  }
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                  <option value="">All categories</option>
                                  {invoiceServiceCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium text-slate-600">
                                  Service
                                </span>
                                <select
                                  value={invoiceSelectedServiceId}
                                  onChange={(event) =>
                                    setInvoiceSelectedServiceId(event.target.value)
                                  }
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                  <option value="">Select service</option>
                                  {invoiceServices
                                    .filter(
                                      (service) =>
                                        !invoiceSelectedCategoryId ||
                                        service.category_id ===
                                        invoiceSelectedCategoryId,
                                    )
                                    .map((service) => (
                                      <option key={service.id} value={service.id}>
                                        {service.code ? `${service.code} - ` : ""}{service.name}
                                      </option>
                                    ))}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (!invoiceSelectedServiceId) return;
                                  const service = invoiceServices.find(
                                    (s) => s.id === invoiceSelectedServiceId,
                                  );
                                  if (!service) return;
                                  const base =
                                    service.base_price !== null &&
                                      service.base_price !== undefined
                                      ? Number(service.base_price)
                                      : 0;
                                  const unitPrice = Number.isFinite(base)
                                    ? Math.max(0, base)
                                    : 0;

                                  setInvoiceServiceLines((prev) => [
                                    ...prev,
                                    {
                                      serviceId: service.id,
                                      quantity: 1,
                                      unitPrice,
                                      groupId: null,
                                      discountPercent: null,
                                    },
                                  ]);
                                  setInvoiceSelectedServiceId("");
                                }}
                                disabled={!invoiceSelectedServiceId}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                + Add service
                              </button>
                            </div>
                          ) : invoiceMode === "group" ? (
                            <div className="space-y-2 px-3 py-3">
                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium text-slate-600">
                                  Service Group
                                </span>
                                <select
                                  value={invoiceGroupId}
                                  onChange={(event) =>
                                    setInvoiceGroupId(event.target.value)
                                  }
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                  <option value="">
                                    Choose a group to add its services
                                  </option>
                                  {invoiceServiceGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                      {group.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (!invoiceGroupId) return;
                                  const links = invoiceGroupServices.filter(
                                    (link) => link.group_id === invoiceGroupId,
                                  );
                                  if (links.length === 0) return;

                                  setInvoiceServiceLines((prev) => {
                                    const next = [...prev];
                                    const group = invoiceServiceGroups.find(
                                      (g) => g.id === invoiceGroupId,
                                    );
                                    const groupDiscountRaw =
                                      group?.discount_percent ?? null;
                                    for (const link of links) {
                                      const service = invoiceServices.find(
                                        (s) => s.id === link.service_id,
                                      );
                                      if (!service) continue;
                                      const base =
                                        service.base_price !== null &&
                                          service.base_price !== undefined
                                          ? Number(service.base_price)
                                          : 0;
                                      const discountSource =
                                        link.discount_percent !== null &&
                                          link.discount_percent !== undefined
                                          ? Number(link.discount_percent)
                                          : groupDiscountRaw !== null &&
                                            groupDiscountRaw !== undefined
                                            ? Number(groupDiscountRaw)
                                            : null;
                                      const discountPercent =
                                        discountSource !== null &&
                                          Number.isFinite(discountSource) &&
                                          discountSource > 0
                                          ? Math.min(
                                            100,
                                            Math.max(0, discountSource),
                                          )
                                          : null;
                                      const discountedBase =
                                        base > 0 && discountPercent !== null
                                          ? base * (1 - discountPercent / 100)
                                          : base;
                                      const unitPrice = Number.isFinite(
                                        discountedBase,
                                      )
                                        ? Math.max(0, discountedBase)
                                        : 0;
                                      next.push({
                                        serviceId: service.id,
                                        quantity: 1,
                                        unitPrice,
                                        groupId: invoiceGroupId,
                                        discountPercent,
                                      });
                                    }
                                    return next;
                                  });
                                }}
                                disabled={!invoiceGroupId}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                + Add group services
                              </button>
                              <p className="text-[10px] text-slate-500">
                                Adds all services from the selected group into the
                                invoice list on the right.
                              </p>
                            </div>
                          ) : invoiceMode === "tardoc" ? (
                            <div className="space-y-2 px-3 py-3">
                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium text-slate-600">
                                  Canton (Tax Point Value)
                                </span>
                                <select
                                  value={invoiceCanton}
                                  onChange={(e) => setInvoiceCanton(e.target.value as SwissCanton)}
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                  {Object.entries(CANTON_TAX_POINT_VALUES).map(([code, value]) => (
                                    <option key={code} value={code}>
                                      {code} - CHF {value.toFixed(2)}/pt
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium text-slate-600">
                                  TARDOC Tariff
                                </span>
                                <select
                                  value={selectedTardocCode}
                                  onChange={(e) => setSelectedTardocCode(e.target.value)}
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                  <option value="">Select TARDOC tariff</option>
                                  {TARDOC_TARIFF_ITEMS.filter(t => t.isActive).map((tariff) => (
                                    <option key={tariff.code} value={tariff.code}>
                                      {tariff.code} - {tariff.description} ({formatChf(calculateTardocPrice(tariff.taxPoints, invoiceCanton))})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (!selectedTardocCode) return;
                                  const tariff = TARDOC_TARIFF_ITEMS.find(t => t.code === selectedTardocCode);
                                  if (!tariff) return;
                                  const unitPrice = calculateTardocPrice(tariff.taxPoints, invoiceCanton);

                                  setInvoiceServiceLines((prev) => [
                                    ...prev,
                                    {
                                      serviceId: `tardoc-${tariff.code}`,
                                      quantity: 1,
                                      unitPrice,
                                      groupId: null,
                                      discountPercent: null,
                                    },
                                  ]);
                                  setSelectedTardocCode("");
                                }}
                                disabled={!selectedTardocCode}
                                className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 shadow-sm hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                + Add TARDOC tariff
                              </button>
                              <p className="text-[10px] text-slate-500">
                                Swiss medical tariff (TARDOC) with canton-specific pricing.
                                <a href="/tardoc" target="_blank" className="ml-1 text-sky-600 hover:underline">
                                  View all tariffs →
                                </a>
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-4 pt-1 text-[11px] sm:grid-cols-2">
                          <div className="space-y-1 sm:col-span-2">
                            <p className="font-medium text-slate-700">
                              Payment Terms
                            </p>
                            <div className="flex flex-wrap gap-4">
                              <label className="inline-flex items-center gap-1 text-slate-600">
                                <input
                                  type="radio"
                                  className="h-3 w-3"
                                  checked={invoicePaymentTerm === "full"}
                                  onChange={() => setInvoicePaymentTerm("full")}
                                />
                                <span>Full Payment</span>
                              </label>
                              <label className="inline-flex items-center gap-1 text-slate-600">
                                <input
                                  type="radio"
                                  className="h-3 w-3"
                                  checked={invoicePaymentTerm === "installment"}
                                  onChange={() =>
                                    setInvoicePaymentTerm("installment")
                                  }
                                />
                                <span>Installment</span>
                              </label>
                            </div>

                            {invoicePaymentTerm === "installment" ? (
                              <div className="mt-3 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-medium text-slate-700">
                                    Installment Terms
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInvoiceInstallments((prev) => [
                                        ...prev,
                                        {
                                          id: `${Date.now()}-${prev.length}`,
                                          percent: 0,
                                          dueDate: "",
                                        },
                                      ]);
                                    }}
                                    className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm hover:bg-emerald-600"
                                  >
                                    <span className="mr-1 text-xs">+</span>
                                    <span>Add</span>
                                  </button>
                                </div>

                                {invoiceInstallments.length === 0 ? (
                                  <p className="text-[10px] text-slate-500">
                                    Define one or more installments as percentages of the
                                    invoice total.
                                  </p>
                                ) : (
                                  <div className="space-y-1">
                                    {invoiceInstallments.map((installment, index) => {
                                      const safePercent = Number.isFinite(
                                        installment.percent,
                                      )
                                        ? Math.max(0, Math.min(100, installment.percent))
                                        : 0;
                                      const amount =
                                        invoiceTotal > 0
                                          ? (invoiceTotal * safePercent) / 100
                                          : 0;

                                      return (
                                        <div
                                          key={installment.id ?? `${index}`}
                                          className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_auto] items-center gap-1 text-[10px]"
                                        >
                                          <div className="space-y-0.5">
                                            <span className="block text-[10px] font-medium text-slate-600">
                                              Percentage
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.1"
                                                value={
                                                  Number.isFinite(installment.percent)
                                                    ? installment.percent
                                                    : ""
                                                }
                                                onChange={(event) => {
                                                  const raw = event.target.value;
                                                  const value =
                                                    raw === ""
                                                      ? 0
                                                      : Number.parseFloat(raw);
                                                  setInvoiceInstallments((prev) => {
                                                    const next = [...prev];
                                                    next[index] = {
                                                      ...next[index],
                                                      percent: Number.isNaN(value)
                                                        ? 0
                                                        : value,
                                                    };
                                                    return next;
                                                  });
                                                }}
                                                className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[10px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                              />
                                              <span className="text-[10px] text-slate-500">%</span>
                                            </div>
                                          </div>
                                          <div className="space-y-0.5">
                                            <span className="block text-[10px] font-medium text-slate-600">
                                              Due date
                                            </span>
                                            <input
                                              type="date"
                                              value={installment.dueDate}
                                              onChange={(event) => {
                                                const value = event.target.value;
                                                setInvoiceInstallments((prev) => {
                                                  const next = [...prev];
                                                  next[index] = {
                                                    ...next[index],
                                                    dueDate: value,
                                                  };
                                                  return next;
                                                });
                                              }}
                                              className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                            />
                                          </div>
                                          <div className="space-y-0.5 text-right">
                                            <span className="block text-[10px] font-medium text-slate-600">
                                              Amount
                                            </span>
                                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                              CHF {amount.toFixed(2)}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setInvoiceInstallments((prev) =>
                                                prev.filter((_, i) => i !== index),
                                              );
                                            }}
                                            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-[11px] text-red-600 hover:bg-red-100"
                                            aria-label="Remove installment"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      );
                                    })}

                                    <div className="mt-1 flex items-center justify-between text-[10px]">
                                      <span className="text-slate-600">
                                        Allocated:
                                        <span className="ml-1 font-semibold">
                                          {invoiceInstallmentsTotalPercentRounded.toFixed(2)}%
                                        </span>
                                      </span>
                                      {invoiceInstallmentsPlanComplete ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                                          100% allocated
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                          Adjust installments to reach 100%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-700">
                              Extra Options (Optional)
                            </p>
                            <div className="flex flex-wrap gap-4">
                              <label className="inline-flex items-center gap-1 text-slate-600">
                                <input
                                  type="checkbox"
                                  className="h-3 w-3"
                                  checked={invoiceExtraOption === "complimentary"}
                                  onChange={(event) =>
                                    setInvoiceExtraOption(
                                      event.target.checked ? "complimentary" : null,
                                    )
                                  }
                                />
                                <span>Complimentary Service</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-medium text-slate-800">
                            To be invoiced
                          </p>
                          {invoiceTotal > 0 ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-white">
                              CHF {invoiceTotal.toFixed(2)}
                            </span>
                          ) : null}
                        </div>

                        {invoiceServiceLines.length === 0 ? (
                          <p className="text-[10px] text-slate-500">
                            No services added yet. Use the controls on the left to
                            add services or groups.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {invoiceServiceLines.map((line, index) => {
                              const service = invoiceServices.find(
                                (s) => s.id === line.serviceId,
                              );
                              const label = service?.name || "Service";
                              const group =
                                line.groupId !== null
                                  ? invoiceServiceGroups.find(
                                    (g) => g.id === line.groupId,
                                  )
                                  : null;
                              const metaBits: string[] = [];
                              if (group) metaBits.push(group.name);
                              if (
                                line.discountPercent !== null &&
                                Number.isFinite(line.discountPercent)
                              ) {
                                metaBits.push(
                                  `-${Math.min(
                                    100,
                                    Math.max(0, line.discountPercent),
                                  ).toFixed(0)}%`,
                                );
                              }
                              const quantity = line.quantity > 0 ? line.quantity : 1;
                              const unit =
                                line.unitPrice !== null &&
                                  Number.isFinite(line.unitPrice)
                                  ? Math.max(0, line.unitPrice)
                                  : 0;
                              const lineTotal = unit * quantity;

                              return (
                                <div
                                  key={index}
                                  className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] items-end gap-2"
                                >
                                  <div className="space-y-0.5">
                                    <span className="block text-[10px] font-medium text-slate-600">
                                      Item
                                    </span>
                                    <div className="truncate text-[11px] text-slate-800">
                                      {service?.code && (
                                        <>
                                          <span className="font-bold text-[10px] mr-1">{service.code}</span>
                                          <span className="text-slate-400 mr-1">-</span>
                                        </>
                                      )}
                                      {label}
                                    </div>
                                    {metaBits.length > 0 ? (
                                      <div className="text-[10px] text-slate-500">
                                        {metaBits.join(" • ")}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="block text-[10px] font-medium text-slate-600">
                                      Price (CHF)
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={
                                        line.unitPrice !== null &&
                                          Number.isFinite(line.unitPrice)
                                          ? line.unitPrice
                                          : ""
                                      }
                                      onChange={(event) => {
                                        const raw = event.target.value;
                                        const value =
                                          raw === ""
                                            ? null
                                            : Number.parseFloat(raw);
                                        setInvoiceServiceLines((prev) => {
                                          const next = [...prev];
                                          next[index] = {
                                            ...next[index],
                                            unitPrice:
                                              value === null || Number.isNaN(value)
                                                ? null
                                                : Math.max(0, value),
                                          };
                                          return next;
                                        });
                                      }}
                                      className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="block text-[10px] font-medium text-slate-600">
                                      Qty
                                    </span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={quantity}
                                      onChange={(event) => {
                                        const value = Number.parseInt(
                                          event.target.value || "1",
                                          10,
                                        );
                                        setInvoiceServiceLines((prev) => {
                                          const next = [...prev];
                                          next[index] = {
                                            ...next[index],
                                            quantity: Number.isNaN(value)
                                              ? 1
                                              : Math.max(1, value),
                                          };
                                          return next;
                                        });
                                      }}
                                      className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    />
                                  </div>
                                  <div className="flex flex-col items-end justify-between gap-1 text-[10px] text-slate-600">
                                    <span>
                                      <span className="font-semibold">
                                        {unit > 0
                                          ? `CHF ${lineTotal.toFixed(2)}`
                                          : "-"}
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInvoiceServiceLines((prev) =>
                                          prev.filter((_, i) => i !== index),
                                        );
                                      }}
                                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 shadow-sm hover:bg-slate-50"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {consultationError ? (
                <p className="text-[11px] text-red-600">{consultationError}</p>
              ) : null}

              <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-slate-600">
                <span>Time spent</span>
                <div className="flex items-center gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-700">
                    {formDisplayDuration}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (consultationStopwatchStartedAt) {
                        const elapsedSeconds = Math.max(
                          0,
                          Math.floor(
                            (Date.now() - consultationStopwatchStartedAt) / 1000,
                          ),
                        );
                        setConsultationDurationSeconds(
                          consultationDurationSeconds + elapsedSeconds,
                        );
                        setConsultationStopwatchStartedAt(null);
                        setConsultationStopwatchNow(Date.now());
                      } else {
                        const nowTs = Date.now();
                        setConsultationStopwatchStartedAt(nowTs);
                        setConsultationStopwatchNow(nowTs);
                      }
                    }}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    {formStopwatchRunning ? "Stop" : "Start"}
                  </button>
                  {formRunningSeconds > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConsultationDurationSeconds(0);
                        setConsultationStopwatchStartedAt(null);
                        setConsultationStopwatchNow(Date.now());
                      }}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 shadow-sm hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (consultationSaving) return;
                    setNewConsultationOpen(false);
                    setConsultationError(null);
                    setConsultationDurationSeconds(0);
                    setConsultationStopwatchStartedAt(null);
                    setConsultationStopwatchNow(Date.now());
                    setInvoicePaymentMethod("");
                    setInvoiceMode("individual");
                    setInvoiceGroupId("");
                    setInvoicePaymentTerm("full");
                    setInvoiceExtraOption(null);
                    setInvoiceInstallments([]);
                    setInvoiceServiceLines([]);
                    setInvoiceSelectedCategoryId("");
                    setInvoiceSelectedServiceId("");
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consultationSaving}
                  className="inline-flex items-center rounded-full border border-sky-500/80 bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {consultationSaving ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Axenita PDF Documents Section */}
        {axenitaPdfDocs.length > 0 && (!recordTypeFilter || recordTypeFilter === "notes") && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-[11px] font-semibold text-slate-700">Axenita Medical Records</h4>
              <span className="text-[10px] text-slate-400">({axenitaPdfDocs.length} document{axenitaPdfDocs.length !== 1 ? 's' : ''})</span>
            </div>
            {axenitaPdfDocs.map((doc, index) => (
              <div
                key={`${doc.folderName}-${doc.fileName}-${index}`}
                className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${doc.fileType === "ap"
                    ? "bg-purple-100 text-purple-700"
                    : doc.fileType === "af"
                      ? "bg-indigo-100 text-indigo-700"
                      : doc.fileType === "notes"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                    {doc.fileType === "ap" ? "Medical Notes (AP)" :
                      doc.fileType === "af" ? "Medical Notes (AF)" :
                        doc.fileType === "notes" ? "Notes" : "Consultation"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {doc.fileName}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed line-clamp-3">
                  {doc.content || "No content extracted"}
                </p>
              </div>
            ))}
          </div>
        )}

        {axenitaPdfLoading && (!recordTypeFilter || recordTypeFilter === "notes") && (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Loading Axenita medical records...
          </div>
        )}

        {/* Show message when no Axenita documents found (after loading) */}
        {!axenitaPdfLoading && !axenitaPdfError && axenitaPdfDocs.length === 0 && (!recordTypeFilter || recordTypeFilter === "notes") && patientFirstName && patientLastName && (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>No Axenita medical records found for this patient.</span>
            </div>
          </div>
        )}

        {axenitaPdfError && (!recordTypeFilter || recordTypeFilter === "notes") && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{axenitaPdfError}</span>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {consultationsError ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {consultationsError}
            </div>
          ) : consultationsLoading ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Loading consultations...
            </div>
          ) : filteredSortedConsultations.length === 0 ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              No consultations found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSortedConsultations.map((row) => {
                const scheduled = row.scheduled_at
                  ? new Date(row.scheduled_at)
                  : null;
                const scheduledLabel =
                  scheduled && !Number.isNaN(scheduled.getTime())
                    ? scheduled.toLocaleString()
                    : "";

                const isNotes = row.record_type === "notes";
                const isPrescription = row.record_type === "prescription";
                const isInvoice = row.record_type === "invoice";
                const is3d = row.record_type === "3d";

                const baseRecordTypeLabel =
                  consultationRecordTypeOptions.find(
                    (opt) => opt.value === row.record_type,
                  )?.label ?? "Unknown";

                const recordTypeLabel = baseRecordTypeLabel;

                const displayTitle = (() => {
                  const title = row.title ?? "";
                  const prefix = "Consultation ";
                  return title.startsWith(prefix)
                    ? title.slice(prefix.length)
                    : title;
                })();

                const isComplimentaryInvoice =
                  isInvoice &&
                  typeof row.content === "string" &&
                  (row.content.includes(
                    "Extra option:</strong> Complimentary service",
                  ) ||
                    row.content.includes(
                      "Extra option:</strong> Complimentary Service",
                    ));

                const isCashInvoice =
                  isInvoice &&
                  typeof row.payment_method === "string" &&
                  row.payment_method === "Cash";

                const cardClassName =
                  "rounded-lg border border-slate-200 bg-white/80 px-3 py-3 text-xs shadow-sm";

                const totalSeconds = row.duration_seconds ?? 0;
                const displayDuration = formatDuration(totalSeconds);

                let threeDMeta: {
                  reconstruction_type?: string | null;
                  player_id?: string | null;
                } | null = null;

                if (
                  is3d &&
                  typeof row.content === "string" &&
                  row.content.trim()
                ) {
                  try {
                    const parsed = JSON.parse(row.content) as {
                      reconstruction_type?: string | null;
                      player_id?: string | null;
                    };
                    threeDMeta = parsed;
                  } catch {
                    threeDMeta = null;
                  }
                }

                return (
                  <div key={row.id} className={cardClassName}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                          }
                        >
                          {recordTypeLabel}
                        </span>
                        <div className="text-[11px] text-slate-700">
                          <div className="font-medium">
                            {row.doctor_name ?? ""}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {scheduledLabel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-700">
                          {displayDuration}
                        </span>
                        {is3d &&
                          threeDMeta?.player_id &&
                          threeDMeta.reconstruction_type ? (
                          <button
                            type="button"
                            onClick={() => {
                              const crType = threeDMeta?.reconstruction_type;
                              const playerId = threeDMeta?.player_id;
                              if (!crType || !playerId) return;
                              const url = `/patients/${row.patient_id}?mode=medical&m_tab=3d&show3d=1&cr_player_id=${encodeURIComponent(
                                playerId,
                              )}&cr_type=${crType}`;
                              router.push(url);
                            }}
                            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm hover:bg-sky-700"
                          >
                            Open 3D
                          </button>
                        ) : null}
                        {isInvoice && !isComplimentaryInvoice ? (
                          <>
                            {/* Invoice Status Badge */}
                            {(() => {
                              const effectiveStatus: InvoiceStatus = row.invoice_status || (row.invoice_is_paid ? "PAID" : "OPEN");
                              const statusConfig = INVOICE_STATUS_DISPLAY[effectiveStatus];
                              return (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
                                  {effectiveStatus === "PAID" && (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {effectiveStatus === "CANCELLED" && (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                  {statusConfig.label}
                                </span>
                              );
                            })()}

                            {/* View PDF Button */}
                            {row.invoice_pdf_path ? (
                              <button
                                type="button"
                                onClick={() => handleViewPdf(row.invoice_pdf_path!)}
                                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800 shadow-sm hover:bg-indigo-100"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View PDF
                              </button>
                            ) : null}

                            {/* Generate/Regenerate PDF Button */}
                            <button
                              type="button"
                              onClick={() => handleGenerateInvoicePdf(row.id)}
                              disabled={generatingPdf === row.id}
                              className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-800 shadow-sm hover:bg-purple-100 disabled:opacity-50"
                            >
                              {generatingPdf === row.id ? "Generating..." : row.invoice_pdf_path ? "Regenerate PDF" : "Generate PDF"}
                            </button>

                            {/* Edit Invoice Button */}
                            <button
                              type="button"
                              onClick={() => handleEditInvoice(row)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>

                            {/* Copy Payment Link Button (for payments with cash/online) */}
                            {!row.invoice_is_paid && row.payment_method &&
                              (row.payment_method.toLowerCase().includes("cash") ||
                                row.payment_method.toLowerCase().includes("online")) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Use Payrexx payment link if available, otherwise use internal payment page
                                    let paymentLink = row.payrexx_payment_link;
                                    if (!paymentLink && row.payment_link_token) {
                                      const baseUrl = window.location.origin;
                                      paymentLink = `${baseUrl}/invoice/pay/${row.payment_link_token}`;
                                    }

                                    if (!paymentLink) {
                                      alert("Payment link not yet generated. Please generate the invoice PDF first or create a Payrexx payment link.");
                                      return;
                                    }

                                    navigator.clipboard.writeText(paymentLink).then(() => {
                                      alert("Payment link copied to clipboard!");
                                    }).catch(err => {
                                      console.error("Failed to copy:", err);
                                      alert("Failed to copy link");
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800 shadow-sm hover:bg-blue-100"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                  Copy Link
                                </button>
                              )}

                            {/* Payment Status Button (if not paid) */}
                            {!row.invoice_is_paid && (
                              <button
                                type="button"
                                onClick={() => handleManagePaymentStatus(row)}
                                className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 shadow-sm hover:bg-sky-100"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Payment
                              </button>
                            )}

                            {/* Check Payment Status Button (for Payrexx payments not yet paid) */}
                            {!row.invoice_is_paid && row.payrexx_payment_link && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const response = await fetch("/api/payments/sync-payment-status", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ consultationCode: row.consultation_id }),
                                    });
                                    const data = await response.json();
                                    if (data.isPaid) {
                                      alert("Payment confirmed! Refreshing...");
                                      window.location.reload();
                                    } else {
                                      alert(`Payment status: ${data.payrexxStatus || "waiting"}`);
                                    }
                                  } catch {
                                    alert("Failed to check payment status");
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow-sm hover:bg-amber-100"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Check Payment
                              </button>
                            )}

                            {/* Insurance Billing Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setInsuranceBillingTarget(row);
                                setInsuranceBillingModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 shadow-sm hover:bg-emerald-100"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Insurance
                            </button>
                          </>
                        ) : null}
                        {isCashInvoice && !isComplimentaryInvoice ? (
                          row.invoice_is_paid ? (
                            <>
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 shadow-sm">
                                Paid
                              </span>
                              {row.cash_receipt_path ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleViewCashReceipt(row.cash_receipt_path)
                                  }
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-50"
                                >
                                  View receipt
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                openCashReceiptModal(row);
                              }}
                              className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 shadow-sm hover:bg-amber-100"
                            >
                              Upload receipt
                            </button>
                          )
                        ) : null}
                        {!showArchived ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleArchiveConsultation(row.id);
                            }}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-50"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteConsultation(row.id);
                            }}
                            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 shadow-sm hover:bg-red-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-800">
                      {isNotes ? (
                        <div className="mb-2 text-[10px] text-slate-600">
                          <span className="font-semibold">Consultation ID:</span>{" "}
                          <span className="font-mono text-slate-800">{row.consultation_id}</span>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{displayTitle}</div>
                        {isComplimentaryInvoice ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                            Complimentary service
                          </span>
                        ) : null}
                      </div>
                      {is3d && threeDMeta ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                          <span>
                            Type:
                            <span className="ml-1 font-semibold capitalize">
                              {threeDMeta.reconstruction_type ?? "Unknown"}
                            </span>
                          </span>
                          {threeDMeta.player_id ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-700">
                              Player ID: {threeDMeta.player_id}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {isNotes && row.content ? (
                        <div
                          className="mt-1 text-[11px] leading-relaxed text-slate-800"
                          style={{ whiteSpace: "pre-wrap" }}
                          dangerouslySetInnerHTML={{ __html: row.content }}
                        />
                      ) : (isPrescription || isInvoice) && row.content ? (
                        <div
                          className="mt-1 text-[11px] leading-relaxed text-slate-800"
                          dangerouslySetInnerHTML={{ __html: row.content }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {taskModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm py-6 sm:py-8">
          <div className="w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-xs shadow-[0_24px_60px_rgba(15,23,42,0.65)]">
            <h2 className="text-sm font-semibold text-slate-900">Create Task</h2>
            <form onSubmit={handleTaskSubmit} className="mt-3 space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Name
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="Enter task name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Type
                  </label>
                  <select
                    value={taskType}
                    onChange={(event) =>
                      setTaskType(event.target.value as TaskType)
                    }
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="todo">Todo</option>
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(event.target.value as TaskPriority)
                    }
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    User
                  </label>
                  <select
                    value={taskAssignedUserId}
                    onChange={(event) =>
                      setTaskAssignedUserId(event.target.value)
                    }
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Unassigned</option>
                    {userOptions.map((user) => {
                      const label =
                        user.full_name || user.email || "Unnamed user";
                      return (
                        <option key={user.id} value={user.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Activity Date
                  </label>
                  <input
                    type="datetime-local"
                    value={taskActivityDate}
                    onChange={(event) => setTaskActivityDate(event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Content
                </label>
                <textarea
                  value={taskContent}
                  onChange={(event) => setTaskContent(event.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="Enter task details..."
                />
              </div>
              {taskSaveError ? (
                <p className="text-[11px] text-red-600">{taskSaveError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (taskSaving) return;
                    setTaskModalOpen(false);
                    setTaskSaveError(null);
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSaving}
                  className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {taskSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {cashReceiptModalOpen && cashReceiptTarget ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm py-6 sm:py-8">
          <div className="w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-xs shadow-[0_24px_60px_rgba(15,23,42,0.65)]">
            <h2 className="text-sm font-semibold text-slate-900">
              Upload cash receipt
            </h2>
            <p className="mt-1 text-[11px] text-slate-600">
              Attach a receipt image or PDF for this cash payment to mark the
              invoice as paid.
            </p>
            <form onSubmit={handleCashReceiptSubmit} className="mt-3 space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-slate-700">
                  Consultation
                </p>
                <p className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-800">
                  {cashReceiptTarget.title}
                </p>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  Receipt file
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setCashReceiptFile(file);
                    setCashReceiptError(null);
                  }}
                  className="block w-full text-[11px] text-slate-700 file:mr-2 file:rounded-full file:border-0 file:bg-sky-50 file:px-3 file:py-1 file:text-[11px] file:font-medium file:text-sky-700 hover:file:bg-sky-100"
                />
                <p className="text-[10px] text-slate-500">
                  Accepted formats: images (JPG, PNG, etc.) or PDF.
                </p>
              </div>
              {cashReceiptError ? (
                <p className="text-[11px] text-red-600">{cashReceiptError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (cashReceiptUploading) return;
                    setCashReceiptModalOpen(false);
                    setCashReceiptTarget(null);
                    setCashReceiptFile(null);
                    setCashReceiptError(null);
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cashReceiptUploading}
                  className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cashReceiptUploading ? "Uploading..." : "Upload & mark paid"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && pdfViewerUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative h-full w-full max-w-5xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Invoice PDF</h3>
              <div className="flex items-center gap-2">
                <a
                  href={pdfViewerUrl}
                  download
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </a>
                <button
                  onClick={() => {
                    setPdfViewerOpen(false);
                    setPdfViewerUrl(null);
                  }}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-60px)] w-full">
              <iframe
                src={pdfViewerUrl}
                className="h-full w-full"
                title="Invoice PDF"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Payment Status Management Modal */}
      {paymentStatusModalOpen && paymentStatusTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Update Invoice Status</h3>
              <p className="mt-1 text-xs text-slate-600">
                Invoice #{paymentStatusTarget.consultation_id}
              </p>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="font-medium text-slate-900">{paymentStatusTarget.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Invoice Amount:</span>
                    <span className="font-medium text-slate-900">
                      {paymentStatusTarget.invoice_total_amount?.toFixed(2)} CHF
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Current Status:</span>
                    <span className={`font-medium ${INVOICE_STATUS_DISPLAY[paymentStatusTarget.invoice_status || (paymentStatusTarget.invoice_is_paid ? "PAID" : "OPEN")]?.color || "text-slate-900"}`}>
                      {INVOICE_STATUS_DISPLAY[paymentStatusTarget.invoice_status || (paymentStatusTarget.invoice_is_paid ? "PAID" : "OPEN")]?.label || "Open"}
                    </span>
                  </div>
                  {paymentStatusTarget.invoice_paid_amount && paymentStatusTarget.invoice_paid_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Paid Amount:</span>
                      <span className="font-medium text-emerald-700">
                        {paymentStatusTarget.invoice_paid_amount.toFixed(2)} CHF
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-700">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["PAID", "OPEN", "PARTIAL_PAID", "OVERPAID", "PARTIAL_LOSS", "CANCELLED"] as InvoiceStatus[]).map((status) => {
                    const config = INVOICE_STATUS_DISPLAY[status];
                    const isCurrentStatus = (paymentStatusTarget.invoice_status || (paymentStatusTarget.invoice_is_paid ? "PAID" : "OPEN")) === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        disabled={markingPaid || isCurrentStatus}
                        onClick={() => {
                          if (status === "PARTIAL_PAID" || status === "PARTIAL_LOSS" || status === "OVERPAID") {
                            const amount = prompt(`Enter paid amount in CHF (Invoice: ${paymentStatusTarget.invoice_total_amount?.toFixed(2)} CHF):`);
                            if (amount !== null) {
                              const paidAmount = parseFloat(amount);
                              if (!isNaN(paidAmount) && paidAmount >= 0) {
                                handleMarkInvoicePaid(paymentStatusTarget.id, status, paidAmount);
                              } else {
                                alert("Please enter a valid amount.");
                              }
                            }
                          } else {
                            handleMarkInvoicePaid(paymentStatusTarget.id, status, status === "PAID" ? paymentStatusTarget.invoice_total_amount ?? undefined : undefined);
                          }
                        }}
                        className={`inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-[11px] font-medium transition-all ${isCurrentStatus
                          ? `${config.bgColor} ${config.color} ${config.borderColor} ring-2 ring-offset-1 ring-slate-300`
                          : `border-slate-200 bg-white text-slate-700 hover:${config.bgColor} hover:${config.color}`
                          } disabled:opacity-50`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-[10px] text-blue-800">
                  <strong>Status Guide:</strong><br />
                  • <strong>Paid</strong> - Full payment received<br />
                  • <strong>Open</strong> - Awaiting payment<br />
                  • <strong>Partial Paid</strong> - Some payment received, balance pending<br />
                  • <strong>Overpaid</strong> - More than invoice amount received<br />
                  • <strong>Partial Loss</strong> - Partial payment accepted as full settlement<br />
                  • <strong>Cancelled</strong> - Invoice voided/cancelled
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setPaymentStatusModalOpen(false)}
                disabled={markingPaid}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Invoice Editing Modal */}
      {editInvoiceModalOpen && editInvoiceTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Edit Invoice</h3>
              <p className="mt-1 text-xs text-slate-600">
                Invoice #{editInvoiceTarget.consultation_id}
              </p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs text-blue-800">
                  <strong>Coming Soon:</strong> Invoice editing functionality will be available in a future update. For now, you can regenerate the PDF with updated information by creating a new consultation record.
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Title:</span>
                    <span className="font-medium text-slate-900">{editInvoiceTarget.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Amount:</span>
                    <span className="font-medium text-slate-900">
                      {editInvoiceTarget.invoice_total_amount?.toFixed(2)} CHF
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="font-medium text-slate-900">{editInvoiceTarget.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date:</span>
                    <span className="font-medium text-slate-900">
                      {new Date(editInvoiceTarget.scheduled_at).toLocaleDateString("en-US")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => {
                  setEditInvoiceModalOpen(false);
                  setEditInvoiceTarget(null);
                }}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Insurance Billing Modal */}
      <InsuranceBillingModal
        isOpen={insuranceBillingModalOpen}
        onClose={() => {
          setInsuranceBillingModalOpen(false);
          setInsuranceBillingTarget(null);
        }}
        consultationId={insuranceBillingTarget?.id || ""}
        patientId={patientId}
        patientName={insuranceBillingTarget?.title || "Patient"}
        invoiceAmount={insuranceBillingTarget?.invoice_total_amount || null}
        durationMinutes={insuranceBillingTarget?.duration_seconds ? Math.ceil(insuranceBillingTarget.duration_seconds / 60) : 15}
        onSuccess={() => {
          setInsuranceBillingModalOpen(false);
          setInsuranceBillingTarget(null);
        }}
      />
    </>
  );
}
