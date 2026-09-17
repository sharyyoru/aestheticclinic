// GENERATED FILE — do not edit by hand.
// Written by scripts/academy/5-sync.ts from the capture manifest.
// Screenshots come from the isolated capture project and contain only synthetic data.
//
// Empty until the capture pipeline has been run and published:
//   npm run academy:provision && npm run academy:all

export type GeneratedScreenshot = { src: string; alt: string; sectionId?: string };

export const GENERATED_SCREENSHOTS: Record<string, GeneratedScreenshot[]> = {};

export function screenshotsFor(docSlug: string, sectionId?: string): GeneratedScreenshot[] {
  const all = GENERATED_SCREENSHOTS[docSlug] ?? [];
  return sectionId ? all.filter((s) => s.sectionId === sectionId) : all;
}
