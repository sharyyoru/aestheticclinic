/**
 * Recover the insurer's rejection reason for submissions that already have one
 * stored but unreadable.
 *
 * The machine-readable `<invoice:error code=… text=… record_id=…>` elements
 * were present in every stored response XML all along, but the poller only
 * recorded `status_out` — which is the literal string "unknown" in most
 * insurer payloads. The result is the clinic's complaint: invoices sitting
 * "waiting to be corrected" with no visible reason.
 *
 * /api/medidata/poll now records the real code going forward; this applies the
 * same parse to the history in medidata_responses.content.
 *
 * Idempotent: only fills a submission whose insurance_response_code is empty
 * or the useless "unknown"/"refused" placeholder. Never overwrites a real code.
 *
 * Run: npx tsx scripts/medidata/backfill-response-errors.ts          (dry run)
 *      npx tsx scripts/medidata/backfill-response-errors.ts --write  (apply)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  parseResponseXml,
  primaryErrorCode,
  describeResponseErrors,
} from "../../src/lib/medidataResponseParser";

for (const l of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const WRITE = process.argv.includes("--write");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Values that carry no information and may safely be replaced. */
const PLACEHOLDER = new Set(["", "unknown", "refused", "granted", "pending", "null"]);

async function main() {
  const { data: responses, error } = await supabase
    .from("medidata_responses")
    .select("id, submission_id, content, response_type, received_at")
    .not("submission_id", "is", null)
    .order("received_at", { ascending: true });

  if (error) throw new Error(`Could not read medidata_responses: ${error.message}`);

  console.log(`Scanning ${responses?.length ?? 0} stored responses…\n`);

  // Latest response per submission wins (ordered ascending above).
  const bySubmission = new Map<string, { code: string; message: string; codes: string[] }>();
  const codeTally = new Map<string, number>();

  for (const row of responses ?? []) {
    if (!row.content) continue;
    const parsed = parseResponseXml(row.content as string);
    if (!parsed.errors.length) continue;
    const code = primaryErrorCode(parsed.errors);
    if (!code) continue;
    bySubmission.set(row.submission_id as string, {
      code,
      message: describeResponseErrors(parsed.errors),
      codes: parsed.errors.map((e) => e.code),
    });
    for (const e of parsed.errors) codeTally.set(e.code, (codeTally.get(e.code) ?? 0) + 1);
  }

  console.log(`Parsed reasons for ${bySubmission.size} submissions.`);
  console.log("\nMost frequent insurer reject codes:");
  for (const [code, n] of [...codeTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(5)}  ${code}`);
  }

  const ids = [...bySubmission.keys()];
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: subs, error: subErr } = await supabase
      .from("medidata_submissions")
      .select("id, status, insurance_response_code, insurance_response_message")
      .in("id", chunk);
    if (subErr) throw new Error(`Could not read medidata_submissions: ${subErr.message}`);

    for (const sub of subs ?? []) {
      const parsed = bySubmission.get(sub.id as string)!;
      const existing = String(sub.insurance_response_code ?? "").trim().toLowerCase();
      if (!PLACEHOLDER.has(existing)) {
        skipped++;
        continue;
      }
      if (WRITE) {
        const { error: upErr } = await supabase
          .from("medidata_submissions")
          .update({
            insurance_response_code: parsed.code,
            insurance_response_message: parsed.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
        if (upErr) {
          console.error(`  ! ${sub.id}: ${upErr.message}`);
          continue;
        }
      }
      updated++;
    }
  }

  console.log(
    `\n${WRITE ? "Updated" : "Would update"} ${updated} submission(s); ` +
      `${skipped} already carried a real code.`,
  );
  if (!WRITE) console.log("Dry run — re-run with --write to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
