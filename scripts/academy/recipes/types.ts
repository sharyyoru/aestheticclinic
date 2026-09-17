/**
 * Capture recipes describe, declaratively, how to walk one documentation
 * module's screens.
 *
 * Selector note: the app has no data-testid attributes, so targets are resolved
 * with resilient strategies in this order — testId, role+name, placeholder,
 * label, text, then raw CSS. `npm run academy:doctor` reports any that stop
 * resolving, which is the regression guard for UI label changes.
 */

export type Target =
  | { testId: string }
  | { role: "button" | "link" | "tab" | "textbox" | "combobox" | "heading"; name: string; exact?: boolean }
  | { placeholder: string }
  | { label: string }
  | { text: string; exact?: boolean }
  | { css: string };

export type CaptureStep =
  | { kind: "goto"; path: string; caption: string; waitFor?: Target; settleMs?: number }
  | { kind: "click"; target: Target; caption: string; optional?: boolean }
  | { kind: "fill"; target: Target; value: string; caption: string; optional?: boolean }
  | { kind: "hover"; target: Target; caption: string; optional?: boolean }
  | { kind: "press"; key: string; caption: string }
  | { kind: "shot"; name: string; alt: string; sectionId?: string; of?: Target }
  | { kind: "caption"; text: string; ms?: number }
  | { kind: "wait"; ms: number };

export type CaptureRecipe = {
  /** Must match a slug in the documentation registry. */
  docSlug: string;
  /** Human title used on the video's opening card. */
  title: string;
  /** Entry route. Supports :patientId, which is resolved from the capture DB. */
  route: string;
  /** False for concept modules with no single clickable flow. */
  video: boolean;
  /** Capture without signing in — used for login and patient-app screens. */
  loggedOut?: boolean;
  viewport?: { width: number; height: number };
  steps: CaptureStep[];
};

export function describeTarget(target: Target): string {
  if ("testId" in target) return `testId=${target.testId}`;
  if ("role" in target) return `role=${target.role}[name="${target.name}"]`;
  if ("placeholder" in target) return `placeholder="${target.placeholder}"`;
  if ("label" in target) return `label="${target.label}"`;
  if ("text" in target) return `text="${target.text}"`;
  return `css=${target.css}`;
}
