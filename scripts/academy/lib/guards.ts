import { capture, production, projectRef } from "./env";

/**
 * Load-bearing safety checks. Screenshots and video are published to staff and
 * prospects, so they must never contain real patient data.
 *
 * Production cannot be captured safely: `invoices`, `services`, insurance
 * submissions and `leads` have no `is_demo` column and no RLS, and the patient
 * page plus 127 API routes render via the service-role key, which bypasses RLS
 * entirely. A physically separate database is the only mechanism that works.
 */

export function assertNotProduction(): void {
  const target = projectRef(capture.url);
  let prod: string | null = null;
  try {
    prod = projectRef(production.url);
  } catch {
    // No production env available (e.g. a clean checkout) — the ref check below
    // still runs against anything we do know.
  }

  if (prod && target === prod) {
    throw new Error(
      `REFUSING TO RUN: the capture target (${target}) is the production project.\n` +
        `Capturing production would render real patient data into published training material.`
    );
  }

  if (!prod) {
    console.warn(`[guard] Could not resolve the production ref; capture target is ${target}.`);
  } else {
    console.log(`[guard] Capture target ${target} is not production (${prod}). OK.`);
  }
}

/**
 * Second guard: the capture database must contain no non-demo patients. Catches
 * the case where someone points .env.capture at a restored copy of production.
 */
export async function assertNoRealPatients(): Promise<void> {
  const res = await fetch(
    `${capture.url}/rest/v1/patients?select=id&is_demo=eq.false&limit=1`,
    {
      headers: {
        apikey: capture.serviceKey,
        Authorization: `Bearer ${capture.serviceKey}`,
      },
    }
  );

  if (res.status === 404) {
    throw new Error(
      "REFUSING TO RUN: the capture database has no `patients` table. Run `npm run academy:provision` first."
    );
  }

  if (!res.ok) {
    throw new Error(`Could not verify the capture database is synthetic (HTTP ${res.status}).`);
  }

  const rows = (await res.json()) as unknown[];
  if (rows.length > 0) {
    throw new Error(
      "REFUSING TO RUN: the capture database contains patients with is_demo = false.\n" +
        "That means real data may be present. Capture aborted."
    );
  }

  console.log("[guard] Capture database contains only synthetic (is_demo) patients. OK.");
}
