import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, BrowserContext } from "@playwright/test";
import { capture, projectRef } from "./env";
import { ensureOutDir } from "./manifest";

const STATE_PATH = resolve(ensureOutDir(), "storage-state.json");

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: unknown;
};

/**
 * Obtains a session once and reuses it for every recipe.
 *
 * Deliberately does NOT drive the login form. Playwright reliably wins the
 * race against React hydration, and the un-hydrated form submits natively as
 * a GET — which puts the account password into the URL, and therefore into
 * the server's request logs. Exchanging credentials for a token over the auth
 * API and injecting the session is both deterministic and keeps the password
 * out of any log.
 */
export async function signIn(browser: Browser): Promise<void> {
  const response = await fetch(`${capture.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: capture.anonKey },
    body: JSON.stringify({ email: capture.userEmail, password: capture.userPassword }),
  });

  if (!response.ok) {
    throw new Error(
      `Sign-in failed for ${capture.userEmail} (HTTP ${response.status}): ` +
        `${(await response.text()).slice(0, 200)}`
    );
  }

  const session = (await response.json()) as SupabaseSession;
  session.expires_at ??= Math.floor(Date.now() / 1000) + session.expires_in;

  // supabase-js v2 keeps the session in localStorage under sb-<ref>-auth-token.
  const storageKey = `sb-${projectRef(capture.url)}-auth-token`;

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  // The origin must be loaded before localStorage for it can be written.
  await page.goto(`${capture.appUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)] as const
  );

  await context.storageState({ path: STATE_PATH });
  await context.close();
}

export function hasStoredSession(): boolean {
  if (!existsSync(STATE_PATH)) return false;
  try {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
      cookies?: unknown[];
      origins?: unknown[];
    };
    return (state.cookies?.length ?? 0) > 0 || (state.origins?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function newSignedInContext(
  browser: Browser,
  viewport: { width: number; height: number }
): Promise<BrowserContext> {
  return browser.newContext({ storageState: STATE_PATH, viewport });
}

export async function newAnonymousContext(
  browser: Browser,
  viewport: { width: number; height: number }
): Promise<BrowserContext> {
  return browser.newContext({ viewport });
}

export { STATE_PATH };
