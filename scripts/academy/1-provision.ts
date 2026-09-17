/**
 * Builds the isolated capture database.
 *
 * Order matters:
 *   1. schema.generated.sql  — 105 tables + 17 enums from the production spec
 *   2. allowlisted repo migrations — functions, RLS policies, academy tables
 *   3. views.sql             — approximated view bodies
 *   4. capture user + seed_demo_data() + seed-capture-extras.sql
 *
 * Run: npm run academy:provision
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { capture, production, REPO_ROOT } from "./lib/env";
import { assertNotProduction } from "./lib/guards";
import { fetchSpec, generateDdl } from "./lib/ddlFromSpec";
import { getRunner, splitStatements } from "./lib/sql";

const OUT_DIR = resolve(REPO_ROOT, "scripts/academy/generated");
const SCRIPT_DIR = resolve(REPO_ROOT, "scripts/academy");

/**
 * Only migrations that create reusable database objects. Excluded: the 24
 * data-only one-offs, and in particular the four that operate on named real
 * individuals (005_reassign_wilson_tasks, 20260519_merge_burbuqe_fazliu,
 * 20260908_backfill_ekaterina_calendar, 20241217_demo_user_and_data) which are
 * meaningless — and misleading — on a synthetic database.
 */
const MIGRATION_ALLOWLIST = [
  "migrations/20241217_demo_mode_support.sql",
  "migrations/20241217_demo_rls_policies.sql",
  "migrations/20260829_seed_demo_data_function.sql",
  "migrations/20260910_academy_tables.sql",
];

type Step = { label: string; sql: string; tolerant?: boolean };

/**
 * Widens enums that the repo writes to but production's types do not accept.
 *
 * `workflows.trigger_type` is `public.workflow_trigger_type`, which in production
 * has only four values: deal_stage_changed, appointment_created,
 * appointment_updated, manual. But:
 *   - seed_demo_data() inserts patient_created, appointment_reminder and
 *     consultation_completed, which is why step 5 fails with 22P02
 *   - the workflows UI offers seven triggers, four of which the column cannot
 *     store at all (a genuine production bug, reported separately)
 *
 * Widening here keeps the capture database permissive so the seed runs and the
 * workflow screens look realistic. It does NOT fix production.
 */
const ENUM_WIDENING_SQL = `-- Capture-only enum widening. Run as its own statement batch:
-- ALTER TYPE ... ADD VALUE cannot be used by a statement in the same transaction.

-- Needed by seed_demo_data()
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'patient_created';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'appointment_reminder';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'consultation_completed';

-- Offered by the workflows UI but missing from the production enum
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'appointment_completed';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'form_submitted';
ALTER TYPE public.workflow_trigger_type ADD VALUE IF NOT EXISTS 'task_completed';
`;

async function buildSteps(): Promise<Step[]> {
  const steps: Step[] = [];

  console.log("→ Fetching the production schema spec (metadata only, zero rows read)…");
  const spec = await fetchSpec(production.url, production.serviceKey);
  const tableCount = Object.keys(spec.definitions).length;
  console.log(`  ${tableCount} definitions exposed.`);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const ddl = generateDdl(spec);
  const ddlPath = resolve(OUT_DIR, "schema.generated.sql");
  writeFileSync(ddlPath, ddl);
  console.log(`  Wrote ${basename(ddlPath)} (${(ddl.length / 1024).toFixed(0)} KB).`);

  steps.push({ label: "schema.generated.sql", sql: ddl, tolerant: true });

  for (const relative of MIGRATION_ALLOWLIST) {
    const path = resolve(REPO_ROOT, relative);
    if (!existsSync(path)) {
      console.warn(`  ! Skipping missing migration ${relative}`);
      continue;
    }
    steps.push({ label: relative, sql: readFileSync(path, "utf8"), tolerant: true });
  }

  steps.push({
    label: "views.sql (approximated)",
    sql: readFileSync(resolve(SCRIPT_DIR, "views.sql"), "utf8"),
    tolerant: true,
  });

  return steps;
}

async function createCaptureUser(): Promise<string> {
  const res = await fetch(`${capture.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: capture.serviceKey,
      Authorization: `Bearer ${capture.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: capture.userEmail,
      password: capture.userPassword,
      email_confirm: true,
    }),
  });

  if (res.ok) {
    const user = (await res.json()) as { id: string };
    console.log(`  Created auth user ${capture.userEmail}`);
    return user.id;
  }

  // Already exists — look it up instead.
  const list = await fetch(
    `${capture.url}/auth/v1/admin/users?filter=${encodeURIComponent(capture.userEmail)}`,
    {
      headers: { apikey: capture.serviceKey, Authorization: `Bearer ${capture.serviceKey}` },
    }
  );
  const body = (await list.json()) as { users?: { id: string; email: string }[] };
  const found = body.users?.find((u) => u.email === capture.userEmail);
  if (!found) throw new Error(`Could not create or find the capture user: ${await res.text()}`);
  console.log(`  Reusing existing auth user ${capture.userEmail}`);
  return found.id;
}

const VERIFY_TABLES = [
  "patients",
  "appointments",
  "consultations",
  "deals",
  "services",
  "invoices",
  "invoice_line_items",
  "invoice_payments",
  "dropped_calls",
  "embed_form_leads",
  "academy_modules",
];

async function reportRowCounts(): Promise<boolean> {
  console.log("→ Row counts:");
  let allPresent = true;
  for (const table of VERIFY_TABLES) {
    const res = await fetch(`${capture.url}/rest/v1/${table}?select=count`, {
      headers: {
        apikey: capture.serviceKey,
        Authorization: `Bearer ${capture.serviceKey}`,
        Prefer: "count=exact",
      },
    });
    const total = res.ok ? (res.headers.get("content-range") ?? "?").split("/")[1] : null;
    if (total === null) allPresent = false;
    console.log(`  ${table.padEnd(20)} ${total ?? `MISSING (HTTP ${res.status})`}`);
  }
  return allPresent;
}

/** Proves the supplied credential can actually run DDL, before anything else. */
async function testConnection(): Promise<void> {
  const runner = await getRunner();
  if (!runner) {
    console.log(
      "No DDL credential found. Add CAPTURE_DB_URL (preferred) or SUPABASE_ACCESS_TOKEN to .env.capture."
    );
    process.exit(1);
  }

  console.log(`→ Connected via ${runner.kind}`);
  try {
    await runner.run(
      "CREATE TABLE IF NOT EXISTS public.__devin_ddl_probe (id int); DROP TABLE public.__devin_ddl_probe;",
      "ddl probe"
    );
    console.log("→ DDL succeeded. Everything can be run from here.");
  } catch (error) {
    console.error(`→ Connected, but DDL failed: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

async function main() {
  assertNotProduction();

  if (process.argv.includes("--test-connection")) {
    await testConnection();
    return;
  }

  if (process.argv.includes("--verify")) {
    const ok = await reportRowCounts();
    console.log(
      ok
        ? "\nAll expected tables exist. Next: npm run academy:capture"
        : "\nSome tables are missing — re-run the numbered SQL parts that failed."
    );
    process.exit(ok ? 0 : 1);
  }

  const runner = await getRunner();
  const steps = await buildSteps();

  if (!runner) {
    // The SQL editor runs a pasted script as one transaction and aborts on the
    // first error, so emit numbered parts that can be pasted — and re-pasted —
    // independently rather than one all-or-nothing file.
    // Step 1 is schema.generated.sql, which is already written and committed —
    // no point duplicating 141 KB under a second name.
    const parts: { file: string; sql: string }[] = [];

    parts.push({
      file: "02-functions-and-policies.sql",
      sql: steps
        .slice(1, -1)
        .map((s) => `-- ==== ${s.label} ====\n${s.sql}`)
        .join("\n\n"),
    });
    parts.push({ file: "03-views.sql", sql: steps[steps.length - 1].sql });
    // Must be its own paste: ALTER TYPE ... ADD VALUE cannot be used by a
    // statement in the same transaction that added it.
    parts.push({ file: "04-enum-widening.sql", sql: ENUM_WIDENING_SQL });

    // The service_role key CAN create auth users, so the seed file can be
    // emitted with a concrete id rather than a placeholder.
    let seedSql: string;
    try {
      const userId = await createCaptureUser();
      seedSql = [
        `INSERT INTO public.users (id, email, full_name, role, is_demo)`,
        `VALUES ('${userId}', '${capture.userEmail}', 'Capture User', 'admin', true)`,
        `ON CONFLICT (id) DO UPDATE SET is_demo = true, role = 'admin';`,
        ``,
        `SELECT public.seed_demo_data('${userId}'::uuid);`,
        ``,
        readFileSync(resolve(SCRIPT_DIR, "seed-capture-extras.sql"), "utf8"),
      ].join("\n");
    } catch (error) {
      seedSql = `-- Could not create the capture auth user: ${(error as Error).message}\n`;
    }
    parts.push({ file: "05-seed.sql", sql: seedSql });

    for (const part of parts) writeFileSync(resolve(OUT_DIR, part.file), part.sql);

    console.log(`
Neither CAPTURE_DB_URL nor SUPABASE_ACCESS_TOKEN is set, and the anon/service_role
keys cannot execute DDL (PostgREST is a data plane only).

Run these in the Supabase SQL editor for the CAPTURE project, in order. Each is
independent and safe to re-run:

  1. scripts/academy/generated/schema.generated.sql
${parts.map((p, i) => `  ${i + 2}. scripts/academy/generated/${p.file}`).join("\n")}

Then verify with:
  npx tsx scripts/academy/1-provision.ts --verify

Or skip all of this by adding CAPTURE_DB_URL to .env.capture (Supabase →
Project Settings → Database → Connection string → URI) and re-running.
`);
    process.exit(2);
  }

  console.log(`→ Applying SQL via ${runner.kind}…`);
  let applied = 0;
  let failed = 0;

  for (const step of steps) {
    const statements = splitStatements(step.sql);
    let stepFailures = 0;
    for (const statement of statements) {
      try {
        await runner.run(statement, step.label);
        applied += 1;
      } catch (error) {
        stepFailures += 1;
        failed += 1;
        if (!step.tolerant) throw error;
        if (stepFailures <= 5) console.warn(`  ! ${(error as Error).message.split("\n")[0]}`);
      }
    }
    console.log(
      `  ${step.label}: ${statements.length - stepFailures}/${statements.length} statements applied`
    );
  }

  console.log("→ Creating the capture user…");
  const userId = await createCaptureUser();

  await runner.run(
    `INSERT INTO public.users (id, email, full_name, role, is_demo)
     VALUES ('${userId}', '${capture.userEmail}', 'Capture User', 'admin', true)
     ON CONFLICT (id) DO UPDATE SET is_demo = true, role = 'admin';`,
    "users row"
  );

  console.log("→ Seeding demo data…");
  await runner.run(`SELECT public.seed_demo_data('${userId}'::uuid);`, "seed_demo_data");

  const extras = readFileSync(resolve(SCRIPT_DIR, "seed-capture-extras.sql"), "utf8");
  for (const statement of splitStatements(extras)) {
    try {
      await runner.run(statement, "seed-capture-extras.sql");
    } catch (error) {
      console.warn(`  ! extras: ${(error as Error).message.split("\n")[0]}`);
      failed += 1;
    }
  }

  await reportRowCounts();

  await runner.close();
  console.log(`\nDone. ${applied} statements applied, ${failed} failed (tolerated).`);
}

main().catch((error) => {
  console.error(`\nProvisioning failed: ${(error as Error).message}`);
  process.exit(1);
});
