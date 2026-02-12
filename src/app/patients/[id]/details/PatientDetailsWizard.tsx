"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type PatientRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  marital_status: string | null;
  nationality: string | null;
  street_address: string | null;
  postal_code: string | null;
  town: string | null;
  profession: string | null;
  current_employer: string | null;
  source: string | null;
};

export default function PatientDetailsWizard({
  patientId,
  initialStep = 2,
  mode = "page",
  onClose,
}: {
  patientId: string;
  initialStep?: 1 | 2;
  mode?: "page" | "modal";
  onClose?: () => void;
}) {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPatient() {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from("patients")
        .select(
          "id, first_name, last_name, email, phone, gender, dob, marital_status, nationality, street_address, postal_code, town, profession, current_employer, source",
        )
        .eq("id", patientId)
        .single();

      if (!isMounted) return;

      if (error || !data) {
        setError(error?.message ?? "Patient not found.");
        setLoading(false);
        return;
      }

      setPatient(data as PatientRecord);
      setLoading(false);
    }

    loadPatient();

    return () => {
      isMounted = false;
    };
  }, [patientId]);

  async function handlePrimaryDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patient) return;

    const formData = new FormData(event.currentTarget);

    const firstName = (formData.get("first_name") as string | null)?.trim();
    const lastName = (formData.get("last_name") as string | null)?.trim();
    const emailRaw = (formData.get("email") as string | null)?.trim() || null;
    const phone = (formData.get("phone") as string | null)?.trim() || null;
    if (!firstName || !lastName || !emailRaw || !phone) {
      setError("First name, last name, email, and phone are required.");
      return;
    }

    const email = emailRaw.toLowerCase();

    const updatePayload: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    };

    setSaving(true);
    setError(null);

    const { data: existing, error: existingError } = await supabaseClient
      .from("patients")
      .select("id")
      .ilike("email", email)
      .neq("id", patient.id)
      .limit(1)
      .maybeSingle();

    if (!existingError && existing) {
      setError("Another patient with this email already exists.");
      setSaving(false);
      return;
    }

    const { error } = await supabaseClient
      .from("patients")
      .update(updatePayload)
      .eq("id", patient.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setPatient((prev) =>
      prev
        ? {
            ...prev,
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
          }
        : prev,
    );

    setSaving(false);
    setStep(2);
  }

  async function handleSecondaryDetailsSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!patient) return;

    const formData = new FormData(event.currentTarget);

    const gender =
      (formData.get("gender") as string | null)?.trim().toLowerCase() || null;
    const sourceRaw =
      (formData.get("source") as string | null)?.trim().toLowerCase() || null;
    const maritalStatus =
      (formData.get("marital_status") as string | null)?.trim() || null;
    const nationality =
      (formData.get("nationality") as string | null)?.trim() || "";
    const profession =
      (formData.get("profession") as string | null)?.trim() || "";
    const currentEmployer =
      (formData.get("current_employer") as string | null)?.trim() || "";

    if (
      !nationality ||
      !profession ||
      !currentEmployer
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError(null);

    const updatePayload: Record<string, unknown> = {
      nationality,
      profession,
      current_employer: currentEmployer,
    };

    if (gender) {
      updatePayload.gender = gender;
    }

    if (sourceRaw) {
      updatePayload.source = sourceRaw;
    }

    if (maritalStatus) {
      updatePayload.marital_status = maritalStatus;
    }

    const { error } = await supabaseClient
      .from("patients")
      .update(updatePayload)
      .eq("id", patient.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);

    if (mode === "modal" && onClose) {
      onClose();
    } else {
      router.push("/patients");
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
        Loading patient details...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm">
        {error || "Patient not found."}
      </div>
    );
  }

  const totalSteps = 2;
  let stepTitle = "";
  let stepDescription = "";

  if (step === 1) {
    stepTitle = "Contact details";
    stepDescription = "Edit primary contact information for this patient.";
  } else {
    stepTitle = "Secondary details";
    stepDescription =
      "Complete the patient profile with background details.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Step {step} of {totalSteps}
          </p>
          <h2 className="text-base font-semibold text-slate-900">{stepTitle}</h2>
          <p className="text-xs text-slate-500">{stepDescription}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (mode === "modal" && onClose) {
              onClose();
            } else {
              router.push("/patients");
            }
          }}
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          {mode === "modal" ? "Close" : "Skip for now"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">
              {patient.first_name} {patient.last_name}
            </div>
            <div className="text-xs text-slate-500">
              {patient.email || "No email"} • {patient.phone || "No phone"}
            </div>
          </div>
        </div>

        {error ? (
          <p className="mb-3 text-xs text-red-600">{error}</p>
        ) : null}

        {step === 1 ? (
          <form onSubmit={handlePrimaryDetailsSubmit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="first_name"
                  className="block text-xs font-medium text-slate-700"
                >
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  defaultValue={patient.first_name}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="last_name"
                  className="block text-xs font-medium text-slate-700"
                >
                  Last name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  defaultValue={patient.last_name}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-700"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={patient.email ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="phone"
                  className="block text-xs font-medium text-slate-700"
                >
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={patient.phone ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Next: Secondary details"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSecondaryDetailsSubmit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="gender"
                  className="block text-xs font-medium text-slate-700"
                >
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={patient.gender ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="source"
                  className="block text-xs font-medium text-slate-700"
                >
                  Patient source
                </label>
                <select
                  id="source"
                  name="source"
                  defaultValue={patient.source ?? "manual"}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="manual">Manual</option>
                  <option value="event">Event</option>
                  <option value="meta">Meta</option>
                  <option value="google">Google</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label
                  htmlFor="marital_status"
                  className="block text-xs font-medium text-slate-700"
                >
                  Marital status
                </label>
                <select
                  id="marital_status"
                  name="marital_status"
                  defaultValue={patient.marital_status ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="nationality"
                  className="block text-xs font-medium text-slate-700"
                >
                  Nationality <span className="text-red-500">*</span>
                </label>
                <input
                  id="nationality"
                  name="nationality"
                  type="text"
                  defaultValue={patient.nationality ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="profession"
                  className="block text-xs font-medium text-slate-700"
                >
                  Profession <span className="text-red-500">*</span>
                </label>
                <input
                  id="profession"
                  name="profession"
                  type="text"
                  defaultValue={patient.profession ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="current_employer"
                  className="block text-xs font-medium text-slate-700"
                >
                  Current employer <span className="text-red-500">*</span>
                </label>
                <input
                  id="current_employer"
                  name="current_employer"
                  type="text"
                  defaultValue={patient.current_employer ?? ""}
                  className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-4 py-1.5 text-xs font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Finish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

