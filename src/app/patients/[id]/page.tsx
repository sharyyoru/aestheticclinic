import Link from "next/link";
import { supabaseClient } from "@/lib/supabaseClient";
import CollapseSidebarOnMount from "@/components/CollapseSidebarOnMount";

import EditPatientDetailsButton from "./EditPatientDetailsButton";
import PatientModeToggle from "./PatientModeToggle";
import PatientDetailsTabs from "./PatientDetailsTabs";
import PatientCrmPreferencesCard from "./PatientCrmPreferencesCard";
import PatientActivityCard from "./PatientActivityCard";
import CrisalixPlayerModal from "./CrisalixPlayerModal";
import MedicalConsultationsCard from "./MedicalConsultationsCard";
import PatientDocumentsTab from "./PatientDocumentsTab";
import PatientModeInitializer from "./PatientModeInitializer";
import PatientEditingPresence from "./PatientEditingPresence";
import InvoicePaymentMethodFilter from "./InvoicePaymentMethodFilter";
import PatientIntakeDataCard from "./PatientIntakeDataCard";

export const dynamic = "force-dynamic";

interface PatientDetailsProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

type MedicalTab =
  | "cockpit"
  | "notes"
  | "prescription"
  | "invoice"
  | "file"
  | "photo"
  | "3d"
  | "patient_information"
  | "documents"
  | "crm"
  | "form_photos";

async function getPatientWithDetails(id: string) {
  const { data: patient, error } = await supabaseClient
    .from("patients")
    .select(
      "id, first_name, last_name, email, phone, gender, dob, marital_status, nationality, street_address, postal_code, town, profession, current_employer, source, notes, avatar_url, language_preference, clinic_preference, lifecycle_stage, contact_owner_name, contact_owner_email, created_by, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !patient) {
    return { patient: null, insurance: [] } as const;
  }

  const { data: insurance } = await supabaseClient
    .from("patient_insurances")
    .select("id, provider_name, card_number, insurance_type, created_at")
    .eq("patient_id", id)
    .order("created_at", { ascending: false });

  return { patient, insurance: insurance ?? [] } as const;
}

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

async function getInvoiceSummary(
  patientId: string,
  paymentMethodFilter: string | null = null,
): Promise<{
  totalAmount: number;
  totalComplimentary: number;
  totalPaid: number;
  totalUnpaid: number;
}> {
  try {
    const { data, error } = await supabaseClient
      .from("consultations")
      .select(
        "content, record_type, is_archived, payment_method, invoice_total_amount, invoice_is_complimentary, invoice_is_paid",
      )
      .eq("patient_id", patientId)
      .eq("record_type", "invoice");

    if (error || !data) {
      return {
        totalAmount: 0,
        totalComplimentary: 0,
        totalPaid: 0,
        totalUnpaid: 0,
      };
    }

    let totalAmountNonComplimentary = 0;
    let totalComplimentary = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    for (const row of data as any[]) {
      if ((row as any).is_archived) continue;

      const paymentMethod = (row as any).payment_method as
        | string
        | null
        | undefined;
      if (paymentMethodFilter && paymentMethod !== paymentMethodFilter) {
        continue;
      }

      const content =
        ((row as any).content as string | null | undefined) ?? null;
      const parsed = extractInvoiceInfoFromContent(content);

      const rawAmount = (row as any).invoice_total_amount;
      let amount = 0;
      if (rawAmount !== null && rawAmount !== undefined) {
        const numeric = Number(rawAmount);
        if (Number.isFinite(numeric) && numeric > 0) {
          amount = numeric;
        }
      } else if (parsed.total > 0) {
        amount = parsed.total;
      }

      if (amount <= 0) continue;

      const invoiceIsComplimentaryRaw = (row as any)
        .invoice_is_complimentary;
      const isComplimentary =
        ((typeof invoiceIsComplimentaryRaw === "boolean"
          ? invoiceIsComplimentaryRaw
          : false) || parsed.isComplimentary);

      const invoiceIsPaidRaw = (row as any).invoice_is_paid;
      const isPaid =
        typeof invoiceIsPaidRaw === "boolean" ? invoiceIsPaidRaw : false;

      if (isComplimentary) {
        totalComplimentary += amount;
        continue;
      }

      totalAmountNonComplimentary += amount;

      if (isPaid) {
        totalPaid += amount;
      } else {
        totalUnpaid += amount;
      }
    }

    return {
      totalAmount:
        totalAmountNonComplimentary > 0 ? totalAmountNonComplimentary : 0,
      totalComplimentary:
        totalComplimentary > 0 ? totalComplimentary : 0,
      totalPaid: totalPaid > 0 ? totalPaid : 0,
      totalUnpaid: totalUnpaid > 0 ? totalUnpaid : 0,
    };
  } catch {
    return {
      totalAmount: 0,
      totalComplimentary: 0,
      totalPaid: 0,
      totalUnpaid: 0,
    };
  }
}

export default async function PatientPage({
  params,
  searchParams,
}: PatientDetailsProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const { patient, insurance } = await getPatientWithDetails(id);

  if (!patient) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm">
        Patient not found.
      </div>
    );
  }

  const rawDob = (patient as any).dob as string | null | undefined;
  let age: number | null = null;
  if (rawDob) {
    const dobDate = new Date(rawDob);
    if (!Number.isNaN(dobDate.getTime())) {
      const today = new Date();
      let years = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        years -= 1;
      }
      age = years;
    }
  }

  const genderRaw = (patient as any).gender as string | null | undefined;
  const gender = genderRaw ? genderRaw.toLowerCase() : null;

  // Always use medical mode - CRM is now a tab
  const mode: "medical" = "medical";

  const rawPaymentMethodFilter = (() => {
    const value = resolvedSearchParams?.payment_method;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  })();

  const paymentMethodFilter =
    rawPaymentMethodFilter === "Cash" ||
    rawPaymentMethodFilter === "Online Payment" ||
    rawPaymentMethodFilter === "Bank transfer" ||
    rawPaymentMethodFilter === "Insurance"
      ? rawPaymentMethodFilter
      : null;

  const invoiceSummary = await getInvoiceSummary(id, paymentMethodFilter);

  const crPlayerIdRaw = (() => {
    const value = resolvedSearchParams?.cr_player_id;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  })();

  const crTypeRawParam = (() => {
    const value = resolvedSearchParams?.cr_type;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  })();

  let crType: "breast" | "face" | "body" | null = null;
  if (crTypeRawParam === "breast" || crTypeRawParam === "face" || crTypeRawParam === "body") {
    crType = crTypeRawParam;
  }

  const show3d =
    resolvedSearchParams?.show3d === "1" && !!crPlayerIdRaw && crType !== null;

  const rawMedicalTab = (() => {
    const value = resolvedSearchParams?.m_tab;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value[0];
    return undefined;
  })();

  const medicalTab: MedicalTab =
    rawMedicalTab === "cockpit" ||
    rawMedicalTab === "notes" ||
    rawMedicalTab === "prescription" ||
    rawMedicalTab === "invoice" ||
    rawMedicalTab === "file" ||
    rawMedicalTab === "photo" ||
    rawMedicalTab === "3d" ||
    rawMedicalTab === "patient_information" ||
    rawMedicalTab === "documents" ||
    rawMedicalTab === "crm" ||
    rawMedicalTab === "form_photos"
      ? (rawMedicalTab as MedicalTab)
      : "cockpit";

  const medicalTabs: { id: MedicalTab; label: string }[] = [
    { id: "cockpit", label: "Cockpit" },
    { id: "notes", label: "Notes" },
    { id: "prescription", label: "Prescription" },
    { id: "invoice", label: "Invoice" },
    { id: "3d", label: "3D" },
    { id: "patient_information", label: "Patient Information" },
    { id: "documents", label: "Documents" },
    { id: "crm", label: "CRM" },
  ];

  let genderClasses = "bg-slate-50 text-slate-700 border-slate-200";
  if (gender === "male") {
    genderClasses = "bg-sky-50 text-sky-700 border-sky-200";
  } else if (gender === "female") {
    genderClasses = "bg-pink-50 text-pink-700 border-pink-200";
  }

  return (
    <div className="space-y-6">
      <CollapseSidebarOnMount />
      <PatientModeInitializer patientId={patient.id} />
      <CrisalixPlayerModal
        patientId={patient.id}
        open={mode === "medical" && show3d}
        playerId={crPlayerIdRaw ?? null}
        reconstructionType={crType}
      />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-3 relative z-10">
          <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">
              {patient.first_name} {patient.last_name}
            </h1>
            <PatientEditingPresence patientId={patient.id} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs">
            {genderRaw ? (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${genderClasses}`}
              >
                {(gender === "male" || gender === "female")
                  ? gender.charAt(0).toUpperCase() + gender.slice(1)
                  : genderRaw}
              </span>
            ) : null}
            {age !== null ? (
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-50">
                <span className="opacity-80">Age</span>
                <span className="ml-1 font-semibold">{age}</span>
              </span>
            ) : null}
          </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/patients/${patient.id}?m_tab=crm&composeEmail=1`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300/80 bg-gradient-to-b from-slate-50/90 via-slate-100/90 to-slate-200/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[0_4px_12px_rgba(15,23,42,0.18)] backdrop-blur hover:from-slate-100 hover:to-slate-300"
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                <svg
                  className="h-3.5 w-3.5 text-slate-700"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M3 17L17 10L3 3L5.2 9.2L11 10L5.2 10.8L3 17Z" />
                </svg>
              </span>
              <span>Send an email</span>
            </Link>
            <EditPatientDetailsButton patientId={patient.id} />
            <Link
              href="/patients"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                <svg
                  className="h-3.5 w-3.5 text-slate-600"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                  <path d="M4 20a6 6 0 0 1 8-5.29A6 6 0 0 1 20 20" />
                </svg>
              </span>
              <span>All Contacts</span>
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -top-6 right-0 h-40 w-40 overflow-hidden">
          <div className="medical-glow h-full w-full" />
        </div>
      </div>

      <div className="space-y-6">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex flex-wrap gap-4 text-xs font-medium text-slate-500">
              {medicalTabs.map((tab) => {
                const isActive = tab.id === medicalTab;
                return (
                  <Link
                    key={tab.id}
                    href={`/patients/${patient.id}?m_tab=${tab.id}`}
                    className={
                      (isActive
                        ? "border-sky-500 text-sky-600"
                        : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700") +
                      " inline-flex items-center border-b-2 px-1.5 py-1"
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {medicalTab === "cockpit" ? (
            <>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Consultations for:
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {patient.first_name} {patient.last_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <InvoicePaymentMethodFilter
                      patientId={patient.id}
                      value={paymentMethodFilter}
                    />
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-full bg-slate-100 px-0.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-white">
                          Financial
                        </span>
                        <span className="ml-1 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-white">
                          Medical
                        </span>
                      </div>
                      <Link
                        href={`/patients/${patient.id}/3d`}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-200/80 bg-sky-500 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)] hover:bg-sky-600"
                      >
                        <span>3D</span>
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M4 7.5L10 4.5L16 7.5V12.5L10 15.5L4 12.5V7.5Z"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M10 4.5V10.5"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M4 7.5L10 10.5L16 7.5"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Amount
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalAmount.toFixed(2)} CHF
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Paid
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalPaid.toFixed(2)} CHF
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Unpaid
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalUnpaid.toFixed(2)} CHF
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Complimentary
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalComplimentary.toFixed(2)} CHF
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1 text-[11px]">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Patient Details
                    </h3>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Email:</span>{" "}
                      <span className="text-slate-900">{patient.email ?? "N/A"}</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Mobile Number:</span>{" "}
                      <span className="text-slate-900">{patient.phone ?? "N/A"}</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Civil Status:</span>{" "}
                      <span className="text-slate-900">
                        {patient.marital_status ?? "N/A"}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Gender:</span>{" "}
                      <span className="text-slate-900">{genderRaw ?? "N/A"}</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Patient Number:</span>{" "}
                      <span className="text-slate-900">{patient.id}</span>
                    </p>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Patient Address
                    </h3>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Street Number:</span>{" "}
                      <span className="text-slate-900">N/A</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Street:</span>{" "}
                      <span className="text-slate-900">
                        {patient.street_address ?? "N/A"}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Zip Code:</span>{" "}
                      <span className="text-slate-900">
                        {patient.postal_code ?? "N/A"}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Country:</span>{" "}
                      <span className="text-slate-900">N/A</span>
                    </p>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Patient Emergency Contact
                    </h3>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Name:</span>{" "}
                      <span className="text-slate-900">N/A</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Mobile Number:</span>{" "}
                      <span className="text-slate-900">N/A</span>
                    </p>
                    <p className="text-slate-500">
                      <span className="font-semibold text-slate-700">Relation to Patient:</span>{" "}
                      <span className="text-slate-900">N/A</span>
                    </p>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Before and After
                    </h3>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-slate-500">
                          View reconstruction
                        </p>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <MedicalConsultationsCard patientId={patient.id} />
            </>
          ) : null}

          {medicalTab === "notes" ? (
            <MedicalConsultationsCard patientId={patient.id} recordTypeFilter="notes" />
          ) : null}

          {medicalTab === "prescription" ? (
            <MedicalConsultationsCard patientId={patient.id} recordTypeFilter="prescription" />
          ) : null}

          {medicalTab === "invoice" ? (
            <>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Consultations for:
                    </p>
                    <p className="text-base font-semibold text-slate-900">
                      {patient.first_name} {patient.last_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <InvoicePaymentMethodFilter
                      patientId={patient.id}
                      value={paymentMethodFilter}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Amount
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalAmount.toFixed(2)} CHF
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Paid
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalPaid.toFixed(2)} CHF
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Unpaid
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalUnpaid.toFixed(2)} CHF
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Total Complimentary
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {invoiceSummary.totalComplimentary.toFixed(2)} CHF
                    </p>
                  </div>
                </div>
              </div>

              <MedicalConsultationsCard patientId={patient.id} recordTypeFilter="invoice" />
            </>
          ) : null}

          {medicalTab === "3d" ? (
            <MedicalConsultationsCard patientId={patient.id} recordTypeFilter="3d" />
          ) : null}

          {medicalTab === "file" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">File</h3>
              <p className="mt-2 text-xs text-slate-500">
                The patient file and related clinical information will appear here.
              </p>
            </div>
          ) : null}

          {medicalTab === "photo" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Photo</h3>
              <p className="mt-2 text-xs text-slate-500">
                Clinical photos for this patient will appear here.
              </p>
            </div>
          ) : null}

          {medicalTab === "patient_information" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <PatientIntakeDataCard patientId={patient.id} />
            </div>
          ) : null}

          {medicalTab === "documents" ? (
            <PatientDocumentsTab patientId={patient.id} patientName={`${patient.first_name} ${patient.last_name}`} />
          ) : null}

          {medicalTab === "crm" ? (
            <>
              <div className="grid gap-6 md:grid-cols-2 items-stretch">
                <PatientDetailsTabs patient={patient} insurance={insurance} />
                <PatientCrmPreferencesCard patient={patient} />
              </div>

              <PatientActivityCard
                patientId={patient.id}
                createdAt={(patient as any).created_at ?? null}
                createdBy={(patient as any).created_by ?? null}
                patientEmail={(patient as any).email ?? null}
                contactOwnerName={(patient as any).contact_owner_name ?? null}
              />
            </>
          ) : null}

          {medicalTab === "form_photos" ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <h3 className="text-sm font-semibold text-slate-900">Form Photos</h3>
              <p className="mt-2 text-xs text-slate-500">
                Photos submitted from patient forms will appear here.
              </p>
            </div>
          ) : null}
      </div>
    </div>
  );
}
