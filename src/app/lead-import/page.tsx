"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseLeadsCSV, generateLeadsSummary, type ParsedLead } from "@/lib/csvParser";
import { formatSwissPhone, extractLeadPhones, isValidSwissPhone, formatSwissPhoneDisplay } from "@/lib/phoneFormatter";

type ImportStep = "upload" | "preview" | "confirm" | "importing" | "complete";

export default function LeadImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [confirmedService, setConfirmedService] = useState<string>("");
  const [customService, setCustomService] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceOptions = [
    "Breast Augmentation",
    "Face Fillers",
    "Wrinkle Treatment",
    "Blepharoplasty",
    "Liposuction",
    "IV Therapy",
    "Rhinoplasty",
    "Facelift",
    "Botox",
    "Lip Fillers",
    "Tummy Tuck",
    "Breast Lift",
    "Custom (specify below)",
  ];

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError(null);

    try {
      const text = await selectedFile.text();
      const parsedLeads = parseLeadsCSV(text, selectedFile.name);
      
      if (parsedLeads.length === 0) {
        setError("No leads found in CSV file");
        return;
      }

      setLeads(parsedLeads);
      setConfirmedService(parsedLeads[0]?.detectedService || "");
      setStep("preview");
    } catch (err) {
      console.error("Error parsing CSV:", err);
      setError(err instanceof Error ? err.message : "Failed to parse CSV file");
    }
  }

  async function handleImport() {
    if (!file || leads.length === 0) return;

    const finalService = confirmedService === "Custom (specify below)" ? customService : confirmedService;
    
    if (!finalService) {
      setError("Please select or specify a service");
      return;
    }

    setStep("importing");
    setImporting(true);
    setImportProgress(0);

    try {
      // Process leads with phone formatting
      const leadsToImport = leads.map(lead => {
        const phones = extractLeadPhones(
          lead.phones.primary,
          lead.phones.secondary,
          lead.phones.whatsapp
        );

        return {
          ...lead,
          formattedPhones: phones,
          bestPhone: phones[0]?.phone || null,
          service: finalService,
        };
      });

      // Send to API
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: leadsToImport,
          service: finalService,
          filename: file.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to import leads");
      }

      setImportResult({
        success: result.imported || 0,
        failed: result.failed || 0,
      });
      setStep("complete");
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Failed to import leads");
      setStep("confirm");
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setStep("upload");
    setFile(null);
    setLeads([]);
    setConfirmedService("");
    setCustomService("");
    setError(null);
    setImportResult(null);
  }

  const summary = leads.length > 0 ? generateLeadsSummary(leads) : null;
  const leadsWithIssues = leads.filter(l => l.validationIssues.length > 0);
  const leadsWithPhoneIssues = leads.filter(l => {
    const phones = extractLeadPhones(l.phones.primary, l.phones.secondary, l.phones.whatsapp);
    return phones.length === 0 || !phones.some(p => isValidSwissPhone(p.phone));
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lead Import</h1>
          <p className="mt-1 text-sm text-slate-600">
            Import leads from CSV files and enroll them in automated workflows
          </p>
        </div>
        <button
          onClick={() => router.push("/lead-import/history")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Import History
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-900">Error</h3>
              <p className="mt-1 text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {step === "upload" && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto max-w-xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-sky-100 p-4">
                <svg className="h-12 w-12 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-slate-900">Upload Lead CSV File</h2>
            <p className="mb-6 text-sm text-slate-600">
              Select a CSV file exported from your lead generation platform
            </p>
            
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Choose CSV File
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="sr-only"
              />
            </label>

            <div className="mt-8 rounded-lg bg-slate-50 p-4 text-left">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Expected Format
              </h3>
              <div className="space-y-1 text-xs text-slate-700">
                <p>• CSV file with headers</p>
                <p>• Required: Created, Name, Email or Phone</p>
                <p>• Optional: Source, Form, Channel, Stage, Labels</p>
                <p>• Phone numbers will be auto-formatted for Switzerland</p>
                <p>• Service will be detected from filename</p>
                <p>• <strong>Multilingual support:</strong> Columns in any language (EN, FR, DE, ES, RU, UK)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && summary && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
              <div className="text-xs text-slate-600">Total Leads</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-2xl font-bold text-emerald-900">{summary.valid}</div>
              <div className="text-xs text-emerald-800">Valid Leads</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-2xl font-bold text-amber-900">{summary.withIssues}</div>
              <div className="text-xs text-amber-800">Needs Review</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="text-2xl font-bold text-red-900">{leadsWithPhoneIssues.length}</div>
              <div className="text-xs text-red-800">Phone Issues</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Service Detection</h2>
            
            {summary.detectedService && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Detected Service: <strong>{summary.detectedService}</strong>
                    </p>
                    <p className="mt-1 text-xs text-blue-800">
                      Based on filename: {file?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Confirm or Select Service
              </label>
              <select
                value={confirmedService}
                onChange={(e) => setConfirmedService(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Select service...</option>
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>

              {confirmedService === "Custom (specify below)" && (
                <input
                  type="text"
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  placeholder="Enter custom service name"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                />
              )}
            </div>
          </div>

          {leadsWithPhoneIssues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="mb-3 text-sm font-semibold text-amber-900">
                Phone Number Issues ({leadsWithPhoneIssues.length} leads)
              </h3>
              <p className="mb-4 text-xs text-amber-800">
                The following leads have phone numbers that couldn't be formatted to Swiss standard.
                They will still be imported but may not work with WhatsApp automation.
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {leadsWithPhoneIssues.slice(0, 10).map((lead) => (
                  <div key={lead.rowNumber} className="rounded-lg bg-white p-3 text-xs">
                    <div className="font-medium text-slate-900">{lead.name}</div>
                    <div className="mt-1 text-slate-600">
                      {lead.phones.primary && `Phone: ${lead.phones.primary}`}
                      {lead.phones.whatsapp && ` | WhatsApp: ${lead.phones.whatsapp}`}
                    </div>
                  </div>
                ))}
                {leadsWithPhoneIssues.length > 10 && (
                  <p className="text-xs text-amber-700">
                    +{leadsWithPhoneIssues.length - 10} more...
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={resetImport}
              className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={!confirmedService || (confirmedService === "Custom (specify below)" && !customService)}
              className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              Continue to Import
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-full bg-amber-100 p-3">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Confirm Import</h2>
              <p className="mt-1 text-sm text-slate-600">
                Please review the import details before proceeding
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg bg-slate-50 p-6">
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-700">File:</span>
              <span className="text-sm text-slate-900">{file?.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-700">Service:</span>
              <span className="text-sm font-semibold text-slate-900">
                {confirmedService === "Custom (specify below)" ? customService : confirmedService}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-medium text-slate-700">Total Leads:</span>
              <span className="text-sm text-slate-900">{leads.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-slate-700">Workflow:</span>
              <span className="text-sm text-emerald-600">Request for Information (Auto-enrolled)</span>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> All leads will be created as patients and deals in the system.
              Phone numbers have been formatted for WhatsApp automation.
              Leads will be automatically enrolled in the "Request for Information" workflow.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setStep("preview")}
              disabled={importing}
              className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import Leads"}
            </button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"></div>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Importing Leads...</h2>
          <p className="text-sm text-slate-600">
            Please wait while we process your leads and enroll them in workflows
          </p>
        </div>
      )}

      {step === "complete" && importResult && (
        <div className="rounded-xl border border-emerald-200 bg-white p-8">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-emerald-100 p-4">
              <svg className="h-12 w-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h2 className="mb-2 text-center text-2xl font-bold text-slate-900">Import Complete!</h2>
          <p className="mb-6 text-center text-sm text-slate-600">
            Your leads have been successfully imported and enrolled in workflows
          </p>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
              <div className="text-3xl font-bold text-emerald-900">{importResult.success}</div>
              <div className="text-sm text-emerald-800">Successfully Imported</div>
            </div>
            {importResult.failed > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                <div className="text-3xl font-bold text-red-900">{importResult.failed}</div>
                <div className="text-sm text-red-800">Failed to Import</div>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={resetImport}
              className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Import More Leads
            </button>
            <button
              onClick={() => router.push("/patients")}
              className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              View Patients
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
