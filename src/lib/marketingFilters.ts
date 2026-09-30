import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Filter schema for marketing audience selection. Mirrors the `filter` jsonb
 * column on `marketing_lists` and the `filter_snapshot` on `marketing_campaigns`.
 */
export type MarketingFilter = {
  /** Exact-match list of contact_owner_name values. */
  ownerNames?: string[];
  /** ISO date (YYYY-MM-DD). Matches patients.created_at >= this. */
  createdAfter?: string | null;
  /** ISO date (YYYY-MM-DD). Matches patients.created_at < this (exclusive end). */
  createdBefore?: string | null;
  /** "any" | "has" | "none" */
  hasDeal?: "any" | "has" | "none";
  /** Restrict to patients whose deals have one of these stage IDs. */
  dealStageIds?: string[];
  /** 1-12. Match patients whose DOB month equals this (for birthday campaigns). */
  dobMonth?: number | null;
  /** Lead-source string match (exact). */
  sources?: string[];
  /** Full-text partial match across name/email. */
  search?: string;
  /** When true (default), skip patients without an email. */
  requireEmail?: boolean;
  /** When true (default), exclude patients.marketing_opt_out = true. */
  excludeOptOut?: boolean;
};

export type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  source: string | null;
  contact_owner_name: string | null;
  created_at: string | null;
  marketing_opt_out?: boolean | null;
};

/** Maximum rows fetched in one audience query. Larger audiences are paginated by callers. */
export const MAX_CAMPAIGN_RECIPIENTS = 5000;

function normaliseFilter(f: MarketingFilter | null | undefined): MarketingFilter {
  return {
    ownerNames: f?.ownerNames ?? [],
    createdAfter: f?.createdAfter ?? null,
    createdBefore: f?.createdBefore ?? null,
    hasDeal: f?.hasDeal ?? "any",
    dealStageIds: f?.dealStageIds ?? [],
    dobMonth: f?.dobMonth ?? null,
    sources: f?.sources ?? [],
    search: f?.search ?? "",
    requireEmail: f?.requireEmail ?? true,
    excludeOptOut: f?.excludeOptOut ?? true,
  };
}

/**
 * Apply a MarketingFilter against the `patients` table and return the matching rows.
 * The caller is responsible for providing an admin Supabase client.
 *
 * Limits: MAX_CAMPAIGN_RECIPIENTS hard cap.
 */
export async function fetchAudience(
  supabase: SupabaseClient,
  filter: MarketingFilter | null | undefined,
  opts: { limit?: number; offset?: number; countOnly?: boolean } = {},
): Promise<{ rows: PatientRow[]; count: number | null; fetchedCount: number }> {
  const f = normaliseFilter(filter);
  const hardCap = Math.min(opts.limit ?? MAX_CAMPAIGN_RECIPIENTS, MAX_CAMPAIGN_RECIPIENTS);

  // If we need to filter by deal presence/stage, first pull the matching patient_ids
  let patientIdFilter: string[] | null = null;
  if (f.hasDeal === "has" || f.hasDeal === "none" || (f.dealStageIds && f.dealStageIds.length > 0)) {
    let dealsQuery = supabase.from("deals").select("patient_id");
    if (f.dealStageIds && f.dealStageIds.length > 0) {
      dealsQuery = dealsQuery.in("stage_id", f.dealStageIds);
    }
    const { data: dealRows, error: dealErr } = await dealsQuery.limit(50000);
    if (dealErr) throw dealErr;
    const dealPatientIds = Array.from(
      new Set((dealRows ?? []).map((r) => r.patient_id).filter((x): x is string => !!x)),
    );
    if (f.hasDeal === "none") {
      // We need patients NOT in this set. We can't use .not("id", "in", ...) for huge sets
      // so we fetch all candidate patients and filter in memory below.
      patientIdFilter = dealPatientIds; // interpret as exclusion
    } else {
      // "has" or specific stage → only these patient IDs match
      if (dealPatientIds.length === 0) {
        return { rows: [], count: 0, fetchedCount: 0 };
      }
      patientIdFilter = dealPatientIds;
    }
  }

  let query = supabase
    .from("patients")
    .select(
      "id, first_name, last_name, email, phone, dob, source, contact_owner_name, created_at, marketing_opt_out",
      { count: opts.countOnly ? "exact" : "planned" },
    );

  if (f.requireEmail) {
    query = query.not("email", "is", null).neq("email", "");
  }
  if (f.excludeOptOut) {
    query = query.or("marketing_opt_out.is.null,marketing_opt_out.eq.false");
  }
  if (f.ownerNames && f.ownerNames.length > 0) {
    query = query.in("contact_owner_name", f.ownerNames);
  }
  if (f.sources && f.sources.length > 0) {
    query = query.in("source", f.sources);
  }
  if (f.createdAfter) {
    query = query.gte("created_at", f.createdAfter);
  }
  if (f.createdBefore) {
    query = query.lt("created_at", f.createdBefore);
  }
  if (f.search && f.search.trim()) {
    const term = `%${f.search.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  // Deal inclusion (not exclusion) — apply via .in()
  if (patientIdFilter && f.hasDeal !== "none") {
    query = query.in("id", patientIdFilter);
  }

  // The secondary sort on `id` is load-bearing. `created_at` is not unique —
  // bulk imports share a timestamp — and offset pagination over a non-unique
  // sort key lets a row appear on two pages while another is never returned.
  query = query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(hardCap);
  if (opts.offset && opts.offset > 0) {
    query = query.range(opts.offset, opts.offset + hardCap - 1);
  }

  const { data, error, count } = await query;
  if (error) {
    // PostgREST answers an offset past the final row with 416/PGRST103 rather
    // than an empty list, so a paginating caller has to read it as
    // end-of-data. Only reachable when an offset was requested, where the
    // meaning is unambiguous.
    if (error.code === "PGRST103" && opts.offset && opts.offset > 0) {
      return { rows: [], count: count ?? 0, fetchedCount: 0 };
    }
    throw error;
  }
  const fetchedCount = data?.length ?? 0;
  let rows = (data ?? []) as PatientRow[];

  // Deal exclusion (we had to fetch and filter in memory)
  if (patientIdFilter && f.hasDeal === "none") {
    const excludeSet = new Set(patientIdFilter);
    rows = rows.filter((r) => !excludeSet.has(r.id));
  }

  // DOB-month filter (must be done in JS — dob is a date, Supabase can't easily extract month)
  if (f.dobMonth && f.dobMonth >= 1 && f.dobMonth <= 12) {
    rows = rows.filter((r) => {
      if (!r.dob) return false;
      const d = new Date(r.dob);
      if (Number.isNaN(d.getTime())) return false;
      return d.getUTCMonth() + 1 === f.dobMonth;
    });
  }

  return { rows, count: count ?? rows.length, fetchedCount };
}

export type CampaignAudience = {
  recipients: PatientRow[];
  /** True when more patients matched the filter than the cap allows. */
  capped: boolean;
  /** Rows dropped because pagination returned the same patient more than once. */
  duplicatePatientsRemoved: number;
  /** Rows dropped because another patient record shares the email address. */
  sharedAddressesRemoved: number;
};

/**
 * Resolve the definitive recipient list for a campaign.
 *
 * Use this for both previewing and sending, so the number shown to the user
 * is the number actually emailed. `fetchAudience` alone is not enough:
 *
 *  - it returns at most one page, so callers used to paginate by hand and
 *    crash on PGRST103 at the end of the data;
 *  - `MAX_CAMPAIGN_RECIPIENTS` capped the page, not the campaign, so paging
 *    past it silently blew through the cap the UI advertises;
 *  - one person can hold several patient records, and sending per-record
 *    delivers the same campaign to them repeatedly.
 */
export async function fetchCampaignAudience(
  supabase: SupabaseClient,
  filter: MarketingFilter | null | undefined,
  opts: { cap?: number } = {},
): Promise<CampaignAudience> {
  const cap = Math.max(
    1,
    Math.min(opts.cap ?? MAX_CAMPAIGN_RECIPIENTS, MAX_CAMPAIGN_RECIPIENTS),
  );
  const PAGE_SIZE = 1000;

  const recipients: PatientRow[] = [];
  const seenPatientIds = new Set<string>();
  const seenAddresses = new Set<string>();
  let duplicatePatientsRemoved = 0;
  let sharedAddressesRemoved = 0;
  let offset = 0;
  let reachedCap = false;

  while (!reachedCap) {
    const page = await fetchAudience(supabase, filter, { limit: PAGE_SIZE, offset });
    if (page.fetchedCount === 0) break;
    offset += page.fetchedCount;

    for (const row of page.rows) {
      if (recipients.length >= cap) {
        reachedCap = true;
        break;
      }
      if (seenPatientIds.has(row.id)) {
        duplicatePatientsRemoved += 1;
        continue;
      }
      seenPatientIds.add(row.id);

      const address = (row.email ?? "").trim().toLowerCase();
      if (address) {
        if (seenAddresses.has(address)) {
          sharedAddressesRemoved += 1;
          continue;
        }
        seenAddresses.add(address);
      }
      recipients.push(row);
    }

    if (!reachedCap && page.fetchedCount < PAGE_SIZE) break;
  }

  return { recipients, capped: reachedCap, duplicatePatientsRemoved, sharedAddressesRemoved };
}

/**
 * A Supabase `PostgrestError` is a plain object, not an `Error`, so the usual
 * `error instanceof Error ? error.message : "Unknown error"` throws away the
 * entire cause. Every database failure then reaches the user as
 * "Unknown error", which is undiagnosable from the UI.
 */
export function describeSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [e.message, e.details, e.hint].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    if (parts.length > 0) {
      return e.code ? `${parts.join(" — ")} (${e.code})` : parts.join(" — ");
    }
  }
  return "Unknown error";
}

/**
 * Substitute {{patient.first_name}} (and tolerant variants) in the given string
 * using values from the patient row.
 *
 * Accepts any of:
 *   {{patient.first_name}}   — canonical
 *   {patient.first_name}     — single-brace
 *   {patient.first_name}}    — mismatched (common typo)
 *   {{patient.first_name}    — mismatched (common typo)
 *   {{ patient.first_name }} — whitespace around key
 *
 * Also accepts a few aliases: {{first_name}}, {{firstName}}, {{name}}.
 *
 * Unknown variables are left as-is so the user sees something is missing
 * rather than silently getting an empty string.
 */
export function substitutePatientVariables(
  input: string,
  patient: PatientRow,
): string {
  if (!input) return "";
  const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  const vars: Record<string, string> = {
    "patient.first_name": patient.first_name ?? "",
    "patient.last_name": patient.last_name ?? "",
    "patient.full_name": fullName,
    "patient.name": fullName,
    "patient.email": patient.email ?? "",
    "patient.phone": patient.phone ?? "",
    // Friendly aliases
    "first_name": patient.first_name ?? "",
    "firstname": patient.first_name ?? "",
    "firstName": patient.first_name ?? "",
    "last_name": patient.last_name ?? "",
    "lastname": patient.last_name ?? "",
    "lastName": patient.last_name ?? "",
    "full_name": fullName,
    "fullname": fullName,
    "fullName": fullName,
    "name": fullName,
    "email": patient.email ?? "",
    "phone": patient.phone ?? "",
  };

  // Match ONE-OR-MORE opening braces, a variable key (letters/digits/_./space),
  // then ONE-OR-MORE closing braces. This tolerates `{x}`, `{{x}}`, `{x}}`, `{{x}`.
  return input.replace(/\{+\s*([a-zA-Z0-9_.]+)\s*\}+/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key];
    }
    return match;
  });
}
