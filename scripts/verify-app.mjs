/**
 * End-to-end verification of the clinic-facing journeys that broke in
 * production on 2026-11-06/07.
 *
 *   node scripts/verify-app.mjs                            # localhost:3000
 *   VERIFY_BASE_URL=https://<prod> node scripts/verify-app.mjs
 *
 * Run it against PRODUCTION after deploying. Every one of these regressions
 * passed locally and failed in production, because they depend on the real
 * role data, the real storage buckets and the real Sumex reachability — none
 * of which a local run reproduces.
 *
 * Read-only: it signs in, reads, and writes nothing.
 */
import fs from "node:fs";

const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";
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

const srvHeaders = { apikey: SRV, Authorization: `Bearer ${SRV}` };
const db = async (q) => {
  const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: srvHeaders });
  return r.ok ? await r.json() : [];
};

async function call(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(90000) });
    const responseHeaders = Object.fromEntries(r.headers.entries());
    // Images must not be read as text — only the content type matters here.
    if (String(responseHeaders["content-type"] ?? "").startsWith("image/")) {
      const bytes = (await r.arrayBuffer()).byteLength;
      return { status: r.status, headers: responseHeaders, bytes, text: "" };
    }
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { /* html error page */ }
    return { status: r.status, headers: responseHeaders, json, text };
  } catch (e) {
    return { status: 0, headers: {}, text: String(e.message || e) };
  }
}

console.log(`\nClinic journey verification — ${BASE}\n`);

// A deliberately NON-ADMIN staff account. The regression was that only the 6
// 'admin' accounts could use the app; wilson@mutant.ae has role 'user', which
// is what most of the clinic has.
let token = null;
let whoami = null;
{
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "wilson@mutant.ae", password: "wilsontest" }),
  });
  const j = await r.json().catch(() => ({}));
  token = j.access_token ?? null;
  if (token) {
    const rows = await db(`users?select=role,full_name&id=eq.${j.user?.id}`);
    whoami = rows[0] ?? null;
  }
}
if (!token) {
  log("FAIL", "staff sign-in", "could not obtain a token — everything below is unverified");
  console.log(`\n${tally.PASS} passed, ${tally.FAIL} failed\n`);
  process.exit(1);
}
log("INFO", "signed in", `wilson@mutant.ae — public.users.role = ${JSON.stringify(whoami?.role)} (non-admin)`);

// ─────────────────────────────── 1. assignee dropdowns (tasks, appointments)
console.log("\n1. Staff directory — every \"assign to\" dropdown reads this");
{
  const r = await call("/api/users/list", token);
  if (r.status !== 200) {
    log("FAIL", "non-admin staff can load the directory", `HTTP ${r.status} — dropdowns render "No doctors found"`);
  } else {
    const users = Array.isArray(r.json) ? r.json : [];
    const patients = users.filter((u) => String(u.role).toLowerCase() === "patient");
    log(users.length > 0 ? "PASS" : "FAIL", "non-admin staff can load the directory", `${users.length} colleague(s)`);
    log(patients.length === 0 ? "PASS" : "FAIL", "patient accounts excluded from the directory", `${patients.length} patient account(s) offered as assignees`);
    const named = users.filter((u) => u.full_name || u.email).length;
    log(named === users.length ? "PASS" : "FAIL", "every entry is selectable", `${named}/${users.length} have a display name or email`);
  }
  const anon = await call("/api/users/list", null);
  log(anon.status === 401 ? "PASS" : "FAIL", "still refused anonymously", `HTTP ${anon.status}`);
}

// ─────────────────────────────────────────────── 2. patient photos are visible
console.log("\n2. Patient photos — intake uploads must be readable by staff");
{
  // Intake photos land in patient-photos/<patientId>/<category>/; staff
  // uploads land in patient_document/<patientId>/consultation_photos/<type>/.
  // The bug was that only the second location was ever read.
  const buckets = { "patient-photos": 0, patient_document: 0 };
  let signedOk = 0;
  let sampled = 0;

  const listed = await fetch(`${SUPA}/storage/v1/object/list/patient-photos`, {
    method: "POST",
    headers: { ...srvHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 100 }),
  });
  const folders = listed.ok ? await listed.json() : [];

  for (const folder of folders.slice(0, 5)) {
    for (const type of ["liposuction", "face", "breast"]) {
      const r = await fetch(`${SUPA}/storage/v1/object/list/patient-photos`, {
        method: "POST",
        headers: { ...srvHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: `${folder.name}/${type}`, limit: 50 }),
      });
      const files = r.ok ? await r.json() : [];
      for (const f of files.filter((x) => x.id && x.name !== ".keep")) {
        buckets["patient-photos"]++;
        if (sampled >= 5) continue;
        sampled++;
        // Sign it as the signed-in STAFF user, which is what the browser does.
        const sign = await fetch(
          `${SUPA}/storage/v1/object/sign/patient-photos/${folder.name}/${type}/${f.name}`,
          {
            method: "POST",
            headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ expiresIn: 60 }),
          },
        );
        if (!sign.ok) continue;
        const { signedURL } = await sign.json();
        const img = await fetch(`${SUPA}/storage/v1${signedURL}`);
        if (img.ok && String(img.headers.get("content-type")).startsWith("image/")) signedOk++;
      }
    }
  }

  if (buckets["patient-photos"] === 0) {
    log("INFO", "intake photos present", "no photos in patient-photos — nothing to verify");
  } else {
    log("PASS", "intake photos present", `${buckets["patient-photos"]} file(s) in patient-photos`);
    log(
      signedOk === sampled && sampled > 0 ? "PASS" : "FAIL",
      "staff session can actually render them",
      `${signedOk}/${sampled} sampled photos returned an image over a staff-signed URL`,
    );
  }
}

// ─────────────────────────────────────────── 3. the flat-rate (ACF) catalogue
console.log("\n3. Flat-rate + TARDOC catalogues — billing depends on these");
{
  const started = Date.now();
  const acf = await call("/api/acf/sumex?action=chapters", token);
  const ms = Date.now() - started;
  const chapters = acf.json?.data?.length ?? 0;
  log(
    acf.status === 200 && chapters > 0 ? "PASS" : "FAIL",
    "ACF flat-rate chapters",
    `HTTP ${acf.status}, ${chapters} chapter(s) in ${ms}ms` +
      (acf.status !== 200 ? ` — ${String(acf.json?.error ?? acf.text).slice(0, 120)}` : ""),
  );
  // The dead Sumex server times out at ~10s. A fast answer proves the local
  // catalogue is being used rather than a network round trip.
  log(ms < 5000 ? "PASS" : "FAIL", "served without the Sumex server", `${ms}ms (a Sumex round trip times out at ~10s)`);

  const tma = await call("/api/acf/sumex?action=tmaChapters", token);
  log(
    tma.status === 200 && (tma.json?.data?.length ?? 0) > 0 ? "PASS" : "FAIL",
    "TMA gesture chapters",
    `HTTP ${tma.status}, ${tma.json?.data?.length ?? 0} chapter(s)`,
  );

  const tardoc = await call("/api/tardoc/sumex?action=info", token);
  log(tardoc.status === 200 ? "PASS" : "FAIL", "TARDOC catalogue", `HTTP ${tardoc.status}, ${JSON.stringify(tardoc.json?.data ?? {}).slice(0, 110)}`);

  // Expected to be offline — asserted so that it being offline is a known
  // state rather than a surprise, and so the fallbacks above stay meaningful.
  const health = await call("/api/sumex/health", token);
  log("INFO", "Sumex1 validator server", `online=${health.json?.online} — catalogues must not depend on it`);
}

// ───────────────────── 4. the image proxy that document previews load through
console.log("\n4. Document image proxy — \"images are not visible\"");
{
  // Patient File Storage renders thumbnails and previews as
  // <img src="/api/documents/proxy-image?url=…">. An image subresource cannot
  // send an Authorization header, so guarding this route with requireStaff
  // made every document preview answer 401 and render broken. It must serve a
  // self-authorising storage URL WITHOUT a session — while still refusing to
  // be used as an open SSRF proxy.
  // Resolved from the bucket, not patient_documents: the File Storage tab
  // lists the bucket directly, and most of what it shows has no table row.
  const listBucket = async (prefix) => {
    const r = await fetch(`${SUPA}/storage/v1/object/list/patient_document`, {
      method: "POST",
      headers: { ...srvHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 100 }),
    });
    return r.ok ? await r.json() : [];
  };
  let imagePath = null;
  for (const folder of (await listBucket("")).slice(0, 8)) {
    const hit = (await listBucket(folder.name)).find(
      (f) => f.id && /\.(jpe?g|png)$/i.test(f.name),
    );
    if (hit) { imagePath = `${folder.name}/${hit.name}`; break; }
  }

  if (!imagePath) {
    log("INFO", "image document available", "no image document found to verify");
  } else {
    const publicUrl = `${SUPA}/storage/v1/object/public/patient_document/${imagePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const proxied = `/api/documents/proxy-image?url=${encodeURIComponent(publicUrl)}`;

    // No token on purpose: this is exactly what the browser's <img> sends.
    const anon = await call(proxied, null);
    const isImage = String(anon.headers?.["content-type"] ?? "").startsWith("image/");
    log(
      anon.status === 200 && isImage ? "PASS" : "FAIL",
      "previews load without a bearer token (as <img> does)",
      `HTTP ${anon.status}, content-type ${anon.headers?.["content-type"] ?? "none"}`,
    );
  }

  // The reason it cannot simply be public: it used to fetch any URL
  // server-side. Blocked for everyone now, session or not.
  for (const [label, probe] of [
    ["external host", "https://example.com/x.png"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
  ]) {
    const r = await call(`/api/documents/proxy-image?url=${encodeURIComponent(probe)}`, token);
    log(r.status === 400 ? "PASS" : "FAIL", `refuses to proxy a ${label} (SSRF)`, `HTTP ${r.status}`);
  }
}

console.log(`\n${tally.PASS} passed, ${tally.FAIL} failed\n`);
process.exit(tally.FAIL > 0 ? 1 : 0);
