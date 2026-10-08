/**
 * Proves the three assumptions the whole pipeline rests on, before any
 * recipe work is done:
 *
 *   1. Playwright can sign in to production as the capture account.
 *   2. The read-only guard lets the app render but blocks writes.
 *   3. ffmpeg + Gemini TTS can produce a measurable audio clip.
 *
 * Run: npx tsx scripts/academy/smoke.ts
 */
import { chromium } from "@playwright/test";
import { capture } from "./lib/env";
import { assertCaptureCredentials, reportCaptureTarget } from "./lib/guards";
import { installReadOnlyGuard } from "./lib/readonly";
import { assertEncoderSupport, probeDurationSeconds } from "./lib/ffmpeg";
import { narrateLesson } from "./lib/narration";
import { newSignedInContext, signIn } from "./lib/auth";

async function main() {
  reportCaptureTarget();
  assertCaptureCredentials();

  console.log("\n1. encoder support");
  assertEncoderSupport();
  console.log("   ffmpeg has libx264 + aac. OK");

  console.log("\n2. narration");
  const steps = await narrateLesson("__smoke__", [
    "Open the patient list to find a patient.",
    "Use the search box to narrow the list.",
  ]);
  steps.forEach((step) =>
    console.log(
      `   line ${step.index}: ${step.audioPath ? `${probeDurationSeconds(step.audioPath).toFixed(2)}s audio` : "silent"}` +
        ` -> dwell ${step.dwellSeconds.toFixed(2)}s`
    )
  );

  console.log("\n3. sign-in + read-only guard");
  const browser = await chromium.launch();
  await signIn(browser);
  console.log("   session obtained via auth API (password never enters a URL)");

  const context = await newSignedInContext(browser, { width: 1440, height: 900 });
  const report = installReadOnlyGuard(context);
  const page = await context.newPage();

  await page.goto(`${capture.appUrl}/patients`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const heading = await page.title();
  console.log(`   /patients rendered (title: ${heading})`);
  console.log(`   writes blocked while browsing: ${report.blocked.length}`);

  // Deliberately attempt a write; the guard must refuse it.
  const probe = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "nobody@example.invalid", subject: "x", html: "x" }),
      });
      return `reached server: HTTP ${res.status}`;
    } catch (error) {
      return `blocked in browser: ${(error as Error).message}`;
    }
  });
  console.log(`   deliberate write probe -> ${probe}`);

  await context.close();
  await browser.close();

  const guardWorked = probe.startsWith("blocked in browser");
  console.log(`\n${guardWorked ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED — the write reached the server"}`);
  process.exit(guardWorked ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
