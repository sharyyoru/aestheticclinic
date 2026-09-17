import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./env";

export const OUT_DIR = resolve(REPO_ROOT, "scripts/academy/out");
export const MANIFEST_PATH = resolve(OUT_DIR, "manifest.json");

export type ManifestShot = {
  /** Screenshot name within the module, e.g. "search-categories". */
  name: string;
  alt: string;
  /** Section id this screenshot belongs to, when the recipe declares one. */
  sectionId?: string;
  localPath: string;
  publicUrl?: string;
};

export type ManifestEntry = {
  docSlug: string;
  route: string;
  shots: ManifestShot[];
  video?: {
    localWebm?: string;
    localMp4?: string;
    localPoster?: string;
    publicUrl?: string;
    posterUrl?: string;
    durationSeconds?: number;
    stepCount?: number;
  };
  failures: string[];
  capturedAt: string;
};

export type Manifest = {
  generatedAt: string;
  captureProjectRef: string;
  entries: ManifestEntry[];
};

export function ensureOutDir(...sub: string[]): string {
  const dir = resolve(OUT_DIR, ...sub);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`No manifest at ${MANIFEST_PATH}. Run: npm run academy:capture`);
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

export function writeManifest(manifest: Manifest): void {
  ensureOutDir();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}
