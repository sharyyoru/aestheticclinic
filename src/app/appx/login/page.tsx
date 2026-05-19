"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabaseClient";

export default function AppxLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) {
        router.replace("/appx");
      } else {
        setChecking(false);
      }
    }
    checkSession();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const email = (formData.get("email") as string | null)?.trim();
    const password = (formData.get("password") as string | null)?.trim();

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session) {
      setError(signInError?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    router.replace("/appx");
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image 
              src="/logos/AliiceAgent.jpg" 
              alt="Aliice" 
              width={64} 
              height={64} 
              className="rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Aliice Assistant</h1>
          <p className="text-slate-400 text-sm mt-1">Aesthetics Clinic</p>
        </div>

        {/* Login Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">Sign In</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                placeholder="you@clinic.com"
              />
            </div>
            
            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 pr-10 text-sm text-white placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:hover:bg-sky-500"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          AI-powered patient management assistant
        </p>
      </div>
    </div>
  );
}
