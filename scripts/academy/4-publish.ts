/**
 * Uploads the captured media to a PRIVATE Supabase Storage bucket in the
 * production project and records the object PATHS in the manifest.
 *
 * Paths, not URLs: the recordings are made against production and contain
 * real patient data, so nothing may be publicly addressable. The Academy
 * lesson page mints a short-lived signed URL per render instead
 * (src/lib/academy/media.ts).
 *
 * An earlier version of this script force-switched the bucket to public,
 * which would now quietly expose every recording. It refuses instead.
 *
 * Run: npm run academy:publish
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { production } from "./lib/env";
import { assertPrivateMediaBucket } from "./lib/guards";
import { readManifest, writeManifest } from "./lib/manifest";

const BUCKET = "academy-media";

async function ensureBucket(): Promise<void> {
  // Refuses if the bucket is missing or public. Creating it is a deliberate,
  // one-off act so nobody accidentally recreates it with the wrong visibility.
  await assertPrivateMediaBucket(BUCKET);
}

function contentType(path: string): string {
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".vtt")) return "text/vtt";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

/**
 * Uploads and returns the object PATH inside the bucket.
 *
 * Returning a path rather than a URL is the whole point: a public URL to a
 * recording of real patients would be retrievable by anyone holding it. The
 * Academy signs these paths at render time.
 */
async function upload(localPath: string, objectPath: string): Promise<string> {
  const body = readFileSync(localPath);
  const res = await fetch(`${production.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: production.serviceKey,
      Authorization: `Bearer ${production.serviceKey}`,
      "Content-Type": contentType(localPath),
      // Private objects, so caching is the signed URL's business, not a CDN's.
      "Cache-Control": "max-age=3600",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) throw new Error(`Upload of ${objectPath} failed: ${await res.text()}`);
  return objectPath;
}

/** Content hash in the filename, so a re-run busts caches instead of serving stale media. */
function hashed(localPath: string, objectPath: string): string {
  const hash = createHash("sha1").update(readFileSync(localPath)).digest("hex").slice(0, 8);
  const dot = objectPath.lastIndexOf(".");
  return `${objectPath.slice(0, dot)}.${hash}${objectPath.slice(dot)}`;
}

async function main() {
  const manifest = readManifest();
  console.log(`→ Publishing to ${BUCKET} in the production project`);
  await ensureBucket();

  let files = 0;

  for (const entry of manifest.entries) {
    for (const shot of entry.shots) {
      if (!existsSync(shot.localPath)) continue;
      const objectPath = hashed(shot.localPath, `screenshots/${entry.docSlug}/${shot.name}.png`);
      shot.publicUrl = await upload(shot.localPath, objectPath);
      files += 1;
    }

    if (entry.video?.localMp4 && existsSync(entry.video.localMp4)) {
      const objectPath = hashed(entry.video.localMp4, `video/${entry.docSlug}.mp4`);
      entry.video.publicUrl = await upload(entry.video.localMp4, objectPath);
      files += 1;
    }
    if (entry.video?.localPoster && existsSync(entry.video.localPoster)) {
      const objectPath = hashed(entry.video.localPoster, `poster/${entry.docSlug}.jpg`);
      entry.video.posterUrl = await upload(entry.video.localPoster, objectPath);
      files += 1;
    }
    if (entry.video?.localCaptions && existsSync(entry.video.localCaptions)) {
      const objectPath = hashed(entry.video.localCaptions, `captions/${entry.docSlug}.vtt`);
      entry.video.captionsUrl = await upload(entry.video.localCaptions, objectPath);
      files += 1;
    }

    console.log(`  ${entry.docSlug}`);
  }

  writeManifest(manifest);
  console.log(`\n${files} files published.`);
}

main().catch((error) => {
  console.error(`\nPublish failed: ${(error as Error).message}`);
  process.exit(1);
});
