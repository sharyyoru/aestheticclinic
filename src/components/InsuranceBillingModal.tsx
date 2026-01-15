"use client";

import { useState, useEffect } from "react";
import {
  INVOICE_STATUS_CONFIG,
  getLawTypeLabel,
  getBillingTypeLabel,
  COMMON_SWISS_INSURERS,
  formatAvsNumber,
  isValidAvsNumber,
  type SwissLawType,
  type BillingType,
  type MediDataInvoiceStatus,
} from "@/lib/medidata";
import { calculateSumexTarmedPrice, SUMEX_TARMED_CODES } from "@/lib/tardoc";

type InsuranceBillingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string;
  patientName: string;
  invoiceAmount: number | null;
  durationMinutes?: number;
  onSuccess?: (submission: any) => void;
};

export default function InsuranceBillingModal({
  isOpen,
  onClose,
  consultationId,
  patientName,
  invoiceAmount,
  durationMinutes = 15,
  onSuccess,
}: InsuranceBillingModalProps) {
  const [billingType, setBillingType] = useState<BillingType>("TG");
  const [lawType, setLawType] = useState<SwissLawType>("KVG");
  const [duration, setDuration] = useState(durationMinutes);
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>([]);
  const [diagnosisInput, setDiagnosisInput] = useState("");
  const [treatmentReason, setTreatmentReason] = useState("disease");
  const [insurerSearch, setInsurerSearch] = useState("");
  const [selectedInsurer, setSelectedInsurer] = useState<string | null>(null);
  const [insurerDropdownOpen, setInsurerDropdownOpen] = useState(false);
  const [avsNumber, setAvsNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any | null>(null);

  // Calculate TARMED price based on duration
  const tarmedCalculation = calculateSumexTarmedPrice(duration);

  // Filter insurers based on search
  const filteredInsurers = COMMON_SWISS_INSURERS.filter(
    (ins) =>
      ins.name?.toLowerCase().includes(insurerSearch.toLowerCase()) ||
      ins.nameFr?.toLowerCase().includes(insurerSearch.toLowerCase())
  );

  useEffect(() => {
    setDuration(durationMinutes);
  }, [durationMinutes]);

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
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/medidata/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId,
          billingType,
          lawType,
          durationMinutes: duration,
          diagnosisCodes,
          treatmentReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invoice submission");
      }

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
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium text-emerald-800">Invoice Created Successfully</p>
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
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.bgColor} ${INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.color}`}>
                    {INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.icon}
                    {INVOICE_STATUS_CONFIG[success.status as MediDataInvoiceStatus]?.labelFr}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <h4 className="mb-2 text-xs font-medium text-slate-500">Service Lines (TARMED)</h4>
                <div className="space-y-1">
                  {success.services?.map((service: any, idx: number) => (
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
                    Current invoice: CHF {invoiceAmount?.toFixed(2) || "0.00"}
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

            {/* Duration and TARMED Calculation */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  Consultation Duration
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDuration(Math.max(1, duration - 1))}
                    className="rounded-full bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                    min="1"
                  />
                  <span className="text-sm text-slate-500">min</span>
                  <button
                    type="button"
                    onClick={() => setDuration(duration + 1)}
                    className="rounded-full bg-slate-100 p-1 text-slate-600 hover:bg-slate-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">TARMED Codes (Sumex)</p>
                {tarmedCalculation.lines.map((line, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600 shadow-sm">
                        {line.code}
                      </code>
                      <span className="text-slate-600">{line.description}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">×{line.quantity}</span>
                      <span className="ml-2 font-medium text-slate-700">
                        CHF {line.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-medium text-slate-700">Total</span>
                  <span className="font-semibold text-slate-900">
                    CHF {tarmedCalculation.totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
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
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                        ×
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
                <option value="maternity">Maternité / Maternity</option>
                <option value="prevention">Prévention / Prevention</option>
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
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create Invoice
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
