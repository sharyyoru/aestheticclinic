/**
 * Drives the real UI against the isolated capture project and records
 * screenshots plus silent, caption-narrated screen recordings.
 *
 * Run: npm run academy:capture
 */
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { rmSync, existsSync, renameSync } from "node:fs";
import { capture, projectRef } from "./lib/env";
import { assertNotProduction, assertNoRealPatients } from "./lib/guards";
import { RECIPES, assertRecipesMatchDocs } from "./recipes";
import type { CaptureRecipe, CaptureStep } from "./recipes/types";
import { describeTarget } from "./recipes/types";
import { locateOne } from "./lib/targets";
import { dwellFor, hideCaption, installOverlay, showCaption, showCard, withoutOverlay } from "./lib/captions";
import { signIn, hasStoredSession } from "./lib/auth";
import {
  ensureOutDir,
  writeManifest,
  type Manifest,
  type ManifestEntry,
  type ManifestShot,
} from "./lib/manifest";

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

/** Resolves :patientId from the capture database so patient recipes work. */
async function resolvePlaceholders(path: string): Promise<string> {
  if (!path.includes(":patientId")) return path;
  const res = await fetch(
    `${capture.url}/rest/v1/patients?select=id&is_demo=eq.true&order=created_at.asc&limit=1`,
    { headers: { apikey: capture.serviceKey, Authorization: `Bearer ${capture.serviceKey}` } }
  );
  const rows = (await res.json()) as { id: string }[];
  if (!rows?.[0]?.id) throw new Error("No demo patient found — run academy:provision first.");
  return path.replace(":patientId", rows[0].id);
}

async function runStep(
  page: Page,
  step: CaptureStep,
  ctx: { recipe: CaptureRecipe; shots: ManifestShot[]; failures: string[]; index: number; total: number }
): Promise<void> {
  switch (step.kind) {
    case "goto": {
      const path = await resolvePlaceholders(step.path);
      await page.goto(`${capture.appUrl}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await installOverlay(page);
      if (step.waitFor) {
        await locateOne(page, step.waitFor)
          .waitFor({ state: "visible", timeout: 20_000 })
          .catch(() => ctx.failures.push(`waitFor ${describeTarget(step.waitFor!)} on ${path}`));
      }
      if (step.settleMs) await page.waitForTimeout(step.settleMs);
      await showCaption(page, step.caption, { index: ctx.index, total: ctx.total });
      await page.waitForTimeout(dwellFor(step.caption));
      return;
    }
    case "click": {
      await showCaption(page, step.caption, { index: ctx.index, total: ctx.total });
      await page.waitForTimeout(dwellFor(step.caption));
      try {
        await locateOne(page, step.target).click({ timeout: 8000 });
        await page.waitForTimeout(800);
      } catch (error) {
        const message = `click ${describeTarget(step.target)}: ${(error as Error).message.split("\n")[0]}`;
        if (!step.optional) ctx.failures.push(message);
        else ctx.failures.push(`optional ${message}`);
      }
      return;
    }
    case "fill": {
      await showCaption(page, step.caption, { index: ctx.index, total: ctx.total });
      try {
        await locateOne(page, step.target).fill(step.value, { timeout: 8000 });
        await page.waitForTimeout(600);
      } catch (error) {
        const message = `fill ${describeTarget(step.target)}: ${(error as Error).message.split("\n")[0]}`;
        ctx.failures.push(step.optional ? `optional ${message}` : message);
      }
      await page.waitForTimeout(dwellFor(step.caption));
      return;
    }
    case "hover": {
      await showCaption(page, step.caption, { index: ctx.index, total: ctx.total });
      try {
        await locateOne(page, step.target).hover({ timeout: 8000 });
      } catch (error) {
        ctx.failures.push(`hover ${describeTarget(step.target)}: ${(error as Error).message.split("\n")[0]}`);
      }
      await page.waitForTimeout(dwellFor(step.caption));
      return;
    }
    case "press": {
      await showCaption(page, step.caption, { index: ctx.index, total: ctx.total });
      await page.keyboard.press(step.key);
      await page.waitForTimeout(600);
      return;
    }
    case "caption": {
      await showCaption(page, step.text, { index: ctx.index, total: ctx.total });
      await page.waitForTimeout(step.ms ?? dwellFor(step.text));
      return;
    }
    case "wait": {
      await page.waitForTimeout(step.ms);
      return;
    }
    case "shot": {
      const dir = ensureOutDir("screenshots", ctx.recipe.docSlug);
      const localPath = resolve(dir, `${step.name}.png`);
      await withoutOverlay(page, async () => {
        if (step.of) {
          await locateOne(page, step.of)
            .screenshot({ path: localPath })
            .catch(async () => {
              await page.screenshot({ path: localPath });
            });
        } else {
          await page.screenshot({ path: localPath });
        }
      });
      ctx.shots.push({
        name: step.name,
        alt: step.alt,
        sectionId: step.sectionId,
        localPath,
      });
      return;
    }
  }
}

async function captureRecipe(
  context: BrowserContext,
  recipe: CaptureRecipe,
  recordVideo: boolean
): Promise<ManifestEntry> {
  const page = await context.newPage();
  const shots: ManifestShot[] = [];
  const failures: string[] = [];
  const started = Date.now();

  const captionSteps = recipe.steps.filter((s) =>
    ["goto", "click", "fill", "hover", "press", "caption"].includes(s.kind)
  ).length;

  try {
    // Opening card needs a page to draw on, so navigate first.
    const first = recipe.steps.find((s) => s.kind === "goto") as
      | Extract<CaptureStep, { kind: "goto" }>
      | undefined;
    if (first) {
      const path = await resolvePlaceholders(first.path);
      await page.goto(`${capture.appUrl}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await installOverlay(page);
      if (recordVideo) await showCard(page, recipe.title, "Aliice Academy");
    }

    let index = 0;
    for (const step of recipe.steps) {
      if (["goto", "click", "fill", "hover", "press", "caption"].includes(step.kind)) index += 1;
      await runStep(page, step, { recipe, shots, failures, index, total: captionSteps });
    }

    if (recordVideo) {
      await hideCaption(page);
      await showCard(page, "Full reference in the documentation", recipe.title, 2400);
    }
  } catch (error) {
    failures.push(`fatal: ${(error as Error).message.split("\n")[0]}`);
    const dir = ensureOutDir("failures");
    await page.screenshot({ path: resolve(dir, `${recipe.docSlug}.png`) }).catch(() => undefined);
  }

  const durationSeconds = Math.round((Date.now() - started) / 1000);
  const videoHandle = recordVideo ? page.video() : null;
  await page.close();

  let localWebm: string | undefined;
  if (videoHandle) {
    const target = resolve(ensureOutDir("video"), `${recipe.docSlug}.webm`);
    try {
      if (existsSync(target)) rmSync(target);
      const original = await videoHandle.path();
      renameSync(original, target);
      localWebm = target;
    } catch {
      const saved = await videoHandle.saveAs(target).then(() => target).catch(() => undefined);
      localWebm = saved;
    }
  }

  return {
    docSlug: recipe.docSlug,
    route: recipe.route,
    shots,
    video: recordVideo
      ? { localWebm, durationSeconds, stepCount: captionSteps }
      : undefined,
    failures,
    capturedAt: new Date().toISOString(),
  };
}

async function main() {
  assertNotProduction();
  await assertNoRealPatients();
  assertRecipesMatchDocs();

  const recipes = only ? RECIPES.filter((r) => r.docSlug === only) : RECIPES;
  if (recipes.length === 0) throw new Error(`No recipe matches --only=${only}`);

  console.log(`→ Capturing ${recipes.length} recipe(s) against ${capture.appUrl}`);

  const browser = await chromium.launch();

  if (!hasStoredSession()) {
    console.log("→ Signing in…");
    await signIn(browser);
  }

  const entries: ManifestEntry[] = [];

  for (const recipe of recipes) {
    const viewport = recipe.viewport ?? DEFAULT_VIEWPORT;
    const videoDir = ensureOutDir("video-raw");
    const options = recipe.video ? { recordVideo: { dir: videoDir, size: viewport } } : {};

    const context = recipe.loggedOut
      ? await browser.newContext({ viewport, ...options })
      : await browser.newContext({
          storageState: resolve(ensureOutDir(), "storage-state.json"),
          viewport,
          ...options,
        });

    process.stdout.write(`  ${recipe.docSlug.padEnd(28)}`);
    const entry = await captureRecipe(context, recipe, recipe.video);
    await context.close();
    entries.push(entry);

    const status = entry.failures.filter((f) => !f.startsWith("optional")).length === 0 ? "ok" : "issues";
    console.log(
      `${String(entry.shots.length).padStart(2)} shots  ${entry.video ? "video" : "     "}  ${status}`
    );
    for (const failure of entry.failures) console.log(`      ! ${failure}`);
  }

  await browser.close();

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    captureProjectRef: projectRef(capture.url),
    entries,
  };
  writeManifest(manifest);

  const hardFailures = entries.flatMap((e) => e.failures.filter((f) => !f.startsWith("optional")));
  console.log(
    `\n${entries.length} recipes, ${entries.reduce((n, e) => n + e.shots.length, 0)} screenshots, ` +
      `${entries.filter((e) => e.video?.localWebm).length} videos, ${hardFailures.length} failures.`
  );
  console.log("\nREVIEW THE OUTPUT FOR REAL DATA BEFORE PUBLISHING.");

  if (hardFailures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`\nCapture failed: ${(error as Error).message}`);
  process.exit(1);
});
