import Fuse from "fuse.js";

export type FuzzyPatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob?: string | null;
  // Allow additional fields
  [key: string]: unknown;
};

export type FuzzySearchOptions = {
  threshold?: number; // 0.0 = exact match, 1.0 = match anything (default: 0.4)
  includeScore?: boolean;
  keys?: string[];
};

const DEFAULT_KEYS = [
  { name: "first_name", weight: 2 },
  { name: "last_name", weight: 2 },
  { name: "fullName", weight: 2.5 },
  { name: "fullNameNoSpace", weight: 2 }, // For matching "xaviertenorio" to "Xavier Tenorio"
  { name: "email", weight: 2 },
  { name: "emailUsername", weight: 2 }, // For matching email username part
  { name: "phone", weight: 1 },
];

/**
 * Performs fuzzy search on patient data using Fuse.js
 * Returns patients sorted by match relevance
 */
export function fuzzySearchPatients<T extends FuzzyPatient>(
  patients: T[],
  query: string,
  options: FuzzySearchOptions = {}
): T[] {
  if (!query.trim() || patients.length === 0) {
    return patients;
  }

  const { threshold = 0.4, keys = DEFAULT_KEYS } = options;

  // Prepare data with computed fields for better matching
  const preparedData = patients.map((p) => ({
    ...p,
    fullName: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    // Concatenated name without space for matching "xaviertenorio" to "Xavier Tenorio"
    fullNameNoSpace: `${p.first_name ?? ""}${p.last_name ?? ""}`.toLowerCase(),
    // Extract email username for matching
    emailUsername: (p.email ?? "").split("@")[0].toLowerCase(),
    // Normalize phone for matching
    phoneNormalized: (p.phone ?? "").replace(/\D/g, ""),
  }));

  const fuse = new Fuse(preparedData, {
    keys: [
      ...keys,
      { name: "phoneNormalized", weight: 1 },
    ],
    threshold,
    includeScore: true,
    ignoreLocation: true, // Don't penalize matches that aren't at the start
    minMatchCharLength: 2,
    shouldSort: true,
    findAllMatches: true,
  });

  const results = fuse.search(query);
  
  // Return original patient objects in fuzzy-ranked order
  return results.map((r) => {
    // Remove the computed fields we added
    const { fullName, fullNameNoSpace, emailUsername, phoneNormalized, ...original } = r.item;
    return original as unknown as T;
  });
}

/**
 * Generates loose search patterns for broader initial database fetch
 * This helps catch potential fuzzy matches that would otherwise be missed
 */
export function generateLooseSearchPatterns(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const patterns: string[] = [];
  const isEmailQuery = trimmed.includes("@");
  
  // Original query as-is (highest priority)
  patterns.push(`%${trimmed}%`);
  
  // For email-like queries, prioritize email-specific patterns
  if (isEmailQuery) {
    const username = trimmed.split("@")[0];
    if (username.length >= 2) {
      // Full username is very specific - add it first
      patterns.push(`%${username}%`);
      // Also split username by common separators (., _, -)
      const usernameParts = username.split(/[._-]/).filter((p) => p.length >= 2);
      for (const part of usernameParts) {
        patterns.push(`%${part}%`);
      }
    }
    // For email queries, don't add short prefix patterns that match too broadly
    // The username patterns above are specific enough
  } else {
    // Split into words (by spaces) and add individual word patterns
    const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
    for (const word of words) {
      // Full word pattern - most specific and reliable
      patterns.push(`%${word}%`);
      
      // Add pattern without last character (common typo: extra/wrong ending)
      // This is specific enough to not match too broadly
      if (word.length >= 4) {
        patterns.push(`%${word.slice(0, -1)}%`);
      }
      
      // DON'T add short prefix patterns like %deb% - they match too many records
      // and cause pagination to cut off the actual matches
    }
  }
  
  // Remove duplicates
  return [...new Set(patterns)];
}

/**
 * Builds Supabase OR conditions for fuzzy-friendly search
 * Uses multiple loose patterns to cast a wider net
 */
export function buildFuzzyOrConditions(
  query: string,
  fields: string[] = ["first_name", "last_name", "email", "phone"]
): string {
  const patterns = generateLooseSearchPatterns(query);
  if (patterns.length === 0) return "";

  const conditions: string[] = [];
  
  // Use only the first few patterns to avoid overly complex queries
  // Increased limit to accommodate email username patterns
  const limitedPatterns = patterns.slice(0, 8);
  
  for (const pattern of limitedPatterns) {
    for (const field of fields) {
      conditions.push(`${field}.ilike.${pattern}`);
    }
  }
  
  return conditions.join(",");
}
