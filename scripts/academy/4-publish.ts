/**
 * Uploads the captured media to a public Supabase Storage bucket in the
 * PRODUCTION project (that is where the Academy and the documentation read from)
 * and records the public URLs in the manifest.
 *
 * The media itself is synthetic — it comes from the isolated capture project.
 *
 * Run: npm run academy:publish
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { production } from "./lib/env";
import { readManifest, writeManifest } from "./lib/manifest";

const BUCKET = "academy-media";

async function ensureBucket(): Promise<void> {
  const list = await fetch(`${production.url}/storage/v1/bucket`, {
    headers: { apikey: production.serviceKey, Authorization: `Bearer ${production.serviceKey}` },
  });
  const buckets = (await list.json()) as { id: string; public: boolean }[];
  const existing = Array.isArray(buckets) ? buckets.find((b) => b.id === BUCKET) : undefined;

  if (existing) {
    if (!existing.public) {
      await fetch(`${production.url}/storage/v1/bucket/${BUCKET}`, {
        method: "PUT",
        headers: {
          apikey: production.serviceKey,
          Authorization: `Bearer ${production.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public: true }),
      });
      console.log(`  bucket ${BUCKET} switched to public`);
    } else {
      console.log(`  bucket ${BUCKET} already exists`);
    }
    return;
  }

  const res = await fetch(`${production.url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: production.serviceKey,
      Authorization: `Bearer ${production.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: 52428800,
      allowed_mime_types: ["image/png", "image/jpeg", "image/webp", "video/mp4"],
    }),
  });
  if (!res.ok) throw new Error(`Could not create the bucket: ${await res.text()}`);
  console.log(`  bucket ${BUCKET} created`);
}

function contentType(path: string): string {
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

async function upload(localPath: string, objectPath: string): Promise<string> {
  const body = readFileSync(localPath);
  const res = await fetch(`${production.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: production.serviceKey,
      Authorization: `Bearer ${production.serviceKey}`,
      "Content-Type": contentType(localPath),
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) throw new Error(`Upload of ${objectPath} failed: ${await res.text()}`);
  return `${production.url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
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

    console.log(`  ${entry.docSlug}`);
  }

  writeManifest(manifest);
  console.log(`\n${files} files published.`);
}

main().catch((error) => {
  console.error(`\nPublish failed: ${(error as Error).message}`);
  process.exit(1);
});
