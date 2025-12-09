"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export default function NewPatientForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fillSecondaryDetails, setFillSecondaryDetails] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("fillSecondaryDetails");
      if (stored === "true") {
        setFillSecondaryDetails(true);
      } else if (stored === "false") {
        setFillSecondaryDetails(false);
      }
    } catch {
      // ignore read errors
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = (formData.get("first_name") as string | null)?.trim();
    const lastName = (formData.get("last_name") as string | null)?.trim();
    const emailRaw = (formData.get("email") as string | null)?.trim();
    const genderRaw =
      (formData.get("gender") as string | null)?.trim().toLowerCase() || null;
    const countryCode =
      ((formData.get("country_code") as string | null)?.trim() || "+41").replace(
        /\s+/g,
        ""
      );
    const rawPhone = (formData.get("phone") as string | null)?.trim() || "";
    const phone = rawPhone
      ? `${countryCode} ${rawPhone.replace(/^0+/, "")}`.trim()
      : null;

    const source =
      ((formData.get("source") as string | null)?.trim() || "manual").toLowerCase();

    if (!firstName || !lastName || !emailRaw || !rawPhone) {
      setError("First name, last name, email, and phone are required.");
      return;
    }

    const normalizedEmail = emailRaw.toLowerCase();

    setLoading(true);
    setError(null);

    const { data: existing, error: existingError } = await supabaseClient
      .from("patients")
      .select("id")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (!existingError && existing) {
      setError("A patient with this email already exists.");
      setLoading(false);
      return;
    }

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

    const { data: newPatient, error: insertError } = await supabaseClient
      .from("patients")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: normalizedEmail,
        phone,
        gender: genderRaw,
        source,
        created_by_user_id: createdByUserId,
        created_by: createdBy,
      })
      .select("id")
      .single();

    if (insertError || !newPatient) {
      setError(insertError?.message ?? "Failed to create patient.");
      setLoading(false);
      return;
    }

    setLoading(false);
    form.reset();
    if (fillSecondaryDetails) {
      router.push(`/patients/${newPatient.id}/details`);
    } else {
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="space-y-1">
        <label
          htmlFor="first_name"
          className="block text-sm font-medium text-slate-700"
        >
          First name
        </label>
        <input
          id="first_name"
          name="first_name"
          type="text"
          required
          className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="last_name"
          className="block text-sm font-medium text-slate-700"
        >
          Last name
        </label>
        <input
          id="last_name"
          name="last_name"
          type="text"
          required
          className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            Phone
          </label>
          <div className="flex gap-2">
            <select
              id="country_code"
              name="country_code"
              defaultValue="+41"
              className="w-28 rounded-lg border border-slate-200 bg-white/90 px-2 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="+41">🇨🇭 +41</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+1">🇺🇸 +1</option>
            </select>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="79 123 45 67"
              required
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label
          htmlFor="gender"
          className="block text-sm font-medium text-slate-700"
        >
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          defaultValue=""
          className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
          className="block text-sm font-medium text-slate-700"
        >
          Patient source
        </label>
        <select
          id="source"
          name="source"
          defaultValue="manual"
          required
          className="block w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="manual">Manual</option>
          <option value="event">Event</option>
          <option value="meta">Meta</option>
          <option value="google">Google</option>
        </select>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
        <div>
          <p className="font-medium text-slate-700">Fill Secondary Details</p>
          <p className="text-[11px] text-slate-500">
            When on, you'll be guided to address and insurance steps.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={fillSecondaryDetails}
          onClick={() => {
            setFillSecondaryDetails((prev) => {
              const next = !prev;
              try {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(
                    "fillSecondaryDetails",
                    next ? "true" : "false",
                  );
                }
              } catch {
                // ignore write errors
              }
              return next;
            });
          }}
          className={
            (fillSecondaryDetails
              ? "bg-sky-500 border-sky-500"
              : "bg-slate-200 border-slate-300") +
            " relative inline-flex h-6 w-11 items-center rounded-full border transition-colors"
          }
        >
          <span
            className={
              (fillSecondaryDetails ? "translate-x-5" : "translate-x-1") +
              " inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
            }
          />
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-600 px-4 py-1.5 text-sm font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving..." : "Add patient"}
      </button>
    </form>
  );
}
