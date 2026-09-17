/**
 * Assert-only health check: walks every recipe, verifies each route loads and
 * each selector still resolves, and produces no media.
 *
 * This is the regression guard for the fact that the app has no data-testid
 * attributes — a renamed button would otherwise break a recipe silently, and you
 * would only find out during a full capture run.
 *
 * Run: npm run academy:doctor
 */
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { capture } from "./lib/env";
import { assertNotProduction } from "./lib/guards";
import { RECIPES, assertRecipesMatchDocs } from "./recipes";
import { describeTarget, type Target } from "./recipes/types";
import { locateOne } from "./lib/targets";
import { signIn, hasStoredSession } from "./lib/auth";
import { ensureOutDir } from "./lib/manifest";

async function main() {
  assertNotProduction();
  assertRecipesMatchDocs();
  console.log(`→ Checking ${RECIPES.length} recipes against ${capture.appUrl}\n`);

  const browser = await chromium.launch();
  if (!hasStoredSession()) await signIn(browser);

  let okCount = 0;
  const problems: string[] = [];

  for (const recipe of RECIPES) {
    const viewport = recipe.viewport ?? { width: 1440, height: 900 };
    const context = recipe.loggedOut
      ? await browser.newContext({ viewport })
      : await browser.newContext({
          storageState: resolve(ensureOutDir(), "storage-state.json"),
          viewport,
        });
    const page = await context.newPage();
    const recipeProblems: string[] = [];

    for (const step of recipe.steps) {
      if (step.kind === "goto") {
        let path = step.path;
        if (path.includes(":patientId")) {
          const res = await fetch(
            `${capture.url}/rest/v1/patients?select=id&is_demo=eq.true&limit=1`,
            { headers: { apikey: capture.serviceKey, Authorization: `Bearer ${capture.serviceKey}` } }
          );
          const rows = (await res.json().catch(() => [])) as { id: string }[];
          if (!rows?.[0]?.id) {
            recipeProblems.push("no demo patient available for :patientId");
            continue;
          }
          path = path.replace(":patientId", rows[0].id);
        }
        const response = await page
          .goto(`${capture.appUrl}${path}`, { waitUntil: "domcontentloaded" })
          .catch(() => null);
        if (!response || response.status() >= 400) {
          recipeProblems.push(`route ${path} → ${response ? response.status() : "no response"}`);
          continue;
        }
        await page.waitForLoadState("networkidle").catch(() => undefined);
      }

      const target: Target | undefined =
        step.kind === "goto"
          ? step.waitFor
          : "target" in step
            ? (step.target as Target)
            : step.kind === "shot"
              ? step.of
              : undefined;

      if (!target) continue;

      const visible = await locateOne(page, target)
        .waitFor({ state: "visible", timeout: 6000 })
        .then(() => true)
        .catch(() => false);

      if (!visible) {
        const optional = "optional" in step && step.optional === true;
        recipeProblems.push(`${optional ? "optional " : ""}${describeTarget(target)} not found`);
      }
    }

    await context.close();

    const hard = recipeProblems.filter((p) => !p.startsWith("optional"));
    if (hard.length === 0) {
      okCount += 1;
      console.log(`  ok      ${recipe.docSlug}`);
    } else {
      console.log(`  FAIL    ${recipe.docSlug}`);
      problems.push(...hard.map((p) => `${recipe.docSlug}: ${p}`));
    }
    for (const problem of recipeProblems) console.log(`            ${problem}`);
  }

  await browser.close();

  console.log(`\n${okCount}/${RECIPES.length} recipes resolve cleanly.`);
  if (problems.length > 0) {
    console.log(`\n${problems.length} problems:`);
    for (const problem of problems) console.log(`  ${problem}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\nDoctor failed: ${(error as Error).message}`);
  process.exit(1);
});
