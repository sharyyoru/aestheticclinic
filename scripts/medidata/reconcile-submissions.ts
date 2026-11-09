/**
 * Retire redundant ACTIVE MediData submissions so that at most one live
 * submission exists per invoice.
 *
 * Why: the duplicate guard in /api/medidata/send-invoice stops NEW duplicates,
 * but the table already carries the ones created before it existed — 12
 * invoices with more than one active submission, one invoice sent 15 times.
 * The partial unique index in
 * supabase/migrations/20261106_medidata_unique_active_index.sql cannot be
 * created while they exist, so this must run FIRST.
 *
 * What it does NOT do:
 *   - delete anything. Rows carry the MediData transmission reference and the
 *     insurer's response; that is the audit trail for money. Redundant rows
 *     are flagged is_superseded instead.
 *   - transmit anything to MediData or send a Storno. This is a data-only
 *     reconciliation of records already sent.
 *   - apply insurer responses to parent submissions.
 *
 * Which row survives, in order:
 *   1. an `accepted` row beats any other status — the insurer settled on it;
 *   2. then a row that holds a MediData transmission reference, because that
 *      is the one the insurer can actually be asked about;
 *   3. then the most recent, since that is what the insurer saw last.
 *
 * Idempotent. Run: npx tsx scripts/medidata/reconcile-submissions.ts
 *                  npx tsx scripts/medidata/reconcile-submissions.ts --confirm
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const CONFIRM = process.argv.includes("--confirm");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Statuses the guard and the unique index treat as live. */
const ACTIVE = ["pending", "transmitted", "delivered", "accepted"];

type Submission = {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  status: string | null;
  is_storno: boolean | null;
  is_superseded: boolean | null;
  medidata_message_id: string | null;
  created_at: string | null;
};

function rank(s: Submission): [number, number, number] {
  return [
    s.status === "accepted" ? 1 : 0,
    s.medidata_message_id ? 1 : 0,
    new Date(s.created_at ?? 0).getTime(),
  ];
}

/** Highest rank wins, compared left to right. */
function keeper(subs: Submission[]): Submission {
  return [...subs].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (rb[i] !== ra[i]) return rb[i] - ra[i];
    return 0;
  })[0];
}

async function main() {
  const { data, error } = await supabase
    .from("medidata_submissions")
    .select(
      "id, invoice_id, invoice_number, status, is_storno, is_superseded, medidata_message_id, created_at",
    )
    .not("invoice_id", "is", null)
    .limit(10000);

  if (error) {
    // is_superseded arrives in 20261106_medidata_superseded_flag.sql.
    if (/is_superseded/.test(error.message)) {
      console.error(
        "medidata_submissions.is_superseded does not exist yet.\n" +
          "Apply supabase/migrations/20261106_medidata_superseded_flag.sql first.",
      );
      process.exit(1);
    }
    throw new Error(error.message);
  }

  const byInvoice = new Map<string, Submission[]>();
  for (const row of (data ?? []) as Submission[]) {
    if (row.is_storno || row.is_superseded) continue;
    if (!ACTIVE.includes(String(row.status))) continue;
    const list = byInvoice.get(row.invoice_id!) ?? [];
    list.push(row);
    byInvoice.set(row.invoice_id!, list);
  }

  const offenders = [...byInvoice.entries()].filter(([, subs]) => subs.length > 1);
  if (!offenders.length) {
    console.log("No invoice has more than one active submission. Index can be created.");
    return;
  }

  console.log(
    `${offenders.length} invoice(s) have multiple active submissions ` +
      `(${offenders.reduce((a, [, s]) => a + s.length - 1, 0)} rows to retire).\n`,
  );

  const toRetire: Submission[] = [];
  for (const [, subs] of offenders) {
    const keep = keeper(subs);
    const retire = subs.filter((s) => s.id !== keep.id);
    toRetire.push(...retire);
    console.log(
      `${(keep.invoice_number ?? "?").padEnd(16)} keep ${keep.status}` +
        `${keep.medidata_message_id ? " (ref " + keep.medidata_message_id + ")" : " (no ref)"}` +
        ` · retire ${retire.length}: ${retire.map((r) => r.status).join(", ")}`,
    );
  }

  if (!CONFIRM) {
    console.log(`\nDry run — ${toRetire.length} row(s) would be marked is_superseded.`);
    console.log("Re-run with --confirm to apply, then run the unique-index migration.");
    return;
  }

  let done = 0;
  for (const row of toRetire) {
    const { error: upErr } = await supabase
      .from("medidata_submissions")
      .update({ is_superseded: true, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (upErr) {
      console.error(`  ! ${row.id}: ${upErr.message}`);
      continue;
    }
    done++;
  }
  console.log(`\nRetired ${done}/${toRetire.length} redundant submission(s).`);
  console.log("Now apply supabase/migrations/20261106_medidata_unique_active_index.sql");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
