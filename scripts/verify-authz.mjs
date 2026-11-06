/**
 * Verifies the server-side authorization rollout.
 *
 *   node scripts/verify-authz.mjs                 # against localhost
 *   VERIFY_BASE_URL=https://... node scripts/verify-authz.mjs
 *
 * Checks three things that must all hold at once:
 *   1. privileged routes reject anonymous callers
 *   2. a real staff session still reaches them (no lockout)
 *   3. public/token/webhook flows remain reachable without a session
 */
import fs from "node:fs";

const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const env = fs.readFileSync(".env.local", "utf8");
const pick = (k) =>
  env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim().replace(/#.*$/, "").replace(/^["']|["']$/g, "").trim();
const SUPA = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SRV = pick("SUPABASE_SERVICE_ROLE_KEY");

const RESET = "\x1b[0m";
const C = { PASS: "\x1b[32m", FAIL: "\x1b[31m", INFO: "\x1b[33m" };
const tally = { PASS: 0, FAIL: 0 };
const log = (state, name, detail) => {
  if (state !== "INFO") tally[state]++;
  console.log(`  ${C[state]}${state}${RESET}  ${name}`);
  if (detail) console.log(`        ${detail}`);
};

async function call(path, { token, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(90000),
    });
    return { status: res.status, text: (await res.text()).slice(0, 120) };
  } catch (e) {
    return { status: 0, text: String(e.message || e) };
  }
}

// A real patient id makes the "would have leaked data" check meaningful.
let patientId = null;
try {
  const r = await fetch(`${SUPA}/rest/v1/patients?select=id&limit=1`, {
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}` },
  });
  patientId = (await r.json())?.[0]?.id ?? null;
} catch {
  /* fall through */
}

console.log(`\nAuthorization verification — ${BASE}\n`);

// ---------------------------------------------------------------- anonymous
console.log("1. Privileged routes must reject anonymous callers");
// Reachable by any staff account.
const staffRoutes = [
  ["/api/documents/patient" + (patientId ? `?patientId=${patientId}` : ""), "patient documents", "GET"],
  ["/api/patients/recover-files", "patient file recovery", "GET"],
  ["/api/sumex/debug", "internal billing infrastructure config", "GET"],
  ["/api/invoice-linker/unlinked-invoices", "invoice data", "GET"],
  ["/api/statistics/sent-invoices?from=2026-01-01&to=2026-12-31", "billing statistics", "GET"],
  ["/api/emails/send", "mail relay", "POST"],
];
// Admin-only: a signed-in non-admin staff member must still get 403.
const adminRoutes = [
  ["/api/debug/patient-intake" + (patientId ? `?patient_id=${patientId}` : ""), "leaked 6 KB of intake data before this fix", "GET"],
  ["/api/users/list", "staff directory", "GET"],
];
for (const [path, why, method] of [...staffRoutes, ...adminRoutes]) {
  const r = await call(path, { method, body: method === "POST" ? {} : undefined });
  const blocked = r.status === 401 || r.status === 403;
  log(blocked ? "PASS" : "FAIL", `${method} ${path.split("?")[0]}`, `HTTP ${r.status} — ${why}`);
}

// ------------------------------------------------------------------- staff
console.log("\n2. A real staff session must still reach them (no lockout)");
let token = null;
try {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "wilson@mutant.ae", password: "wilsontest" }),
  });
  token = (await r.json()).access_token ?? null;
} catch {
  /* handled below */
}
if (!token) {
  log("FAIL", "staff sign-in", "could not obtain an access token");
} else {
  for (const [path, , method] of staffRoutes) {
    const r = await call(path, { token, method, body: method === "POST" ? {} : undefined });
    // 400 is fine: the guard passed and the handler rejected an empty payload.
    const ok = r.status !== 401 && r.status !== 403;
    log(ok ? "PASS" : "FAIL", `${method} ${path.split("?")[0]}`, `HTTP ${r.status}${ok ? "" : " — STAFF LOCKED OUT: " + r.text}`);
  }
  // wilson@mutant.ae has role 'user', so admin-only routes must refuse it.
  for (const [path, , method] of adminRoutes) {
    const r = await call(path, { token, method });
    const ok = r.status === 403;
    log(ok ? "PASS" : "FAIL", `${method} ${path.split("?")[0]}`, `HTTP ${r.status} — admin-only, non-admin staff correctly refused`);
  }
}

// ------------------------------------------------------------------ public
console.log("\n3. Public / token / webhook flows must stay reachable");
const mustAllow = [
  ["/api/appointments/check-availability", "booking availability"],
  ["/api/settings/blocked-dates", "booking calendar"],
  ["/api/settings/doctor-days-off", "booking calendar"],
  ["/api/medidata/participants", "guarded is fine too — checked separately"],
];
for (const [path, why] of mustAllow.slice(0, 3)) {
  const r = await call(path);
  const reachable = r.status !== 401 && r.status !== 403;
  log(reachable ? "PASS" : "FAIL", path, `HTTP ${r.status} — ${why}`);
}
// The public intake proxy must still answer anonymously.
{
  const r = await call("/api/public/intake", { method: "POST", body: { action: "lookup_patient", email: "nobody@example.invalid" } });
  const ok = r.status === 200;
  log(ok ? "PASS" : "FAIL", "/api/public/intake", `HTTP ${r.status} — public intake proxy`);
}
// Signed photo upload URL (the flow fixed last week) must still work.
{
  const r = await call("/api/public/intake", {
    method: "POST",
    body: { action: "photo_upload_url", file_name: "00000000-0000-4000-8000-000000000009/face/front_1.jpg" },
  });
  const ok = r.status === 200;
  log(ok ? "PASS" : "FAIL", "/api/public/intake photo_upload_url", `HTTP ${r.status} — patient photo upload`);
}

console.log(`\n${tally.PASS} passed, ${tally.FAIL} failed\n`);
process.exit(tally.FAIL > 0 ? 1 : 0);
