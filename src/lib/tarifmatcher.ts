/**
 * Client for the OAAT TarifMatcher service (tarifmatcher-server/).
 *
 * The ambulatory flat-rate grouper — gestures + ICD-10 -> flat rate — is a
 * Java library, and Vercel's Node runtime has no JVM, so it runs as its own
 * service the way the WhatsApp server does. Without TARIFMATCHER_URL the
 * caller keeps the previous honest refusal rather than guessing a flat rate.
 */

export type GrouperCase = {
  services: string[];
  diagnoses: string[];
  ageYears?: number;
  caseId?: string;
  /** Selects the tariff year on the service side. */
  serviceDate?: string;
};

export type GrouperResult = {
  flatRate: string | null;
  costWeight: number | null;
  mappedTardocs: string[];
  applicationYear: number;
  warnings: string[];
};

export function tarifmatcherConfigured(): boolean {
  return !!process.env.TARIFMATCHER_URL;
}

/**
 * Tariff years the service has loaded. A treatment is grouped with the tariff
 * in force on its own service date — pricing 2026 work with the 2027 system
 * gives the wrong flat rate. The service owns the actual selection and
 * refuses a year it has no bundle for; this is only the lower bound, so the
 * app never sends a date that cannot possibly be grouped.
 */
export const TARIFMATCHER_APPLICATION_YEAR = 2026;

export function appliesTo(serviceDate: string | undefined | null): boolean {
  if (!serviceDate) return false;
  const year = new Date(serviceDate).getFullYear();
  return Number.isFinite(year) && year >= TARIFMATCHER_APPLICATION_YEAR;
}

export async function runTarifmatcher(input: GrouperCase): Promise<GrouperResult> {
  const base = process.env.TARIFMATCHER_URL;
  if (!base) throw new Error("TARIFMATCHER_URL is not set");

  const secret = process.env.TARIFMATCHER_SECRET;
  const response = await fetch(`${base.replace(/\/$/, "")}/group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-tarifmatcher-secret": secret } : {}),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  let json: {
    ok?: boolean;
    error?: string;
    applicationYear?: number;
    warnings?: string[];
    results?: Array<{ flatRate?: string | null; costWeight?: number | null; mappedTardocs?: string[] }>;
  } = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`TarifMatcher returned a non-JSON response (HTTP ${response.status})`);
  }
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || `TarifMatcher failed (HTTP ${response.status})`);
  }

  const first = json.results?.[0];
  return {
    flatRate: first?.flatRate ?? null,
    costWeight: first?.costWeight ?? null,
    mappedTardocs: first?.mappedTardocs ?? [],
    applicationYear: json.applicationYear ?? TARIFMATCHER_APPLICATION_YEAR,
    warnings: json.warnings ?? [],
  };
}
