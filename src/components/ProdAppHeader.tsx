"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Search, X, Home, User, Loader2, LogIn, LogOut } from "lucide-react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useProdApp } from "./ProdAppContext";

type PatientResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

export default function ProdAppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAppMode, setAppMode } = useProdApp();
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check auth state
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Don't render if not in app mode or on /prodapp itself
  if (!isAppMode || pathname === "/prodapp") {
    return null;
  }

  const canGoBack = pathname !== "/" && pathname !== "/prodapp";
  
  // Get page title from pathname
  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "patients" && segments[1]) {
      return "Patient";
    }
    const titles: Record<string, string> = {
      "": "Dashboard",
      "patients": "Patients",
      "appointments": "Agenda",
      "deals": "Deals",
      "invoices": "Invoices",
      "tasks": "Tasks",
      "settings": "Settings",
      "statistics": "Statistics",
      "chat": "Chat",
      "marketing": "Marketing",
    };
    return titles[segments[0]] || segments[0]?.charAt(0).toUpperCase() + segments[0]?.slice(1) || "Aliice";
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/prodapp");
    }
  };

  const handleHome = () => {
    router.push("/prodapp");
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone")
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(8);
        setSearchResults((data || []) as PatientResult[]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelectPatient = (patientId: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    router.push(`/patients/${patientId}`);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleLogin = () => {
    router.push("/login?redirect=/prodapp");
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await supabaseClient.auth.signOut();
    setAppMode(false);
    router.push("/login?redirect=/prodapp");
  };

  const getUserInitials = () => {
    const meta = user?.user_metadata || {};
    const first = meta.first_name?.[0] || user?.email?.[0] || "U";
    return first.toUpperCase();
  };

  return (
    <>
      {/* Main Header */}
      <header 
        className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-3 py-2 h-14">
          {/* Left: Back or Logo */}
          <div className="flex items-center gap-2 w-20">
            {canGoBack ? (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-full text-slate-600 active:bg-slate-100"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              <Image
                src="/logos/aliice-logo.png"
                alt="Aliice"
                width={70}
                height={23}
                className="h-6 w-auto"
              />
            )}
          </div>

          {/* Center: Title */}
          <h1 className="font-semibold text-slate-900 text-base truncate">
            {getPageTitle()}
          </h1>

          {/* Right: Actions */}
          <div className="flex items-center gap-0.5 justify-end">
            <button
              onClick={openSearch}
              className="p-2 rounded-full text-slate-600 active:bg-slate-100"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={handleHome}
              className="p-2 rounded-full text-slate-600 active:bg-slate-100"
            >
              <Home className="w-5 h-5" />
            </button>
            {/* User/Login Button */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-1.5 rounded-full bg-sky-500 text-white active:bg-sky-600 ml-1"
                >
                  <span className="w-5 h-5 flex items-center justify-center text-xs font-semibold">
                    {getUserInitials()}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user.user_metadata?.first_name || "User"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="p-2 rounded-full text-sky-600 active:bg-sky-50 ml-1"
              >
                <LogIn className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-14" style={{ paddingTop: "env(safe-area-inset-top)" }} />

      {/* Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {/* Search Header */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200">
            <button
              onClick={closeSearch}
              className="p-2 -ml-2 rounded-full text-slate-600 active:bg-slate-100"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search patients..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 70px - env(safe-area-inset-top))" }}>
            {searching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 active:bg-slate-50 text-left"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {(patient.first_name?.[0] || "").toUpperCase()}
                      {(patient.last_name?.[0] || "").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {patient.email || patient.phone || "No contact info"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No patients found</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Search by name, email, or phone</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
