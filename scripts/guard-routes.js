// Codemod: inject server-side auth guards into API routes.
//
// Ported from maison-toa. Every route under src/app/api runs with the service
// role, which bypasses RLS — so a route without a caller check serves clinic
// data to anyone. Confirmed before this ran: GET /api/debug/patient-intake
// returned 6 KB of a real patient's intake data with no credentials at all.
//
// Re-runnable: routes that already call requireStaff/requireRole are skipped.
//   node scripts/guard-routes.js --dry-run
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src", "app", "api");
const DRY = process.argv.includes("--dry-run");

const PUBLIC_PREFIXES = [
  "public/", // proxied public intake/booking/lead flows
  "webhooks/", // external senders (Retell, Zapier/Facebook)
  "cron/", // Vercel cron; these verify CRON_SECRET themselves
  "patientapp/", // routes verify their own OTP session (confirmed: 401 anonymously)
  "appx/", // public appx surface
];

// Retell is deliberately NOT a blanket prefix. The platform calls a handful of
// these as webhooks/custom functions, but /api/retell/logs served call logs —
// including transcripts and patient phone numbers — to anonymous callers when
// the whole prefix was public.
const RETELL_PUBLIC = [
  "retell/webhook",
  "retell/book-appointment",
  "retell/booking-slots",
  "retell/check-availability",
  "retell/services",
  "retell/dropped-call",
  "retell/schedule-call", // invoked server-to-server by workflows
  "retell/send-booking-whatsapp",
  // Called from the public chat/web-call widgets before sign-in
  "retell/chat-completion",
  "retell/create-chat",
  "retell/web-call",
];
const PUBLIC_EXACT = new Set([
  // Booking widgets read availability before anyone signs in
  "appointments/check-availability",
  "settings/blocked-dates",
  "settings/doctor-days-off",
  // Token-authenticated patient flows
  "invoices/get-by-token",
  "invoices/public/[token]",
  "onboarding/validate-token",
  "onboarding/save",
  "forms/submit",
  // Patient-facing payment
  "payments/payrexx-webhook",
  "payments/check-payrexx-status",
  "payments/create-payrexx-gateway",
  // Inbound mail/messaging and open-tracking pixels
  "emails/webhook",
  "emails/inbound/mailgun",
  "emails/track",
  "whatsapp/webhook",
  "whatsapp/status-callback",
  // OAuth redirect target
  "crisalix/oauth/callback",
  // Creates a CRM deal for an already-created patient; fired by public intake
  "workflows/patient-created",
  // Reports the caller's own identity
  "me",
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

function matchGroup(src, i, open, close) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return j; }
    else if (c === '"' || c === "'" || c === "`") {
      const q = c; j++;
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
    }
  }
  return -1;
}

function injectGuards(src, guardFor) {
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(/g;
  const inserts = [];
  const manual = [];
  let m;
  while ((m = re.exec(src))) {
    const parenStart = m.index + m[0].length - 1;
    const parenEnd = matchGroup(src, parenStart, "(", ")");
    if (parenEnd === -1) { manual.push(m[1]); continue; }
    const params = src.slice(parenStart + 1, parenEnd).trim();
    const nameMatch = params.split(",")[0].trim().match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
    const reqName = nameMatch ? nameMatch[1] : null;
    let k = parenEnd + 1;
    while (k < src.length && src[k] !== "{") { if (src[k] === ";") break; k++; }
    if (k >= src.length || src[k] !== "{") { manual.push(m[1]); continue; }
    inserts.push({ pos: k + 1, text: guardFor(reqName) });
  }
  inserts.sort((a, b) => b.pos - a.pos);
  for (const ins of inserts) src = src.slice(0, ins.pos) + ins.text + src.slice(ins.pos);
  return { src, count: inserts.length, manual };
}

function addImport(src, importLine) {
  if (src.includes(importLine)) return src;
  const matches = [...src.matchAll(/^import[^;]*;[ \t]*$/gm)];
  if (matches.length) {
    const last = matches[matches.length - 1];
    const pos = last.index + last[0].length;
    return src.slice(0, pos) + "\n" + importLine + src.slice(pos);
  }
  return importLine + "\n" + src;
}

const results = { public: [], guarded: [], manual: [], skipped: [] };

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  const isPublic =
    PUBLIC_EXACT.has(rel) ||
    RETELL_PUBLIC.includes(rel) ||
    PUBLIC_PREFIXES.some((p) => rel.startsWith(p));
  if (isPublic) { results.public.push(rel); continue; }
  if (src.includes("requireStaff") || src.includes("requireRole")) {
    results.skipped.push(rel); continue;
  }

  const needsAdminRole =
    rel.startsWith("admin/") || rel.startsWith("users/") ||
    rel.startsWith("debug/") || rel.startsWith("migrations/");

  const r = injectGuards(src, (reqName) => {
    const arg = reqName || "(await headers())";
    const call = needsAdminRole ? `requireRole(${arg}, ["owner","admin"])` : `requireStaff(${arg})`;
    return `\n    try {\n      await ${call};\n    } catch (err) {\n      return authErrorResponse(err);\n    }`;
  });
  src = r.src;
  if (r.count > 0) {
    src = addImport(src, 'import { requireStaff, requireRole, authErrorResponse } from "@/lib/serverAuth";');
    if (src.includes("(await headers())")) {
      src = addImport(src, 'import { headers } from "next/headers";');
    }
    if (!DRY) fs.writeFileSync(file, src);
    results.guarded.push(`${rel} (${r.count})`);
  }
  if (r.manual.length) results.manual.push(`${rel}: ${r.manual.join(",")}`);
}

console.log(`PUBLIC ${results.public.length} | GUARDED ${results.guarded.length} | SKIPPED ${results.skipped.length} | MANUAL ${results.manual.length}`);
results.manual.forEach((x) => console.log("MANUAL", x));
results.guarded.forEach((x) => console.log("G", x));
