/**
 * Audit untagged / unattributed appointments in the booking window.
 * These are the rows that currently block NOBODY's online availability
 * (no provider_id AND no [Doctor: <name>] reason tag), which is Caveat 2.
 *
 * Run: npx tsx scripts/untagged-appointments-audit.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, reason, title, location, no_patient, provider_id")
    .gt("end_time", now)
    .lt("start_time", end)
    .neq("status", "cancelled");
  if (error) throw error;

  const rows = data || [];
  const hasTag = (r: { reason?: string | null }) => /\[Doctor:\s*(.+?)\s*\]/i.test(r.reason || "");
  const untagged = rows.filter((r) => !r.provider_id && !hasTag(r));
  const tagged = rows.filter((r) => r.provider_id || hasTag(r));

  console.log(`=== Untagged appointment audit (next 90 days) ===`);
  console.log(`Total non-cancelled appointments overlapping window: ${rows.length}`);
  console.log(`  Attributed (provider_id or [Doctor:] tag): ${tagged.length}`);
  console.log(`  UNATTRIBUTED (block nobody online):        ${untagged.length}\n`);

  // Breakdown of untagged ones
  const byLocation: Record<string, number> = {};
  const noPatientCount = untagged.filter((r) => r.no_patient).length;
  for (const r of untagged) {
    const loc = (r.location || "(none)").toLowerCase();
    byLocation[loc] = (byLocation[loc] || 0) + 1;
  }
  console.log(`Untagged with no_patient (PAUSE/break): ${noPatientCount}`);
  console.log(`Untagged by location:`);
  for (const [loc, n] of Object.entries(byLocation).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${loc.padEnd(20)} ${n}`);
  }

  console.log(`\nSample untagged rows (up to 15):`);
  for (const r of untagged.slice(0, 15)) {
    const reason = (r.reason || "").slice(0, 60);
    console.log(
      `  ${r.start_time}  loc=${(r.location || "-").padEnd(12)} no_patient=${r.no_patient ? "Y" : "n"}  "${reason}"`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
