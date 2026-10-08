import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Resolves a *real* ffmpeg.
 *
 * Playwright ships its own ffmpeg, and it is tempting to reuse. It is a VP8 /
 * WebM-only build with no libx264, no AAC and no mp4 muxer, so it silently
 * cannot produce the narrated MP4 this pipeline needs. Anything found under
 * ms-playwright is therefore rejected outright rather than half-working.
 */

const WINGET_BIN = resolve(
  homedir(),
  "AppData/Local/Microsoft/WinGet/Packages",
  "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin"
);

const CANDIDATE_DIRS = [WINGET_BIN, "/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"];

function isPlaywrightBuild(path: string): boolean {
  return /ms-playwright/i.test(path);
}

function probe(binary: "ffmpeg" | "ffprobe"): string {
  const fromEnv = process.env[binary === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  // On PATH?
  try {
    execFileSync(binary, ["-version"], { stdio: "ignore" });
    return binary;
  } catch {
    // fall through to known locations
  }

  for (const dir of CANDIDATE_DIRS) {
    for (const name of [`${binary}.exe`, binary]) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate) && !isPlaywrightBuild(candidate)) return candidate;
    }
  }

  throw new Error(
    `${binary} not found. Install it (winget install --id Gyan.FFmpeg --source winget) or set ` +
      `${binary === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"}. Playwright's bundled build cannot be used: ` +
      `it is VP8/WebM only and cannot encode H.264 or AAC.`
  );
}

let cachedFfmpeg: string | null = null;
let cachedFfprobe: string | null = null;

export function ffmpegPath(): string {
  cachedFfmpeg ??= probe("ffmpeg");
  return cachedFfmpeg;
}

export function ffprobePath(): string {
  cachedFfprobe ??= probe("ffprobe");
  return cachedFfprobe;
}

export function runFfmpeg(args: string[]): void {
  execFileSync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: ["ignore", "ignore", "pipe"],
  });
}

/** Duration in seconds, or 0 when the file has no measurable stream. */
export function probeDurationSeconds(file: string): number {
  const out = execFileSync(
    ffprobePath(),
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" }
  ).trim();
  const value = Number.parseFloat(out);
  return Number.isFinite(value) ? value : 0;
}

/** Fails fast with a clear message if the toolchain cannot do the job. */
export function assertEncoderSupport(): void {
  const encoders = execFileSync(ffmpegPath(), ["-hide_banner", "-encoders"], { encoding: "utf8" });
  const missing = ["libx264", "aac"].filter((codec) => !new RegExp(`\\b${codec}\\b`).test(encoders));
  if (missing.length > 0) {
    throw new Error(
      `This ffmpeg lacks ${missing.join(" and ")}. A full build is required to mux narrated MP4s.`
    );
  }
}
