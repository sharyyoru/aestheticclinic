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

async function main() {
  assertNotProduction();

  const runner = await getRunner();
  const steps = await buildSteps();

  if (!runner) {
    const combined = steps.map((s) => `-- ==== ${s.label} ====\n${s.sql}`).join("\n\n");
    const path = resolve(OUT_DIR, "provision-all.sql");
    writeFileSync(path, combined);
    console.log(`
Neither CAPTURE_DB_URL nor SUPABASE_ACCESS_TOKEN is set, and the anon/service_role
keys cannot execute DDL (PostgREST is a data plane only).

Everything needed has been written to:
  ${path}

To finish provisioning, either:
  a) add CAPTURE_DB_URL to .env.capture (Supabase → Project Settings → Database →
     Connection string → URI) and re-run this script, or
  b) paste the file above into the Supabase SQL editor for the capture project,
     then run: npx tsx scripts/academy/1-provision.ts --seed-only
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

  console.log("→ Row counts:");
  for (const table of [
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
  ]) {
    const res = await fetch(`${capture.url}/rest/v1/${table}?select=count`, {
      headers: {
        apikey: capture.serviceKey,
        Authorization: `Bearer ${capture.serviceKey}`,
        Prefer: "count=exact",
      },
    });
    const range = res.headers.get("content-range") ?? "?";
    console.log(`  ${table.padEnd(20)} ${res.ok ? range.split("/")[1] : `HTTP ${res.status}`}`);
  }

  await runner.close();
  console.log(`\nDone. ${applied} statements applied, ${failed} failed (tolerated).`);
}

main().catch((error) => {
  console.error(`\nProvisioning failed: ${(error as Error).message}`);
  process.exit(1);
});
