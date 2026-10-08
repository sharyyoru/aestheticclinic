import type { BrowserContext, Request, Route } from "@playwright/test";

/**
 * Makes a capture run physically incapable of changing production.
 *
 * Capture records the live clinic, so recipe discipline is not enough: one
 * stray click on "Save" would create a patient, and one on "Send" would email
 * a real person something that cannot be recalled. Every write is therefore
 * blocked in the browser itself, and the run fails if a recipe depended on
 * one — so a recipe can never quietly rely on mutating production.
 *
 * This is the guarantee that replaced "capture a separate database".
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Sign-in is the one write a capture run legitimately performs: Supabase
 * issues a session with POST /auth/v1/token. Nothing else is exempt.
 */
const AUTH_ALLOWLIST = [/\/auth\/v1\/token/, /\/auth\/v1\/user$/];

/**
 * Endpoints blocked regardless of method, because even a GET to them has a
 * real-world effect — sending, dialling or charging.
 *
 * Deliberately narrow. An earlier version blocked whole namespaces like
 * /api/whatsapp/, which also killed `GET /api/whatsapp/queue?countOnly=true`
 * — a plain read behind an unread-count badge. That would have filmed the UI
 * in a broken state, so these patterns name specific actions, and the method
 * check above is what covers the rest.
 */
const ALWAYS_BLOCKED = [
  /\/api\/emails\/send\b/,
  /\/api\/whatsapp\/send\b/,
  /\/api\/sms\/send\b/,
  /\/api\/marketing\/campaigns\/send\b/,
  /\/api\/forms\/submit\b/,
  /\/api\/invoices\/send-email\b/,
  /\/api\/retell\//,
  /\/api\/cron\//,
  /\/api\/payrexx\//,
  /api\.mailgun\.net/,
  /api\.eu\.mailgun\.net/,
  /api\.twilio\.com/,
];

export type ReadOnlyReport = {
  blocked: Array<{ method: string; url: string; reason: string }>;
};

function isAllowedAuth(url: string): boolean {
  return AUTH_ALLOWLIST.some((pattern) => pattern.test(url));
}

function blockReason(request: Request): string | null {
  const url = request.url();
  const method = request.method().toUpperCase();

  if (ALWAYS_BLOCKED.some((pattern) => pattern.test(url))) {
    return "side-effecting endpoint";
  }
  if (SAFE_METHODS.has(method)) return null;
  if (isAllowedAuth(url)) return null;

  return `${method} request`;
}

/**
 * Install before the first navigation. Returns a report the caller must check:
 * a non-empty `blocked` list means a recipe tried to write, which is a bug in
 * the recipe, not something to tolerate.
 */
export function installReadOnlyGuard(context: BrowserContext): ReadOnlyReport {
  const report: ReadOnlyReport = { blocked: [] };

  void context.route("**/*", async (route: Route, request: Request) => {
    const reason = blockReason(request);
    if (!reason) {
      await route.continue();
      return;
    }

    report.blocked.push({ method: request.method(), url: request.url(), reason });
    console.error(`  [read-only] BLOCKED ${request.method()} ${request.url()} (${reason})`);
    // Abort rather than fulfil: a fake 200 could leave the UI showing a
    // success state that never happened, which would then be filmed.
    await route.abort("blockedbyclient");
  });

  return report;
}

/** Throw if anything was blocked, naming the recipe so it can be fixed. */
export function assertNothingBlocked(report: ReadOnlyReport, lessonSlug: string): void {
  if (report.blocked.length === 0) return;

  const lines = report.blocked
    .slice(0, 10)
    .map((entry) => `    ${entry.method} ${entry.url} (${entry.reason})`)
    .join("\n");

  throw new Error(
    `Recipe "${lessonSlug}" attempted ${report.blocked.length} write(s) against production:\n${lines}\n` +
      `Capture is strictly read-only. Rewrite the recipe to stop before the submit, and let the ` +
      `narration describe the final action instead.`
  );
}

/**
 * Static check used by academy:doctor. Catches steps that would obviously
 * submit, before a run ever opens a browser.
 */
const SUBMIT_LIKE = /\b(save|submit|send|create|delete|remove|confirm|pay|charge|issue|book|archive|publish|enregistrer|envoyer|supprimer|cr[ée]er|valider)\b/i;

export function describesSubmit(accessibleName: string): boolean {
  return SUBMIT_LIKE.test(accessibleName);
}
