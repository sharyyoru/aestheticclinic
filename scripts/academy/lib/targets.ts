import type { Locator, Page } from "@playwright/test";
import type { Target } from "../recipes/types";

/**
 * Resolves a recipe target to a locator. The app has no data-testid attributes
 * yet, so most recipes fall back to role/text strategies — which is exactly why
 * `academy:doctor` exists.
 */
export function locate(page: Page, target: Target): Locator {
  if ("testId" in target) return page.getByTestId(target.testId);
  if ("role" in target) {
    return page.getByRole(target.role, { name: target.name, exact: target.exact ?? false });
  }
  if ("placeholder" in target) return page.getByPlaceholder(target.placeholder);
  if ("label" in target) return page.getByLabel(target.label);
  if ("text" in target) return page.getByText(target.text, { exact: target.exact ?? false });
  return page.locator(target.css);
}

/** First match, since several screens legitimately repeat a label. */
export function locateOne(page: Page, target: Target): Locator {
  return locate(page, target).first();
}
