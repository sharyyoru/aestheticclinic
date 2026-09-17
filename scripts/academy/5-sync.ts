/**
 * Rebuilds the Academy from the documentation registry and the capture manifest,
 * and writes the screenshot map used by the public documentation pages.
 *
 *   10 documentation categories → 10 academy_modules
 *   50 documentation modules    → 50 academy_lessons
 *
 * Lesson slugs are the documentation slugs, so re-runs are idempotent upserts.
 * The 12 legacy hand-seeded modules are removed, and progress/certificates are
 * wiped as agreed — they referenced lessons whose content was partly invented.
 *
 * Run: npm run academy:sync
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATEGORIES, MODULES, getCategoryModules } from "../../src/app/documentation/content";
import { production, REPO_ROOT } from "./lib/env";
import { readManifest, type ManifestEntry } from "./lib/manifest";
import { estimateMinutes, lessonHtml } from "./lib/docsHtml";

const DOCS_URL = "/documentation";
const dryRun = process.argv.includes("--dry-run");

const headers = {
  apikey: production.serviceKey,
  Authorization: `Bearer ${production.serviceKey}`,
  "Content-Type": "application/json",
};

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${production.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res;
}

/** Maps documentation category icons onto the icon names the Academy card uses. */
const CATEGORY_ICONS: Record<string, string> = {
  "getting-started": "home",
  "core-records": "users",
  scheduling: "calendar",
  "sales-leads": "trending-up",
  billing: "credit-card",
  communication: "message-circle",
  "automation-ai": "sparkles",
  analytics: "bar-chart",
  "patient-facing": "heart",
  "admin-setup": "settings",
};

function writeScreenshotMap(entries: ManifestEntry[]): number {
  const map: Record<string, { src: string; alt: string; sectionId?: string }[]> = {};
  let count = 0;

  for (const entry of entries) {
    const published = entry.shots.filter((s) => s.publicUrl);
    if (published.length === 0) continue;
    map[entry.docSlug] = published.map((s) => ({
      src: s.publicUrl!,
      alt: s.alt,
      sectionId: s.sectionId,
    }));
    count += published.length;
  }

  const file = `// GENERATED FILE — do not edit by hand.
// Written by scripts/academy/5-sync.ts from the capture manifest.
// Screenshots come from the isolated capture project and contain only synthetic data.

export type GeneratedScreenshot = { src: string; alt: string; sectionId?: string };

export const GENERATED_SCREENSHOTS: Record<string, GeneratedScreenshot[]> = ${JSON.stringify(
    map,
    null,
    2
  )};

export function screenshotsFor(docSlug: string, sectionId?: string): GeneratedScreenshot[] {
  const all = GENERATED_SCREENSHOTS[docSlug] ?? [];
  return sectionId ? all.filter((s) => s.sectionId === sectionId) : all;
}
`;

  writeFileSync(
    resolve(REPO_ROOT, "src/app/documentation/content/screenshots.generated.ts"),
    file
  );
  return count;
}

/**
 * The academy_* tables are created by migrations/20260910_academy_tables.sql.
 * That migration has not necessarily been applied to production — at time of
 * writing it had not, so `/academy` rendered an empty module list and this sync
 * would fail with a confusing 404 partway through.
 */
async function assertAcademyTablesExist(): Promise<void> {
  const missing: string[] = [];
  for (const table of ["academy_modules", "academy_lessons", "academy_progress", "academy_certificates"]) {
    const res = await fetch(`${production.url}/rest/v1/${table}?select=count`, {
      headers: { apikey: production.serviceKey, Authorization: `Bearer ${production.serviceKey}` },
    });
    if (res.status === 404) missing.push(table);
  }
  if (missing.length > 0) {
    throw new Error(
      `These tables do not exist in the target project: ${missing.join(", ")}.\n` +
        `Apply migrations/20260910_academy_tables.sql (and ` +
        `migrations/20260917_academy_lesson_poster_url.sql) first.`
    );
  }
}

async function main() {
  const manifest = readManifest();
  await assertAcademyTablesExist();
  const byDocSlug = new Map(manifest.entries.map((e) => [e.docSlug, e]));

  console.log(`→ Syncing ${CATEGORIES.length} modules / ${MODULES.length} lessons`);
  if (dryRun) console.log("  (dry run — nothing will be written)");

  const shotCount = dryRun ? 0 : writeScreenshotMap(manifest.entries);
  if (!dryRun) console.log(`  Wrote screenshots.generated.ts (${shotCount} screenshots)`);

  if (dryRun) {
    for (const category of CATEGORIES) {
      const docs = getCategoryModules(category.id);
      console.log(`  ${category.title} — ${docs.length} lessons`);
    }
    return;
  }

  // Wipe progress and certificates first: they reference the legacy lessons.
  await rest("academy_progress?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE" });
  await rest("academy_certificates?id=neq.00000000-0000-0000-0000-000000000000", { method: "DELETE" });
  console.log("  Cleared academy_progress and academy_certificates");

  const keptSlugs = CATEGORIES.map((c) => c.id);
  const existing = await (await rest("academy_modules?select=id,slug")).json();
  const legacy = (existing as { id: string; slug: string }[]).filter(
    (m) => !keptSlugs.includes(m.slug)
  );
  for (const legacyModule of legacy) {
    // Lessons cascade on module delete.
    await rest(`academy_modules?id=eq.${legacyModule.id}`, { method: "DELETE" });
  }
  if (legacy.length) console.log(`  Removed ${legacy.length} legacy modules`);

  let lessonTotal = 0;

  for (const [index, category] of CATEGORIES.entries()) {
    const docs = getCategoryModules(category.id);
    if (docs.length === 0) continue;

    const lessons = docs.map((doc) => {
      const entry = byDocSlug.get(doc.slug);
      return {
        doc,
        entry,
        minutes: estimateMinutes(doc, entry?.video?.durationSeconds),
      };
    });

    const moduleMinutes = lessons.reduce((total, l) => total + l.minutes, 0);

    const upsert = await rest("academy_modules?on_conflict=slug", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          slug: category.id,
          title: category.title,
          description: category.description,
          icon: CATEGORY_ICONS[category.id] ?? "book",
          sort_order: index + 1,
          estimated_minutes: moduleMinutes,
          is_published: true,
        },
      ]),
    });
    const [moduleRow] = (await upsert.json()) as { id: string }[];

    const lessonRows = lessons.map(({ doc, entry, minutes }, lessonIndex) => ({
      module_id: moduleRow.id,
      slug: doc.slug,
      title: doc.title,
      content: lessonHtml(doc, entry?.shots ?? [], DOCS_URL),
      video_url: entry?.video?.publicUrl ?? null,
      poster_url: entry?.video?.posterUrl ?? null,
      sort_order: lessonIndex + 1,
      estimated_minutes: minutes,
    }));

    await rest("academy_lessons?on_conflict=module_id,slug", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(lessonRows),
    });

    lessonTotal += lessonRows.length;
    console.log(
      `  ${category.title.padEnd(24)} ${lessonRows.length} lessons, ${moduleMinutes} min, ` +
        `${lessonRows.filter((l) => l.video_url).length} with video`
    );
  }

  console.log(`\n${CATEGORIES.length} modules and ${lessonTotal} lessons synced.`);
}

main().catch((error) => {
  console.error(`\nSync failed: ${(error as Error).message}`);
  process.exit(1);
});
