"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  INVOICE_STATUS_CONFIG,
  type SwissLawType,
  type BillingType,
  type MediDataInvoiceStatus,
} from "@/lib/medidata";
import InsurerSearchSelect from "@/components/InsurerSearchSelect";

type LineItem = {
  id: string;
  code: string | null;
  tardoc_code: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tp_al: number;
  tp_tl: number;
};

type InsuranceBillingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string; // This is the invoice ID
  patientId: string;
  patientName: string;
  invoiceAmount: number | null;
  durationMinutes?: number;
  onSuccess?: (submission: any) => void;
};

export default function InsuranceBillingModal({
  isOpen,
  onClose,
  consultationId,
  patientId,
  patientName,
  invoiceAmount,
  durationMinutes = 15,
  onSuccess,
}: InsuranceBillingModalProps) {
  const [billingType, setBillingType] = useState<BillingType>("TG");
  const [lawType, setLawType] = useState<SwissLawType>("KVG");
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>([]);
  const [diagnosisInput, setDiagnosisInput] = useState("");
  const [treatmentReason, setTreatmentReason] = useState("disease");
  const [selectedInsurerGln, setSelectedInsurerGln] = useState("");
  const [selectedInsurerName, setSelectedInsurerName] = useState("");
  const [avsNumber, setAvsNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);

  // Real invoice line items loaded from DB
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Load invoice line items and patient insurance data when modal opens
  useEffect(() => {
    if (!isOpen || !consultationId) return;
    let cancelled = false;

    async function loadData() {
      setLineItemsLoading(true);

      // Load line items from invoice_line_items
      const { data: items } = await supabaseClient
        .from("invoice_line_items")
        .select("id, code, tardoc_code, name, quantity, unit_price, total_price, tp_al, tp_tl")
        .eq("invoice_id", consultationId)
        .order("sort_order", { ascending: true });

      if (!cancelled && items) {
        setLineItems(items as LineItem[]);
      }

      // Load patient's primary insurance to pre-fill fields
      if (!prefilled) {
        const { data: insurance } = await supabaseClient
          .from("patient_insurances")
          .select("insurer_id, insurer_gln, provider_name, avs_number, policy_number, law_type, billing_type, case_number, card_number")
          .eq("patient_id", patientId)
          .eq("is_primary", true)
          .maybeSingle();

        if (!cancelled && insurance) {
          if (insurance.insurer_gln) setSelectedInsurerGln(insurance.insurer_gln);
          if (insurance.provider_name) setSelectedInsurerName(insurance.provider_name);
          if (insurance.avs_number) setAvsNumber(insurance.avs_number);
          if (insurance.policy_number) setPolicyNumber(insurance.policy_number);
          if (insurance.case_number) setCaseNumber(insurance.case_number);
          if (insurance.law_type) setLawType(insurance.law_type as SwissLawType);
          if (insurance.billing_type) setBillingType(insurance.billing_type as BillingType);
          setPrefilled(true);
        }

        // Also load invoice-level data (treatment_reason, diagnosis_codes, billing_type, etc.)
        const { data: inv } = await supabaseClient
          .from("invoices")
          .select("billing_type, health_insurance_law, treatment_reason, diagnosis_codes")
          .eq("id", consultationId)
          .maybeSingle();

        if (!cancelled && inv) {
          if (inv.billing_type) setBillingType(inv.billing_type as BillingType);
          if (inv.health_insurance_law) setLawType(inv.health_insurance_law as SwissLawType);
          if (inv.treatment_reason) setTreatmentReason(inv.treatment_reason);
          if (inv.diagnosis_codes && Array.isArray(inv.diagnosis_codes)) {
            const codes = inv.diagnosis_codes.map((d: any) => d.code).filter(Boolean);
            if (codes.length > 0) setDiagnosisCodes(codes);
          }
        }
      }

      if (!cancelled) setLineItemsLoading(false);
    }

    void loadData();
    return () => { cancelled = true; };
  }, [isOpen, consultationId, patientId, prefilled]);

  // Reset prefilled flag when modal closes
  useEffect(() => {
    if (!isOpen) setPrefilled(false);
  }, [isOpen]);

  const lineItemsTotal = lineItems.reduce((sum, li) => sum + (li.total_price || 0), 0);
  const displayTotal = lineItems.length > 0 ? lineItemsTotal : (invoiceAmount || 0);

  const handleAddDiagnosis = () => {
    const code = diagnosisInput.trim().toUpperCase();
    if (code && !diagnosisCodes.includes(code)) {
      setDiagnosisCodes([...diagnosisCodes, code]);
      setDiagnosisInput("");
    }
  };

  const handleRemoveDiagnosis = (code: string) => {
    setDiagnosisCodes(diagnosisCodes.filter((c) => c !== code));
  };

  const handleSubmit = async () => {
    if (!selectedInsurerGln) {
      setError("Please select an insurance company");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/medidata/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: consultationId,
          consultationId,
          patientId,
          billingType,
          lawType,
          diagnosisCodes,
          treatmentReason,
          insurerGln: selectedInsurerGln,
          insurerName: selectedInsurerName,
          policyNumber,
          avsNumber,
          caseNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invoice submission");
      }

      // Update the invoice record with insurance fields
      await supabaseClient
        .from("invoices")
        .update({
          billing_type: billingType,
          health_insurance_law: lawType,
          treatment_reason: treatmentReason,
          insurance_gln: selectedInsurerGln,
          insurance_name: selectedInsurerName,
          patient_ssn: avsNumber || null,
          diagnosis_codes: diagnosisCodes.map((c) => ({ code: c, type: "ICD" })),
          medical_case_number: caseNumber || null,
        })
        .eq("id", consultationId);

      setSuccess(data.submission);
      onSuccess?.(data.submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Send Invoice to Insurance
            </h2>
            <p className="text-sm text-slate-500">
              via MediData / Sumex XML
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">&#x2705;</span>
                <div>
                  <p className="font-medium text-emerald-800">Invoice Submitted Successfully</p>
                  <p className="text-sm text-emerald-600">
                    Invoice #{success.invoiceNumber} is ready for transmission
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Invoice Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Number</span>
                  <span className="font-medium">{success.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Amount</span>
                  <span className="font-medium">CHF {success.total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.bgColor || "bg-slate-100"} ${INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.color || "text-slate-600"}`}>
                    {INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.icon}
                    {INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.labelFr || success.status}
                  </span>
                </div>
              </div>

              {success.services?.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h4 className="mb-2 text-xs font-medium text-slate-500">Service Lines</h4>
                  <div className="space-y-1">
                    {success.services.map((service: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-slate-600">
                          <code className="mr-2 rounded bg-slate-100 px-1 py-0.5 text-[10px]">{service.code}</code>
                          {service.description}
                        </span>
                        <span className="font-medium">CHF {service.total?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Patient Info */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{patientName}</p>
                  <p className="text-sm text-slate-500">
                    Invoice total: CHF {displayTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Billing Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Billing Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingType("TG")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      billingType === "TG"
                        ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold">Tiers Garant</div>
                    <div className="text-[10px] opacity-75">Patient pays</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingType("TP")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      billingType === "TP"
                        ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold">Tiers Payant</div>
                    <div className="text-[10px] opacity-75">Insurer pays</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Law Type
                </label>
                <select
                  value={lawType}
                  onChange={(e) => setLawType(e.target.value as SwissLawType)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="KVG">KVG - Assurance maladie</option>
                  <option value="UVG">UVG - Assurance accident</option>
                  <option value="IVG">IVG - Assurance invalidité</option>
                  <option value="MVG">MVG - Assurance militaire</option>
                  <option value="VVG">VVG - Assurance privée</option>
                </select>
              </div>
            </div>

            {/* Insurance Selection */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 text-xs font-medium text-slate-700">Insurance Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Insurance Company
                  </label>
                  <InsurerSearchSelect
                    value={selectedInsurerGln}
                    onChange={(gln, name) => {
                      setSelectedInsurerGln(gln);
                      setSelectedInsurerName(name || "");
                    }}
                    placeholder="Search insurer (e.g., CSS, Helsana, Swica)..."
                    inputClassName="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      AVS/AHV Number
                    </label>
                    <input
                      type="text"
                      value={avsNumber}
                      onChange={(e) => setAvsNumber(e.target.value)}
                      placeholder="756.XXXX.XXXX.XX"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Policy Number
                    </label>
                    <input
                      type="text"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="e.g., 123456789"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Case Number (for UVG/accident)
                  </label>
                  <input
                    type="text"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Invoice Line Items (from DB) */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 text-xs font-medium text-slate-700">
                Invoice Service Lines
              </h3>
              {lineItemsLoading ? (
                <div className="py-4 text-center text-xs text-slate-400">Loading line items...</div>
              ) : lineItems.length > 0 ? (
                <div className="space-y-1.5">
                  {lineItems.map((li) => {
                    const isTardoc = !!li.tardoc_code;
                    return (
                      <div key={li.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs text-slate-600 shadow-sm">
                            {li.tardoc_code || li.code || "-"}
                          </code>
                          {isTardoc && (
                            <span className="shrink-0 rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-medium text-emerald-700">
                              TARDOC
                            </span>
                          )}
                          <span className="truncate text-xs text-slate-600">{li.name}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-slate-400">&times;{li.quantity}</span>
                          <span className="ml-2 text-xs font-medium text-slate-700">
                            CHF {(li.total_price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-sm font-medium text-slate-700">Total</span>
                    <span className="text-sm font-semibold text-slate-900">
                      CHF {lineItemsTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-slate-400">
                  No line items found for this invoice.
                  {invoiceAmount ? ` Invoice amount: CHF ${invoiceAmount.toFixed(2)}` : ""}
                </div>
              )}
            </div>

            {/* Diagnosis Codes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                ICD-10 Diagnosis Codes (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={diagnosisInput}
                  onChange={(e) => setDiagnosisInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDiagnosis()}
                  placeholder="e.g., L70.0"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAddDiagnosis}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                >
                  Add
                </button>
              </div>
              {diagnosisCodes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {diagnosisCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => handleRemoveDiagnosis(code)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Treatment Reason */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Treatment Reason
              </label>
              <select
                value={treatmentReason}
                onChange={(e) => setTreatmentReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="disease">Maladie / Disease</option>
                <option value="accident">Accident</option>
                <option value="maternity">Maternit&eacute; / Maternity</option>
                <option value="prevention">Pr&eacute;vention / Prevention</option>
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Send to Insurance
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
