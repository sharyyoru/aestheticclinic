import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RECIPES } from "./recipes";
import { dwellFor } from "./lib/captions";
import { ensureOutDir, readManifest, writeManifest } from "./lib/manifest";

function timestamp(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function narration(recipe: (typeof RECIPES)[number]): string[] {
  return recipe.steps.flatMap((step) => {
    if (step.kind === "caption") return [step.text];
    if ("caption" in step) return [step.caption];
    return [];
  });
}

async function main() {
  const manifest = readManifest();
  const scriptsDir = ensureOutDir("scripts");
  const captionsDir = ensureOutDir("captions");

  for (const recipe of RECIPES) {
    const lines = narration(recipe);
    const scriptPath = resolve(scriptsDir, `${recipe.docSlug}.txt`);
    const captionsPath = resolve(captionsDir, `${recipe.docSlug}.vtt`);
    writeFileSync(scriptPath, `${lines.join("\n\n")}\n`);

    let cursor = 0;
    const cues = lines.map((line, index) => {
      const start = cursor;
      cursor += dwellFor(line);
      return `${index + 1}\n${timestamp(start)} --> ${timestamp(cursor)}\n${line}`;
    });
    writeFileSync(captionsPath, `WEBVTT\n\n${cues.join("\n\n")}\n`);

    const entry = manifest.entries.find((item) => item.docSlug === recipe.docSlug);
    if (!entry) continue;
    entry.video = {
      ...entry.video,
      localCaptions: captionsPath,
      scriptVersion: "1",
      durationSeconds: entry.video?.durationSeconds ?? Math.ceil(cursor / 1000),
      stepCount: lines.length,
    };
  }

  writeManifest(manifest);
  console.log(`Generated reviewed-source scripts and captions for ${RECIPES.length} lessons.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
