import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, BrowserContext } from "@playwright/test";
import { capture } from "./env";
import { ensureOutDir } from "./manifest";

const STATE_PATH = resolve(ensureOutDir(), "storage-state.json");

/**
 * Signs in through the real UI once and reuses the session for every recipe.
 * The account exists only on the isolated capture project.
 */
export async function signIn(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${capture.appUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(capture.userEmail);
  await page.getByLabel("Password").fill(capture.userPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The app navigates with window.location, so wait for the dashboard rather
  // than a client-side route change.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);

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
