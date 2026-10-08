/**
 * Attaches captured media to the Academy lessons that already exist.
 *
 * This script used to rebuild the Academy from the documentation registry:
 * it deleted every module whose slug was not a documentation category, which
 * cascaded to the lessons. Against today's database that is all 12 modules
 * and all 43 lessons, including their hand-written content. The Academy is
 * now the source of truth and this only ever UPDATES media columns on rows
 * matched by slug. It never inserts, never deletes, and never touches
 * titles, content, module structure, progress or certificates.
 *
 * Run: npm run academy:sync [-- --dry-run]
 */
import { production } from "./lib/env";
import { readManifest } from "./lib/manifest";

const dryRun = process.argv.includes("--dry-run");

type LessonRow = {
  id: string;
  slug: string;
  title: string;
  video_url: string | null;
  poster_url: string | null;
  captions_url: string | null;
  video_duration_seconds: number | null;
};

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${production.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: production.serviceKey,
      Authorization: `Bearer ${production.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res;
}

async function main() {
  const manifest = readManifest();
  const lessons = (await (
    await rest("academy_lessons?select=id,slug,title,video_url,poster_url,captions_url,video_duration_seconds")
  ).json()) as LessonRow[];

  const bySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
  console.log(`→ ${lessons.length} lessons in the Academy, ${manifest.entries.length} captured`);
  if (dryRun) console.log("  (dry run — nothing will be written)\n");

  // A manifest entry with no matching lesson means the recipe and the Academy
  // have drifted. Fail rather than silently producing media nothing renders.
  const orphans = manifest.entries
    .map((entry) => entry.docSlug)
    .filter((slug) => !bySlug.has(slug));
  if (orphans.length > 0) {
    throw new Error(
      `No Academy lesson matches: ${orphans.join(", ")}.\n` +
        `Recipes are keyed by lesson slug; run academy:doctor to see the drift.`
    );
  }

  let updated = 0;
  let unchanged = 0;

  for (const entry of manifest.entries) {
    const lesson = bySlug.get(entry.docSlug);
    if (!lesson) continue;

    // Keep whatever is already published when this run produced nothing for a
    // field. A partial capture (one failed recipe, or --only) must not blank
    // media that is live and working.
    const next = {
      video_url: entry.video?.publicUrl ?? lesson.video_url,
      poster_url: entry.video?.posterUrl ?? lesson.poster_url,
      captions_url: entry.video?.captionsUrl ?? lesson.captions_url,
      video_duration_seconds: entry.video?.durationSeconds ?? lesson.video_duration_seconds,
    };

    const changed =
      next.video_url !== lesson.video_url ||
      next.poster_url !== lesson.poster_url ||
      next.captions_url !== lesson.captions_url ||
      next.video_duration_seconds !== lesson.video_duration_seconds;

    if (!changed) {
      unchanged += 1;
      continue;
    }

    console.log(
      `  ${lesson.slug.padEnd(24)} video:${lesson.video_url ? "yes" : "no "} -> ${next.video_url ? "yes" : "no "}` +
        `  ${next.video_duration_seconds ?? "?"}s`
    );

    if (!dryRun) {
      await rest(`academy_lessons?id=eq.${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
    }
    updated += 1;
  }

  const withVideo = manifest.entries.filter((entry) => entry.video?.publicUrl).length;
  console.log(
    `\n${dryRun ? "Would update" : "Updated"} ${updated} lesson(s), ${unchanged} already current. ` +
      `${withVideo} of ${lessons.length} lessons have video.`
  );
}

main().catch((error) => {
  console.error(`\nSync failed: ${(error as Error).message}`);
  process.exit(1);
});
