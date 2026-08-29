"use client";

import Image from "next/image";
import { FormEvent, useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { clearDemoCache } from "@/lib/demoMode";

export default function DemoLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  // Demo credentials
  const DEMO_EMAIL = "demo@aliice.com";
  const DEMO_PASSWORD = "demotest";

  // Attempt auto-login on mount
  useEffect(() => {
    if (autoLoginAttempted) return;
    setAutoLoginAttempted(true);
    
    // Check if already logged in
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === DEMO_EMAIL) {
        // Already logged in as demo user, redirect to dashboard
        window.location.href = "/";
      }
    });
  }, [autoLoginAttempted]);

  async function handleDemoLogin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError(null);

    // Clear demo cache before login
    clearDemoCache();

    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signInError || !data.session) {
      setError(signInError?.message ?? "Unable to access demo. Please try again.");
      setLoading(false);
      return;
    }

    // Redirect to dashboard
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-violet-50">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        {/* Demo Banner */}
        <div className="mb-6 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-800">
          🎯 Demo Mode — Experience the full platform with sample data
        </div>

        <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 text-sm shadow-[0_22px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-center gap-4">
            <Image
              src="/logos/aliice-logo.png"
              alt="Aliice logo"
              width={120}
              height={40}
              className="h-10 w-auto"
            />
          </div>

          <div className="mb-6 space-y-2 text-center">
            <h1 className="text-xl font-semibold text-slate-900">
              Welcome to Aliice Demo
            </h1>
            <p className="text-sm text-slate-500">
              Explore our aesthetic clinic CRM with pre-loaded sample data.
              No sign-up required.
            </p>
          </div>

          {/* Features List */}
          <div className="mb-6 grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
              <span className="text-base">👥</span>
              <span className="text-slate-700">100+ Sample Patients</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
              <span className="text-base">📅</span>
              <span className="text-slate-700">Appointments & Calendar</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
              <span className="text-base">💼</span>
              <span className="text-slate-700">Deals Pipeline</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
              <span className="text-base">📧</span>
              <span className="text-slate-700">Email & Workflows</span>
            </div>
          </div>

          <form onSubmit={handleDemoLogin} className="space-y-4">
            {/* Hidden credentials display */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-medium text-slate-500">Demo Credentials</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Email:</span>
                  <code className="rounded bg-white px-2 py-0.5 font-mono text-slate-800">{DEMO_EMAIL}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Password:</span>
                  <code className="rounded bg-white px-2 py-0.5 font-mono text-slate-800">{DEMO_PASSWORD}</code>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-200/80 bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] backdrop-blur transition-all hover:bg-sky-700 hover:shadow-[0_15px_30px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Entering Demo...</span>
                </>
              ) : (
                <>
                  <span>Enter Demo</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-xs text-slate-500 hover:text-sky-600 hover:underline"
            >
              Have an account? Sign in here
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>All demo data is isolated and will not affect production data.</p>
          <p className="mt-1">
            Powered by{" "}
            <a href="https://aliice.io" className="text-sky-600 hover:underline" target="_blank" rel="noopener noreferrer">
              Aliice
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
