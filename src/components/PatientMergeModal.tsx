"use client";

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type PatientData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  contact_owner_name: string | null;
  created_at: string;
  updated_at: string;
};

type MergeSelection = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  contact_owner_name: string | null;
};

type PatientMergeModalProps = {
  patientIds: string[];
  onClose: () => void;
  onSuccess: () => void;
};

export default function PatientMergeModal({
  patientIds,
  onClose,
  onSuccess,
}: PatientMergeModalProps) {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [primaryPatientId, setPrimaryPatientId] = useState<string>("");
  const [mergeSelection, setMergeSelection] = useState<MergeSelection>({
    first_name: "",
    last_name: "",
    email: null,
    phone: null,
    date_of_birth: null,
    address: null,
    city: null,
    postal_code: null,
    country: null,
    contact_owner_name: null,
  });

  useEffect(() => {
    async function loadPatients() {
      try {
        const { data, error: fetchError } = await supabaseClient
          .from("patients")
          .select("*")
          .in("id", patientIds);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) throw new Error("No patients found");

        setPatients(data as PatientData[]);
        
        // Set the most recently updated patient as primary by default
        const sorted = [...data].sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        const primary = sorted[0];
        setPrimaryPatientId(primary.id);
        
        // Initialize merge selection with primary patient's data
        setMergeSelection({
          first_name: primary.first_name,
          last_name: primary.last_name,
          email: primary.email,
          phone: primary.phone,
          date_of_birth: primary.date_of_birth,
          address: primary.address,
          city: primary.city,
          postal_code: primary.postal_code,
          country: primary.country,
          contact_owner_name: primary.contact_owner_name,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patients");
      } finally {
        setLoading(false);
      }
    }

    loadPatients();
  }, [patientIds]);

  async function handleMerge() {
    if (!primaryPatientId) {
      setError("Please select a primary patient");
      return;
    }

    setMerging(true);
    setError(null);

    try {
      const response = await fetch("/api/patients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryPatientId,
          patientIdsToMerge: patientIds.filter(id => id !== primaryPatientId),
          mergedData: mergeSelection,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to merge patients");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge patients");
    } finally {
      setMerging(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-xl bg-white p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <p className="text-sm text-slate-600">Loading patient data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl my-8">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Merge Patients</h2>
          <p className="text-sm text-slate-500">
            Select which data to keep from each patient. All records will be merged into the primary patient.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Primary Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Primary Patient (keep this record)
            </label>
            <select
              value={primaryPatientId}
              onChange={(e) => setPrimaryPatientId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.first_name} {patient.last_name} - {patient.email || "No email"} (Updated: {new Date(patient.updated_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Data Selection Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Field</th>
                  {patients.map((patient) => (
                    <th key={patient.id} className="px-4 py-3 text-left font-medium text-slate-700">
                      {patient.first_name} {patient.last_name}
                      {patient.id === primaryPatientId && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">Primary</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { key: "first_name", label: "First Name" },
                  { key: "last_name", label: "Last Name" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "date_of_birth", label: "Date of Birth" },
                  { key: "address", label: "Address" },
                  { key: "city", label: "City" },
                  { key: "postal_code", label: "Postal Code" },
                  { key: "country", label: "Country" },
                  { key: "contact_owner_name", label: "Contact Owner" },
                ].map((field) => (
                  <tr key={field.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{field.label}</td>
                    {patients.map((patient) => {
                      const value = patient[field.key as keyof PatientData];
                      const isSelected = mergeSelection[field.key as keyof MergeSelection] === value;
                      
                      return (
                        <td key={patient.id} className="px-4 py-3">
                          <button
                            onClick={() => setMergeSelection(prev => ({
                              ...prev,
                              [field.key]: value,
                            }))}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? "border-sky-500 bg-sky-50 text-sky-900"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {value || <span className="text-slate-400">—</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> This action will merge all appointments, documents, consultations, deals, and other data from the selected patients into the primary patient. The other patient records will be deleted. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={merging}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={merging || !primaryPatientId}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {merging ? "Merging..." : "Merge Patients"}
          </button>
        </div>
      </div>
    </div>
  );
}
