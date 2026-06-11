"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function PatientAppLoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Already signed in? Go straight to the app.
  useEffect(() => {
    const token = localStorage.getItem("patientapp_token");
    if (token) {
      window.location.href = "/patientapp";
    } else {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patientapp/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patientapp/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: trimmedCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");

      localStorage.setItem("patientapp_token", data.token);
      localStorage.setItem("patientapp_patient", JSON.stringify(data.patient));
      // Use window.location for WebView compatibility (critical for iOS WKWebView)
      window.location.href = "/patientapp";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/logos/aliice-logo.png"
                alt="Aliice"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {step === "email" ? "Patient Portal" : "Check your email"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {step === "email"
                ? "Sign in with the email you gave the clinic"
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            {step === "email" ? (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:shadow-none text-base"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending code...
                    </span>
                  ) : (
                    "Send sign-in code"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                    6-digit code
                  </label>
                  <input
                    id="code"
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    autoComplete="one-time-code"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 placeholder-slate-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                    placeholder="••••••"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:shadow-none text-base"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                  }}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Use a different email
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            Your personal health information, securely accessible
          </p>
        </div>
      </div>

      <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
