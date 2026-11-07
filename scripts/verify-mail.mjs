/**
 * Email deliverability verification.
 *
 * The failure this exists to catch is silent: Mailgun accepts a message with
 * 2xx and only then refuses to deliver it, because the address sits on the
 * domain's suppression list. A patient simply never hears from the clinic and
 * nothing in the UI says so.
 *
 *   node scripts/verify-mail.mjs            # last 30 days
 *   node scripts/verify-mail.mjs --days 7
 *
 * Read-only: it sends nothing and changes nothing.
 */
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k) =>
  env
    .match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]
    ?.replace(/#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

const KEY = pick("MAILGUN_API_KEY");
const BASE = pick("MAILGUN_API_BASE_URL") || "https://api.mailgun.net";
const TRANSACTIONAL = pick("MAILGUN_DOMAIN");
const MARKETING = pick("MAILGUN_MARKETING_DOMAIN") || TRANSACTIONAL;
const SUPA = pick("NEXT_PUBLIC_SUPABASE_URL");
const SRV = pick("SUPABASE_SERVICE_ROLE_KEY");

const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 30;

const RESET = "\x1b[0m";
const C = { PASS: "\x1b[32m", FAIL: "\x1b[31m", WARN: "\x1b[33m", INFO: "\x1b[36m" };
const tally = { PASS: 0, FAIL: 0, WARN: 0 };
const log = (state, name, detail) => {
  if (state in tally) tally[state]++;
  console.log(`  ${C[state]}${state}${RESET}  ${name}`);
  if (detail) console.log(`        ${detail}`);
};

const auth = "Basic " + Buffer.from(`api:${KEY}`).toString("base64");
const mg = async (path) => {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: auth } });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const db = async (q) => {
  const r = await fetch(`${SUPA}/rest/v1/${q}`, {
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, Prefer: "count=exact" },
  });
  return { rows: await r.json().catch(() => []), count: Number(r.headers.get("content-range")?.split("/")[1]) || 0 };
};

console.log(`\nEmail deliverability — last ${days} day(s)\n`);

// ---------------------------------------------------------------- 1. streams
console.log("1. Sending streams");
if (!KEY || !TRANSACTIONAL) {
  log("FAIL", "Mailgun configured", "MAILGUN_API_KEY or MAILGUN_DOMAIN missing");
} else {
  log("PASS", "Mailgun configured", `${BASE} — transactional domain ${TRANSACTIONAL}`);
}
if (MARKETING !== TRANSACTIONAL) {
  log("PASS", "marketing/transactional split", `marketing sends from ${MARKETING}`);
} else {
  log(
    "WARN",
    "marketing/transactional split",
    `both streams use ${TRANSACTIONAL} — a campaign bounce suppresses the address for\n        ` +
      `appointment mail too. Set MAILGUN_MARKETING_DOMAIN to a verified second domain.`,
  );
}

// ------------------------------------------------------- 2. key capabilities
console.log("\n2. API key capabilities");
{
  const events = await mg(`/v3/${TRANSACTIONAL}/events?event=failed&limit=1`);
  log(
    events.status === 200 ? "PASS" : "FAIL",
    "events API (delivery truth)",
    `HTTP ${events.status} — /api/cron/sync-email-delivery depends on this`,
  );
  const sup = await mg(`/v3/${TRANSACTIONAL}/bounces?limit=1`);
  if (sup.status === 200) {
    log("PASS", "suppressions API", "HTTP 200 — a suppressed patient can be un-blocked");
  } else {
    log(
      "WARN",
      "suppressions API",
      `HTTP ${sup.status} — this key cannot read or delete suppressions, so an address\n        ` +
        `that bounced once can never be reached again, even after the mailbox is fixed.\n        ` +
        `Needs a Mailgun private API key with suppression access.`,
    );
  }
}

// ------------------------------------------------- 3. what Mailgun refuses
console.log("\n3. Delivery failures");
const since = Math.floor(Date.now() / 1000) - days * 86400;
const reasons = new Map();
const suppressed = new Set();
let failedTotal = 0;

for (const domain of [...new Set([TRANSACTIONAL, MARKETING])]) {
  let path = `/v3/${domain}/events?event=failed&limit=300&begin=${since}&ascending=yes`;
  for (let page = 0; page < 40; page++) {
    const r = await mg(path);
    if (r.status !== 200) {
      log("FAIL", `events for ${domain}`, `HTTP ${r.status}`);
      break;
    }
    const items = r.json.items ?? [];
    for (const e of items) {
      failedTotal++;
      const code = e["delivery-status"]?.code;
      const message = (e["delivery-status"]?.message || e.reason || "").slice(0, 60);
      const key = `${code} ${message}`;
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
      // 605 = previously bounced, 607 = previously marked as spam. Both mean
      // Mailgun refused on our behalf because of the suppression list.
      if (code === 605 || code === 607) suppressed.add(e.recipient);
    }
    const next = r.json.paging?.next;
    if (!next || items.length === 0) break;
    path = next.replace(BASE, "");
  }
}

const suppressionBlocked = [...reasons.entries()]
  .filter(([k]) => k.startsWith("605") || k.startsWith("607"))
  .reduce((n, [, v]) => n + v, 0);

log("INFO", `${failedTotal} delivery failure(s)`, "top reasons:");
for (const [reason, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`          ${String(n).padStart(5)}  ${reason}`);
}
if (suppressionBlocked > 0) {
  log(
    "FAIL",
    "mail blocked by the suppression list",
    `${suppressionBlocked} message(s) to ${suppressed.size} address(es) were never attempted.\n        ` +
      `These recipients are unreachable until the suppression entry is deleted.`,
  );
} else {
  log("PASS", "mail blocked by the suppression list", "none in this window");
}

// ------------------------------------------------- 4. our own record of it
console.log("\n4. Patient records");
if (!SUPA || !SRV) {
  log("WARN", "patient flags", "Supabase env missing — skipped");
} else {
  const total = await db("patients?select=id&limit=1");
  const undeliverable = await db("patients?select=id&email_undeliverable=is.true&limit=1");
  const pct = total.count ? ((undeliverable.count / total.count) * 100).toFixed(1) : "0";
  log(
    undeliverable.count === 0 ? "PASS" : "WARN",
    "patients flagged email_undeliverable",
    `${undeliverable.count} of ${total.count} (${pct}%) cannot currently receive clinic email`,
  );
  const stuck = await db("emails?select=id&status=eq.sending&limit=1");
  log(
    stuck.count < 50 ? "PASS" : "WARN",
    "emails stuck in 'sending'",
    `${stuck.count} row(s) never reconciled — sync-email-delivery should resolve these`,
  );
}

console.log(`\n${tally.PASS} passed, ${tally.FAIL} failed, ${tally.WARN} warning(s)\n`);
process.exit(tally.FAIL > 0 ? 1 : 0);
