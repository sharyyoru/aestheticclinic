/**
 * Converts the raw Playwright webm recordings to browser-friendly mp4, extracts
 * a poster frame, and optimises the screenshots.
 *
 * Run: npm run academy:encode
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { ensureOutDir, readManifest, writeManifest } from "./lib/manifest";

const FFMPEG = ffmpegPath as unknown as string;

function run(args: string[]): void {
  execFileSync(FFMPEG, args, { stdio: "pipe" });
}

async function main() {
  if (!FFMPEG || !existsSync(FFMPEG)) {
    throw new Error("ffmpeg-static did not provide a binary. Re-run npm install.");
  }

  const manifest = readManifest();
  const mp4Dir = ensureOutDir("mp4");
  const posterDir = ensureOutDir("poster");

  let encoded = 0;
  let posters = 0;
  let optimised = 0;

  for (const entry of manifest.entries) {
    if (entry.video?.localWebm && existsSync(entry.video.localWebm)) {
      const mp4 = resolve(mp4Dir, `${entry.docSlug}.mp4`);
      // No audio track (captions carry the narration). faststart lets the video
      // begin playing before it has fully downloaded.
      run([
        "-y",
        "-i",
        entry.video.localWebm,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        // H.264 requires even dimensions.
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-movflags",
        "+faststart",
        mp4,
      ]);
      entry.video.localMp4 = mp4;
      encoded += 1;

      // Poster is taken after the opening card so it shows real UI.
      const poster = resolve(posterDir, `${entry.docSlug}.jpg`);
      try {
        run(["-y", "-ss", "3", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
        entry.video.localPoster = poster;
        posters += 1;
      } catch {
        console.warn(`  ! could not extract a poster for ${entry.docSlug}`);
      }

      const sizeMb = statSync(mp4).size / 1024 / 1024;
      console.log(
        `  ${entry.docSlug.padEnd(28)} ${sizeMb.toFixed(1)} MB  ${entry.video.durationSeconds ?? "?"}s`
      );
    }

    for (const shot of entry.shots) {
      if (!existsSync(shot.localPath)) continue;
      const before = statSync(shot.localPath).size;
      const buffer = await sharp(shot.localPath).png({ compressionLevel: 9, palette: true }).toBuffer();
      if (buffer.length < before) {
        await sharp(buffer).toFile(shot.localPath);
        optimised += 1;
      }
    }
  }

  writeManifest(manifest);
  console.log(`\n${encoded} videos encoded, ${posters} posters, ${optimised} screenshots optimised.`);
}

main().catch((error) => {
  console.error(`\nEncode failed: ${(error as Error).message}`);
  process.exit(1);
});
