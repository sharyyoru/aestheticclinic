import { MODULES } from "../../../src/app/documentation/content";
import type { CaptureRecipe } from "./types";
import { gettingStartedRecipes } from "./getting-started";
import { coreRecordsRecipes } from "./core-records";
import { schedulingRecipes } from "./scheduling";
import { salesLeadsRecipes } from "./sales-leads";
import { billingRecipes } from "./billing";
import { communicationRecipes } from "./communication";
import { automationAiRecipes } from "./automation-ai";
import { analyticsRecipes } from "./analytics";
import { patientFacingRecipes } from "./patient-facing";
import { adminSetupRecipes } from "./admin-setup";

export const RECIPES: CaptureRecipe[] = [
  ...gettingStartedRecipes,
  ...coreRecordsRecipes,
  ...schedulingRecipes,
  ...salesLeadsRecipes,
  ...billingRecipes,
  ...communicationRecipes,
  ...automationAiRecipes,
  ...analyticsRecipes,
  ...patientFacingRecipes,
  ...adminSetupRecipes,
];

/**
 * Recipes and documentation must not drift. A doc module with no recipe would
 * silently produce a lesson with no media; a recipe with no doc module would
 * produce media nothing renders.
 */
export function assertRecipesMatchDocs(): void {
  const docSlugs = new Set(MODULES.map((m) => m.slug));
  const recipeSlugs = new Set(RECIPES.map((r) => r.docSlug));
  const problems: string[] = [];

  for (const recipe of RECIPES) {
    if (!docSlugs.has(recipe.docSlug)) {
      problems.push(`Recipe "${recipe.docSlug}" has no matching documentation module.`);
    }
  }
  for (const slug of docSlugs) {
    if (!recipeSlugs.has(slug)) {
      problems.push(`Documentation module "${slug}" has no capture recipe.`);
    }
  }

  const duplicates = RECIPES.map((r) => r.docSlug).filter(
    (slug, index, all) => all.indexOf(slug) !== index
  );
  for (const slug of new Set(duplicates)) {
    problems.push(`Duplicate recipe for "${slug}".`);
  }

  if (problems.length > 0) {
    throw new Error(`Recipe/documentation mismatch:\n  ${problems.join("\n  ")}`);
  }
}

export function getRecipe(docSlug: string): CaptureRecipe | undefined {
  return RECIPES.find((r) => r.docSlug === docSlug);
}
