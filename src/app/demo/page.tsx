"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { clearDemoCache } from "@/lib/demoMode";

export default function DemoLoginPage() {
  const [email, setEmail] = useState("demo@aliice.com");
  const [password, setPassword] = useState("demotest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleDemoLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError(null);

    // Clear demo cache before login
    clearDemoCache();

    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (signInError || !data.session) {
      setError(signInError?.message ?? "Invalid email or password.");
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
            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-xs text-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.08)] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.01-2.89 2.98-5.11 5.35-6.44" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c5 0 9.27 3.11 11 8-.62 1.77-1.67 3.32-3.02 4.57" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
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
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in to Demo</span>
              )}
            </button>
          </form>
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
