"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { usePatientTabs } from "./PatientTabsContext";
import { fuzzySearchPatients, buildFuzzyOrConditions } from "@/lib/fuzzySearch";

type PatientResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
};

type MatchCategory = "name" | "email" | "phone" | "birthday";

type CategorizedPatient = PatientResult & {
  _score: number;
  _matchCategory: MatchCategory;
  _matchField: string;
};

type CategorizedResults = {
  name: CategorizedPatient[];
  email: CategorizedPatient[];
  phone: CategorizedPatient[];
  birthday: CategorizedPatient[];
};

const CATEGORY_CONFIG: Record<MatchCategory, { label: string; icon: React.ReactNode; color: string }> = {
  name: {
    label: "Name",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    color: "bg-sky-100 text-sky-700",
  },
  email: {
    label: "Email",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    color: "bg-emerald-100 text-emerald-700",
  },
  phone: {
    label: "Phone",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    color: "bg-violet-100 text-violet-700",
  },
  birthday: {
    label: "Birthday",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
    color: "bg-amber-100 text-amber-700",
  },
};

export default function GlobalPatientSearch() {
  const router = useRouter();
  const { addTab } = usePatientTabs();
  const [query, setQuery] = useState("");
  const [categorizedResults, setCategorizedResults] = useState<CategorizedResults>({
    name: [],
    email: [],
    phone: [],
    birthday: [],
  });
  const [hasResults, setHasResults] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCategorizedResults({ name: [], email: [], phone: [], birthday: [] });
      setHasResults(false);
      setIsOpen(false);
      return;
    }

    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        // Build fuzzy-friendly OR conditions for broader initial fetch
        const orConditions = buildFuzzyOrConditions(trimmed, ["first_name", "last_name", "email", "phone"]);
        
        // Run text search query with loose patterns to catch potential fuzzy matches
        const textQuery = supabaseClient
          .from("patients")
          .select("id, first_name, last_name, email, phone, dob")
          .or(orConditions)
          .limit(50); // Fetch more results for fuzzy re-ranking

        // If query looks like an email, also run exact email search
        let emailQuery = null;
        if (trimmed.includes("@")) {
          emailQuery = supabaseClient
            .from("patients")
            .select("id, first_name, last_name, email, phone, dob")
            .ilike("email", `%${trimmed}%`)
            .limit(10);
        }

        // Run DOB query in parallel if search looks like a date pattern
        const hasDigits = /\d/.test(trimmed);
        let dobQuery = null;
        if (hasDigits) {
          // Try DD/MM/YYYY format first (e.g. "28/10/1985")
          const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyyMatch) {
            const day = ddmmyyyyMatch[1].padStart(2, "0");
            const month = ddmmyyyyMatch[2].padStart(2, "0");
            const year = ddmmyyyyMatch[3];
            const isoDate = `${year}-${month}-${day}`;
            dobQuery = supabaseClient
              .from("patients")
              .select("id, first_name, last_name, email, phone, dob")
              .eq("dob", isoDate)
              .limit(10);
          } else {
            // Try exact date match (e.g. "1998-08-21")
            const dateMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (dateMatch) {
              dobQuery = supabaseClient
                .from("patients")
                .select("id, first_name, last_name, email, phone, dob")
                .eq("dob", trimmed)
                .limit(10);
            } else {
              // Year-only search (e.g. "1998")
              const yearMatch = trimmed.match(/^(\d{4})$/);
              if (yearMatch) {
                dobQuery = supabaseClient
                  .from("patients")
                  .select("id, first_name, last_name, email, phone, dob")
                  .gte("dob", `${yearMatch[1]}-01-01`)
                  .lte("dob", `${yearMatch[1]}-12-31`)
                  .limit(10);
              }
            }
          }
        }

        const [textResult, emailResult, dobResult] = await Promise.all([
          textQuery,
          emailQuery ?? Promise.resolve({ data: [] as PatientResult[], error: null }),
          dobQuery ?? Promise.resolve({ data: [] as PatientResult[], error: null }),
        ]);

        if (textResult.error) {
          console.error("Search error:", textResult.error);
          setCategorizedResults({ name: [], email: [], phone: [], birthday: [] });
          setHasResults(false);
        } else {
          let filtered = (textResult.data ?? []) as PatientResult[];

          // Merge email results first (they should be prioritized for email searches)
          const emailData = (emailResult?.data ?? []) as PatientResult[];
          for (const m of emailData) {
            if (!filtered.some(f => f.id === m.id)) filtered.unshift(m); // Add to front
          }

          // Merge DOB results (avoiding duplicates)
          const dobData = (dobResult?.data ?? []) as PatientResult[];
          for (const m of dobData) {
            if (!filtered.some(f => f.id === m.id)) filtered.push(m);
          }
          
          // Preserve exact email matches before fuzzy re-ranking (they should always appear)
          const exactEmailMatches = filtered.filter(p => 
            p.email?.toLowerCase().includes(trimmed.toLowerCase())
          );
          
          // Apply fuzzy search re-ranking for better relevance
          filtered = fuzzySearchPatients(filtered, trimmed, { threshold: 0.5 });
          
          // Ensure exact email matches are included even if fuzzy search filtered them out
          for (const m of exactEmailMatches) {
            if (!filtered.some(f => f.id === m.id)) {
              filtered.unshift(m); // Add to front
            }
          }
          
          // Split search into words for categorization
          const words = trimmed.split(/\s+/).filter(w => w.length > 0);

          // Categorize results by match type
          const queryLower = trimmed.toLowerCase();
          const queryDigits = queryLower.replace(/\D/g, "");
          
          const categorized: CategorizedResults = {
            name: [],
            email: [],
            phone: [],
            birthday: [],
          };
          
          // Track which patients are already added to avoid duplicates across categories
          const addedIds = new Set<string>();
          
          for (const patient of filtered) {
            const firstName = (patient.first_name ?? "").toLowerCase();
            const lastName = (patient.last_name ?? "").toLowerCase();
            const fullName = `${firstName} ${lastName}`.trim();
            const email = (patient.email ?? "").toLowerCase();
            const phone = (patient.phone ?? "").toLowerCase();
            const phoneDigits = phone.replace(/\D/g, "");
            const dob = patient.dob ?? "";
            
            let matchCategory: MatchCategory | null = null;
            let matchField = "";
            let score = 0;
            
            // Check name match (first name, last name, or full name)
            if (fullName === queryLower) {
              matchCategory = "name";
              matchField = "Full Name";
              score = 100;
            } else if (firstName === queryLower) {
              matchCategory = "name";
              matchField = "First Name";
              score = 90;
            } else if (lastName === queryLower) {
              matchCategory = "name";
              matchField = "Last Name";
              score = 90;
            } else if (firstName.startsWith(queryLower) || lastName.startsWith(queryLower)) {
              matchCategory = "name";
              matchField = firstName.startsWith(queryLower) ? "First Name" : "Last Name";
              score = 70;
            } else if (fullName.includes(queryLower) || firstName.includes(queryLower) || lastName.includes(queryLower)) {
              matchCategory = "name";
              matchField = "Name";
              score = 50;
            }
            // Check multi-word name match
            else if (words.length > 1) {
              const firstNameMatch = words.some(w => firstName.includes(w.toLowerCase()));
              const lastNameMatch = words.some(w => lastName.includes(w.toLowerCase()));
              if (firstNameMatch && lastNameMatch) {
                matchCategory = "name";
                matchField = "Full Name";
                score = 60;
              }
            }
            
            // Check email match
            if (!matchCategory && email) {
              if (email === queryLower) {
                matchCategory = "email";
                matchField = "Email";
                score = 100;
              } else if (email.startsWith(queryLower)) {
                matchCategory = "email";
                matchField = "Email";
                score = 80;
              } else if (email.includes(queryLower)) {
                matchCategory = "email";
                matchField = "Email";
                score = 60;
              }
            }
            
            // Check phone match
            if (!matchCategory && phone) {
              if (phone === queryLower || phoneDigits === queryDigits) {
                matchCategory = "phone";
                matchField = "Phone";
                score = 100;
              } else if (phone.includes(queryLower) || phoneDigits.includes(queryDigits)) {
                matchCategory = "phone";
                matchField = "Phone";
                score = 70;
              }
            }
            
            // Check DOB match
            if (!matchCategory && dob) {
              const dobFormatted = new Date(dob).toLocaleDateString();
              if (dob === queryLower || dob.includes(queryLower) || dobFormatted.includes(queryLower)) {
                matchCategory = "birthday";
                matchField = "Date of Birth";
                score = 100;
              } else if (dobData.some(d => d.id === patient.id)) {
                matchCategory = "birthday";
                matchField = "Date of Birth";
                score = 90;
              }
            }
            
            // Default to name category if no specific match found
            if (!matchCategory) {
              matchCategory = "name";
              matchField = "Name";
              score = 10;
            }
            
            // Add to appropriate category if not already added
            if (!addedIds.has(patient.id)) {
              addedIds.add(patient.id);
              categorized[matchCategory].push({
                ...patient,
                _score: score,
                _matchCategory: matchCategory,
                _matchField: matchField,
              });
            }
          }
          
          // Sort each category by score
          for (const category of Object.keys(categorized) as MatchCategory[]) {
            categorized[category].sort((a, b) => {
              if (b._score !== a._score) return b._score - a._score;
              const nameA = `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase();
              const nameB = `${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase();
              return nameA.localeCompare(nameB);
            });
            // Limit each category to 4 results
            categorized[category] = categorized[category].slice(0, 4);
          }
          
          const totalResults = Object.values(categorized).reduce((sum, arr) => sum + arr.length, 0);
          setCategorizedResults(categorized);
          setHasResults(totalResults > 0);
          setIsOpen(totalResults > 0);
        }
      } catch (err) {
        console.error("Search catch error:", err);
        setCategorizedResults({ name: [], email: [], phone: [], birthday: [] });
        setHasResults(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  function handleSelect(patient: PatientResult) {
    // Add patient to tabs
    addTab({
      id: patient.id,
      firstName: patient.first_name ?? "",
      lastName: patient.last_name ?? "",
    });
    
    setQuery("");
    setCategorizedResults({ name: [], email: [], phone: [], birthday: [] });
    setHasResults(false);
    setIsOpen(false);
    router.push(`/patients/${patient.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hasResults && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search patients..."
          className="w-full rounded-full border border-slate-300/60 bg-slate-200/70 px-4 py-2 pl-4 pr-10 text-sm text-slate-900 placeholder-slate-500 shadow-inner backdrop-blur-sm transition-all focus:border-slate-400/80 focus:bg-slate-100/90 focus:outline-none focus:ring-1 focus:ring-slate-300/60"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          {loading ? (
            <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </div>
      </div>

      {isOpen && hasResults && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-[400px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {(Object.keys(categorizedResults) as MatchCategory[]).map((category) => {
            const patients = categorizedResults[category];
            if (patients.length === 0) return null;
            
            const config = CATEGORY_CONFIG[category];
            
            return (
              <div key={category}>
                {/* Category Header */}
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-slate-50/95 px-4 py-2 backdrop-blur-sm">
                  <span className={`flex items-center justify-center rounded-md p-1 ${config.color}`}>
                    {config.icon}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {config.label}
                  </span>
                  <span className="text-[10px] text-slate-400">({patients.length})</span>
                </div>
                
                {/* Category Results */}
                {patients.map((patient) => {
                  const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Unnamed";
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handleSelect(patient)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white shadow-sm">
                        {(patient.first_name?.[0] ?? patient.email?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
                        <div className="flex items-center gap-2">
                          {patient.email && (
                            <p className="text-xs text-slate-500 truncate">{patient.email}</p>
                          )}
                          {patient.dob && (
                            <p className="text-xs text-slate-400">
                              DOB: {new Date(patient.dob).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {patient.phone && (
                          <span className="text-xs text-slate-400">{patient.phone}</span>
                        )}
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${config.color}`}>
                          {patient._matchField}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
