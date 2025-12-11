"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import Image from "next/image";

type ViewState = "search" | "register";

export default function IntakePage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>("search");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("+41"); // Switzerland default
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");

  const countryCodes = [
    { code: "+41", country: "Switzerland", flag: "🇨🇭" },
    { code: "+33", country: "France", flag: "🇫🇷" },
    { code: "+49", country: "Germany", flag: "🇩🇪" },
    { code: "+39", country: "Italy", flag: "🇮🇹" },
    { code: "+44", country: "UK", flag: "🇬🇧" },
    { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
    { code: "+7", country: "Russia", flag: "🇷🇺" },
    { code: "+34", country: "Spain", flag: "🇪🇸" },
    { code: "+971", country: "UAE", flag: "🇦🇪" },
    { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  ];

  async function handleEmailSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if patient exists
      const { data: patient } = await supabaseClient
        .from("patients")
        .select("id, first_name, last_name, email")
        .ilike("email", email.trim())
        .maybeSingle();

      if (patient) {
        // Patient exists - create submission and go to steps
        const { data: submission, error: subError } = await supabaseClient
          .from("patient_intake_submissions")
          .insert({
            patient_id: patient.id,
            status: "in_progress",
            current_step: 1,
          })
          .select("id")
          .single();

        if (subError) throw subError;

        // Redirect to steps with submission ID
        router.push(`/intake/steps?sid=${submission?.id}&pid=${patient.id}`);
      } else {
        // Patient doesn't exist - show registration form
        setRegEmail(email.trim());
        setView("register");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !regEmail.trim() || !phone.trim()) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create new patient
      const { data: newPatient, error: patientError } = await supabaseClient
        .from("patients")
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: regEmail.trim().toLowerCase(),
          phone: `${countryCode}${phone.trim().replace(/^0+/, "")}`,
          country_code: countryCode,
          source: "intake_form",
        })
        .select("id")
        .single();

      if (patientError) throw patientError;

      // Create intake submission
      const { data: submission, error: subError } = await supabaseClient
        .from("patient_intake_submissions")
        .insert({
          patient_id: newPatient?.id,
          status: "in_progress",
          current_step: 1,
        })
        .select("id")
        .single();

      if (subError) throw subError;

      // Trigger patient_created workflow
      try {
        await fetch("/api/workflows/patient-created", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: newPatient?.id }),
        });
      } catch {
        // Don't block on workflow trigger failure
        console.error("Failed to trigger patient_created workflow");
      }

      // Redirect to steps
      router.push(`/intake/steps?sid=${submission?.id}&pid=${newPatient?.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded border border-slate-200 flex items-center justify-center bg-white">
            <span className="text-xl font-serif">A</span>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600 p-2">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-light text-slate-900 mb-4">
              Advanced Aesthetic Treatments<br />
              <span className="text-rose-600">Tailored to You</span>
            </h1>
            <p className="text-slate-600 text-sm">
              Easily provide your details and preferences in our simple, multi-step form,
              designed to assess your needs and treatments.
            </p>
          </div>

          {view === "search" ? (
            /* Email Search Form */
            <form onSubmit={handleEmailSearch} className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-slate-900 mb-4">Search</h2>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {loading ? "Searching..." : "Continue"}
              </button>

              <p className="text-center text-sm text-slate-500">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setView("register");
                    setRegEmail(email);
                  }}
                  className="text-rose-600 hover:underline"
                >
                  Register
                </button>
              </p>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-5">
              <h2 className="text-lg font-medium text-slate-900 mb-4">Register</h2>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                disabled={loading}
              />

              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                disabled={loading}
              />

              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-28 px-3 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  disabled={loading}
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile"
                  className="flex-1 px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  disabled={loading}
                />
              </div>

              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                disabled={loading}
              />

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {loading ? "Registering..." : "Register"}
              </button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setView("search")}
                  className="text-rose-600 hover:underline"
                >
                  Login
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
