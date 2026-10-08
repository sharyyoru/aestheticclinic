import { capture, production, projectRef } from "./env";

/**
 * Load-bearing safety checks.
 *
 * These used to refuse to run against production, because published training
 * media must not contain real patient data. That stance changed deliberately:
 * the isolated capture project was deleted, and the clinic accepted recording
 * real data on the basis that everyone who can open the Academy already has
 * access to it in the system.
 *
 * Two different protections now carry that weight, and both are enforced
 * rather than assumed:
 *
 *   1. `lib/readonly.ts` blocks every write in the browser, so a capture run
 *      cannot create, send or charge anything.
 *   2. Media is published to the PRIVATE `academy-media` bucket and served via
 *      short-lived signed URLs, so no recording is publicly addressable.
 *
 * `assertPrivateMediaBucket` is the one that must never be weakened. If that
 * bucket is ever made public, every recording of real patient data becomes
 * retrievable by anyone holding a URL.
 */

export function reportCaptureTarget(): void {
  const target = projectRef(capture.url);
  if (capture.isProduction) {
    console.log(
      `[guard] Capture target ${target} is PRODUCTION. Recordings will contain real patient data.`
    );
    console.log("[guard] Writes are blocked in-browser; media goes to the private bucket.");
    return;
  }
  console.log(`[guard] Capture target ${target} is not production (${projectRef(production.url)}).`);
}

/**
 * The bucket holding the recordings must be private. Checked before every
 * publish, because a bucket flipped to public silently turns 43 videos of real
 * patients into public URLs.
 */
export async function assertPrivateMediaBucket(bucket = "academy-media"): Promise<void> {
  const res = await fetch(`${production.url}/storage/v1/bucket/${bucket}`, {
    headers: {
      apikey: production.serviceKey,
      Authorization: `Bearer ${production.serviceKey}`,
    },
  });

  if (res.status === 404) {
    throw new Error(
      `REFUSING TO PUBLISH: the "${bucket}" bucket does not exist. Create it as a PRIVATE bucket first.`
    );
  }
  if (!res.ok) {
    throw new Error(`Could not verify the "${bucket}" bucket is private (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as { public?: boolean };
  if (body.public) {
    throw new Error(
      `REFUSING TO PUBLISH: the "${bucket}" bucket is PUBLIC.\n` +
        `These recordings contain real patient data and must only be reachable through ` +
        `short-lived signed URLs. Set the bucket to private and re-run.`
    );
  }

  console.log(`[guard] "${bucket}" is private. OK.`);
}

/**
 * Schema provisioning is a different matter from capture.
 *
 * Capture is read-only and may target production; applying DDL never may.
 * This guard stays absolute.
 */
export function assertNotProductionForDDL(): void {
  if (capture.isProduction) {
    throw new Error(
      `REFUSING TO RUN: provisioning would apply DDL to the production project ` +
        `(${projectRef(capture.url)}). Point CAPTURE_SUPABASE_URL at a throwaway project first.`
    );
  }
  console.log(`[guard] DDL target ${projectRef(capture.url)} is not production. OK.`);
}

/**
 * Capture must be able to sign in as a real staff user. Fail early with a
 * useful message rather than timing out on a login form.
 */
export function assertCaptureCredentials(): void {
  const missing: string[] = [];
  if (!capture.userEmail) missing.push("CAPTURE_USER_EMAIL");
  if (!capture.userPassword) missing.push("CAPTURE_USER_PASSWORD");
  if (!capture.appUrl) missing.push("CAPTURE_APP_URL");
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")} in .env.capture.`);
  }
}
