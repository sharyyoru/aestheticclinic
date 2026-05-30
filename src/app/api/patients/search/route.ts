import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = "force-dynamic";

/**
 * Patient Search API - Optimized for mobile/iOS
 * 
 * Best practices from top companies (Calendly, Doctolib, Zocdoc):
 * - Server-side filtering (not client-side)
 * - Debounced requests (handled client-side)
 * - Limited results (max 25)
 * - Multiple search strategies (exact, prefix, contains)
 * - Weighted relevance scoring
 */

type PatientResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  relevance_score?: number;
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function calculateRelevanceScore(
  patient: PatientResult,
  queryParts: string[],
  originalQuery: string
): number {
  let score = 0;
  const query = normalizeQuery(originalQuery);
  
  const firstName = (patient.first_name ?? "").toLowerCase();
  const lastName = (patient.last_name ?? "").toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = (patient.email ?? "").toLowerCase();
  const phone = normalizePhone(patient.phone ?? "");
  const dob = patient.dob ?? "";
  
  // Exact full name match (highest priority)
  if (fullName === query) {
    score += 100;
  }
  
  // First name starts with query
  if (firstName.startsWith(query)) {
    score += 50;
  }
  
  // Last name starts with query
  if (lastName.startsWith(query)) {
    score += 50;
  }
  
  // Full name starts with query
  if (fullName.startsWith(query)) {
    score += 40;
  }
  
  // Email exact match or starts with
  if (email === query) {
    score += 80;
  } else if (email.startsWith(query)) {
    score += 35;
  } else if (email.includes(query)) {
    score += 15;
  }
  
  // Phone number match
  const queryDigits = normalizePhone(query);
  if (queryDigits.length >= 3 && phone.includes(queryDigits)) {
    score += 30;
  }
  
  // DOB match (format: YYYY-MM-DD or DD.MM.YYYY)
  if (dob && query.length >= 4) {
    const dobNormalized = dob.replace(/\D/g, "");
    const queryNormalized = query.replace(/\D/g, "");
    if (dobNormalized.includes(queryNormalized) || dob.includes(query)) {
      score += 25;
    }
  }
  
  // Each query part matching adds score
  for (const part of queryParts) {
    if (part.length < 2) continue;
    
    if (firstName.includes(part)) score += 10;
    if (lastName.includes(part)) score += 10;
    if (email.includes(part)) score += 5;
  }
  
  return score;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 50);
    
    // If no query, return recent patients (last created)
    if (!query.trim()) {
      const { data, error } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email, phone, dob")
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({
        patients: data ?? [],
        query: "",
        hasMore: false,
      });
    }
    
    const normalizedQuery = normalizeQuery(query);
    const queryParts = normalizedQuery.split(/\s+/).filter(p => p.length >= 2);
    
    // Build search conditions for Supabase
    // Strategy: Use multiple OR conditions for broader matching
    const searchConditions: string[] = [];
    
    // Pattern for ILIKE search
    const likePattern = `%${normalizedQuery}%`;
    
    // Add conditions for each field
    searchConditions.push(`first_name.ilike.${likePattern}`);
    searchConditions.push(`last_name.ilike.${likePattern}`);
    searchConditions.push(`email.ilike.${likePattern}`);
    searchConditions.push(`phone.ilike.${likePattern}`);
    
    // If query has multiple parts, also search for each part
    for (const part of queryParts) {
      if (part.length >= 2) {
        const partPattern = `%${part}%`;
        searchConditions.push(`first_name.ilike.${partPattern}`);
        searchConditions.push(`last_name.ilike.${partPattern}`);
      }
    }
    
    // Check if query looks like a date (contains digits and separators)
    const isDateQuery = /\d{1,4}[.\-\/]\d{1,2}/.test(query) || /^\d{4}$/.test(query);
    if (isDateQuery) {
      // Try to match DOB
      const dobPattern = `%${normalizedQuery.replace(/[.\-\/]/g, "-")}%`;
      searchConditions.push(`dob.ilike.${dobPattern}`);
    }
    
    // Fetch candidates with OR conditions
    // Limit to more than needed for relevance sorting
    const fetchLimit = Math.min(limit * 4, 100);
    
    const { data: candidates, error } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email, phone, dob")
      .or(searchConditions.join(","))
      .limit(fetchLimit);
    
    if (error) {
      console.error("[Patient Search] Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        patients: [],
        query: normalizedQuery,
        hasMore: false,
      });
    }
    
    // Calculate relevance scores and sort
    const scoredPatients = candidates.map((patient) => ({
      ...patient,
      relevance_score: calculateRelevanceScore(patient, queryParts, query),
    }));
    
    // Sort by relevance (highest first)
    scoredPatients.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    
    // Return top results
    const results = scoredPatients.slice(0, limit);
    
    return NextResponse.json({
      patients: results,
      query: normalizedQuery,
      hasMore: candidates.length >= fetchLimit,
    });
  } catch (error) {
    console.error("[Patient Search] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to search patients" },
      { status: 500 }
    );
  }
}
