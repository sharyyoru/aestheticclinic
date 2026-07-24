"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { useEmailNotifications } from "@/components/EmailNotificationsContext";

type Insurer = {
  id: string;
  name: string;
  contact_email: string | null;
};

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export default function HeaderInsuranceEmailButton() {
  const router = useRouter();
  const { notifications } = useEmailNotifications();
  const [modalOpen, setModalOpen] = useState(false);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [insurersLoaded, setInsurersLoaded] = useState(false);
  const [insurersLoading, setInsurersLoading] = useState(false);
  const [selectedInsurer, setSelectedInsurer] = useState<Insurer | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const insurerEmails = useMemo(
    () => new Set(insurers.flatMap((insurer) => insurer.contact_email ? [insurer.contact_email.toLowerCase()] : [])),
    [insurers],
  );
  const unreadReplyCount = notifications.filter(
    (notification) =>
      !notification.read_at &&
      !!notification.reply_email?.from_address &&
      insurerEmails.has(notification.reply_email.from_address.toLowerCase()),
  ).length;

  useEffect(() => {
    if (insurersLoaded) return;

    async function loadInsurers() {
      setInsurersLoading(true);
      const { data } = await supabaseClient
        .from("swiss_insurers")
        .select("id, name, contact_email")
        .order("name");
      setInsurers(data || []);
      setInsurersLoaded(true);
      setInsurersLoading(false);
    }

    void loadInsurers();
  }, [insurersLoaded]);

  useEffect(() => {
    if (!modalOpen || patientSearch.trim().length < 2) {
      setPatients([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const search = patientSearch.trim().replace(/[%_]/g, "");
      if (!search) return;
      setPatientsLoading(true);
      const { data } = await supabaseClient
        .from("patients")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
        .order("last_name")
        .limit(8);
      setPatients(data || []);
      setPatientsLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [modalOpen, patientSearch]);

  function closeModal() {
    setModalOpen(false);
    setSelectedInsurer(null);
    setSelectedPatient(null);
    setPatientSearch("");
    setPatients([]);
  }

  function openComposer() {
    if (!selectedInsurer?.contact_email || !selectedPatient?.email) return;
    const params = new URLSearchParams({
      composeEmail: "insurance",
      insurerEmail: selectedInsurer.contact_email,
      insurerName: selectedInsurer.name,
    });
    closeModal();
    router.push(`/patients/${selectedPatient.id}?${params.toString()}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm hover:bg-slate-50"
        title="Email an insurance company"
      >
        <span className="sr-only">Email an insurance company</span>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M7 10h.01M17 10h.01M7 13h.01M17 13h.01" />
        </svg>
        {unreadReplyCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white shadow-sm">
            {unreadReplyCount > 9 ? "9+" : unreadReplyCount}
          </span>
        )}
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" onClick={closeModal}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Email insurance company</h2>
                <p className="mt-1 text-xs text-slate-500">Select an insurer and patient. The patient will be added in CC.</p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Insurance company</label>
                <select
                  value={selectedInsurer?.id || ""}
                  onChange={(event) => setSelectedInsurer(insurers.find((insurer) => insurer.id === event.target.value) || null)}
                  disabled={insurersLoading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
                >
                  <option value="">{insurersLoading ? "Loading insurers..." : "Select an insurer"}</option>
                  {insurers.map((insurer) => <option key={insurer.id} value={insurer.id} disabled={!insurer.contact_email}>{insurer.name} — {insurer.contact_email || "No contact email configured"}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Patient</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    <span>{[selectedPatient.first_name, selectedPatient.last_name].filter(Boolean).join(" ")} — {selectedPatient.email || "No email address"}</span>
                    <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs font-medium text-sky-700 hover:text-sky-800">Change</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="search"
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                      placeholder="Search by patient name or email"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    {patientSearch.trim().length >= 2 && (
                      <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        {patientsLoading ? <p className="px-3 py-2 text-xs text-slate-500">Searching patients...</p> : patients.length === 0 ? <p className="px-3 py-2 text-xs text-slate-500">No patients found.</p> : patients.map((patient) => (
                          <button key={patient.id} type="button" onClick={() => setSelectedPatient(patient)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
                            <span className="block text-sm text-slate-900">{[patient.first_name, patient.last_name].filter(Boolean).join(" ")}</span>
                            <span className="block text-xs text-slate-500">{patient.email || "No email address"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedPatient && !selectedPatient.email && <p className="text-xs text-amber-600">This patient needs an email address to be included in CC.</p>}
              {unreadReplyCount > 0 && <p className="text-xs text-rose-600">{unreadReplyCount} unread insurance {unreadReplyCount === 1 ? "reply" : "replies"} in email notifications.</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={openComposer} disabled={!selectedInsurer?.contact_email || !selectedPatient?.email} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">Open composer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
