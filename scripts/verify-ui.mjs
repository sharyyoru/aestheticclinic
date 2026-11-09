/**
 * Browser verification of the clinic-facing UI.
 *
 * The HTTP harnesses (verify:app) can only prove that data is *reachable*.
 * Two of the three outages reported on 2026-11-06 were rendering failures —
 * an assignee dropdown that said "No doctors found", and patient photos that
 * were never read from the bucket they live in. An API check passes happily
 * through both. Only a real browser catches them.
 *
 *   node scripts/verify-ui.mjs
 *   VERIFY_BASE_URL=https://<prod> node scripts/verify-ui.mjs
 *   node scripts/verify-ui.mjs --headed      # watch it run
 *
 * Read-only: it signs in and looks. It creates and changes nothing.
 * Needs a browser once:  npx playwright install chromium
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const BASE = (process.env.VERIFY_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const HEADED = process.argv.includes("--headed");

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k) =>
  env
    .match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]
    ?.replace(/#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

const SUPA = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SRV = pick("SUPABASE_SERVICE_ROLE_KEY");

const RESET = "\x1b[0m";
const C = { PASS: "\x1b[32m", FAIL: "\x1b[31m", INFO: "\x1b[36m" };
const tally = { PASS: 0, FAIL: 0 };
const log = (state, name, detail) => {
  if (state in tally) tally[state]++;
  console.log(`  ${C[state]}${state}${RESET}  ${name}`);
  if (detail) console.log(`        ${detail}`);
};

console.log(`\nUI verification — ${BASE}\n`);

// ── a non-admin staff session ───────────────────────────────────────────────
// Deliberately not driving the login form: Playwright beats React hydration
// and the un-hydrated form submits as a GET, putting the password in the URL
// and the server logs. Same approach as scripts/academy/lib/auth.ts.
const tokenResponse = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "wilson@mutant.ae", password: "wilsontest" }),
});
if (!tokenResponse.ok) {
  log("FAIL", "staff sign-in", `HTTP ${tokenResponse.status}`);
  process.exit(1);
}
const session = await tokenResponse.json();
session.expires_at ??= Math.floor(Date.now() / 1000) + session.expires_in;
const storageKey = `sb-${new URL(SUPA).hostname.split(".")[0]}-auth-token`;
log("INFO", "signed in", "wilson@mutant.ae — role 'user' (non-admin, like most of the clinic)");

// ── find a patient who actually submitted intake photos ─────────────────────
async function patientWithIntakePhotos() {
  const headers = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };
  const list = async (prefix) => {
    const r = await fetch(`${SUPA}/storage/v1/object/list/patient-photos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prefix, limit: 100 }),
    });
    return r.ok ? await r.json() : [];
  };
  for (const folder of await list("")) {
    for (const type of ["liposuction", "face", "breast"]) {
      const files = (await list(`${folder.name}/${type}`)).filter((f) => f.id && f.name !== ".keep");
      if (files.length) return { patientId: folder.name, type, count: files.length };
    }
  }
  return null;
}
const photoFixture = await patientWithIntakePhotos();

const browser = await chromium.launch({ headless: !HEADED });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });

// localStorage can only be written once the origin is loaded.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(
  ([key, value]) => window.localStorage.setItem(key, value),
  [storageKey, JSON.stringify(session)],
);

try {
  // ── 1. the assignee dropdown ──────────────────────────────────────────────
  console.log("\n1. Task assignee dropdown — \"Tasks can not be assigned to a Doctor\"");
  await page.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" });
  // The control is labelled with the current selection, "My Tasks" by default.
  const opener = page.getByRole("button", { name: /My Tasks/i }).first();
  await opener.waitFor({ state: "visible", timeout: 60000 });
  await opener.click();

  // "Loading users..." must resolve into real entries, not "No users found".
  const empty = page.getByText("No users found", { exact: true });
  const searchBox = page.getByPlaceholder("Search users...");
  await searchBox.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(2500); // let /api/users/list settle

  const isEmpty = await empty.isVisible().catch(() => false);
  const stillLoading = await page.getByText("Loading users...").isVisible().catch(() => false);
  // Count the colleague rows: buttons inside the open dropdown, minus "My Tasks".
  const optionCount = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="Search users..."]');
    const panel = input?.closest("div")?.parentElement;
    if (!panel) return 0;
    return [...panel.querySelectorAll("button")].filter(
      (b) => !/my tasks/i.test(b.textContent || ""),
    ).length;
  });

  if (isEmpty || stillLoading || optionCount === 0) {
    log("FAIL", "dropdown lists colleagues", `"No users found"=${isEmpty}, still loading=${stillLoading}, options=${optionCount}`);
  } else {
    log("PASS", "dropdown lists colleagues", `${optionCount} assignable user(s) rendered`);
  }

  // ── 2. patient photos render ──────────────────────────────────────────────
  console.log("\n2. Patient photos — \"Photos of patients are not visible\"");
  if (!photoFixture) {
    log("INFO", "intake photos", "no patient in patient-photos — nothing to verify");
  } else {
    await page.goto(`${BASE}/patients/${photoFixture.patientId}`, { waitUntil: "domcontentloaded" });

    // These are unresized phone photos — ~2 MB and 3024px each — so a fixed
    // wait is a coin toss that reports a product bug when the network is
    // merely slow. Wait for the <img> elements to appear, then for every one
    // of them to finish loading. `complete` also turns true for a *failed*
    // load, which is why the assertion below checks naturalWidth.
    await page
      .waitForFunction(
        () => [...document.querySelectorAll("img")].some((i) => i.src.includes("patient-photos")),
        { timeout: 60000 },
      )
      .catch(() => {});
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("img")]
            .filter((i) => i.src.includes("patient-photos"))
            .every((i) => i.complete),
        { timeout: 90000 },
      )
      .catch(() => {});

    // An <img> is only proof if the bytes actually decoded: a broken image
    // still has a src, but naturalWidth stays 0.
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((i) => i.src.includes("patient-photos"))
        .map((i) => ({ ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth })),
    );
    const rendered = shown.filter((i) => i.ok).length;

    if (shown.length === 0) {
      log("FAIL", "intake photos appear in the patient record", `0 <img> pointing at patient-photos — expected ${photoFixture.count} (${photoFixture.type})`);
    } else if (rendered === 0) {
      log("FAIL", "intake photos actually load", `${shown.length} <img> present but none decoded (broken/expired URLs)`);
    } else {
      log("PASS", "intake photos appear and load", `${rendered}/${shown.length} rendered for patient ${photoFixture.patientId.slice(0, 8)} (${photoFixture.type})`);
    }
  }

  // ── 3. nothing exploded on the way ────────────────────────────────────────
  // ── 3. document previews in the File Storage tab ──────────────────────────
  console.log("\n3. File Storage previews — \"images are still not visible\"");
  {
    // Thumbnails and the preview pane load through
    // /api/documents/proxy-image. An <img> cannot send a bearer token, so
    // guarding that route made every one of them render broken.
    const withDocs = await (async () => {
      const headers = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };
      const list = async (prefix) => {
        const r = await fetch(`${SUPA}/storage/v1/object/list/patient_document`, {
          method: "POST", headers, body: JSON.stringify({ prefix, limit: 100 }),
        });
        return r.ok ? await r.json() : [];
      };
      for (const folder of (await list("")).slice(0, 10)) {
        const imgs = (await list(folder.name)).filter((f) => f.id && /\.(jpe?g|png)$/i.test(f.name));
        if (imgs.length) return { patientId: folder.name, count: imgs.length };
      }
      return null;
    })();

    if (!withDocs) {
      log("INFO", "image documents", "no patient with image documents — nothing to verify");
    } else {
      await page.goto(`${BASE}/patients/${withDocs.patientId}?m_tab=medical&medical_sub=documents`, {
        waitUntil: "domcontentloaded",
      });
      await page
        .waitForFunction(
          () => [...document.querySelectorAll("img")].some((i) => i.src.includes("proxy-image")),
          { timeout: 60000 },
        )
        .catch(() => {});
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll("img")]
              .filter((i) => i.src.includes("proxy-image"))
              .every((i) => i.complete),
          { timeout: 90000 },
        )
        .catch(() => {});

      const shown = await page.evaluate(() =>
        [...document.querySelectorAll("img")]
          .filter((i) => i.src.includes("proxy-image"))
          .map((i) => i.complete && i.naturalWidth > 0),
      );
      const ok = shown.filter(Boolean).length;
      if (shown.length === 0) {
        log("FAIL", "document previews are rendered", "no proxy-image <img> on the File Storage tab");
      } else {
        log(
          ok === shown.length ? "PASS" : "FAIL",
          "document previews load",
          `${ok}/${shown.length} decoded for patient ${withDocs.patientId.slice(0, 8)}`,
        );
      }
    }
  }

  console.log("\n4. Browser console");
  // 401/403 here is how all three outages looked from inside the page.
  const authErrors = consoleErrors.filter((e) => /401|403|Forbidden|Unauthorized/i.test(e));
  log(
    authErrors.length === 0 ? "PASS" : "FAIL",
    "no authorization errors in the page",
    authErrors.length ? authErrors.slice(0, 3).join("\n        ") : `${consoleErrors.length} non-auth console message(s)`,
  );
} finally {
  await browser.close();
}

console.log(`\n${tally.PASS} passed, ${tally.FAIL} failed\n`);
process.exit(tally.FAIL > 0 ? 1 : 0);
