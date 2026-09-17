/**
 * Generates CREATE TABLE DDL from a PostgREST OpenAPI spec.
 *
 * Why this exists: 27 tables and 3 views the app queries have no CREATE TABLE
 * anywhere in the repo — including the whole billing core (`invoices` has 71
 * columns). `supabase/schema.sql` is a stale snapshot with 41 tables. So the
 * repo cannot rebuild a working database, but the spec endpoint can: it exposes
 * every column, type, default, primary key and foreign key while reading zero
 * rows of data.
 *
 * Known gaps (acceptable for a capture database): no triggers, no check
 * constraints beyond enums, no functions. None of these affect rendering.
 */

export type Spec = {
  definitions: Record<
    string,
    {
      required?: string[];
      properties?: Record<
        string,
        {
          type?: string;
          format?: string;
          default?: unknown;
          description?: string;
          enum?: string[];
        }
      >;
    }
  >;
};

/** Import-staging tables from historical data migrations — not needed to render. */
const SKIP_PREFIXES = ["tmp_"];
/** Views are created separately from views.sql; they cannot be inferred. */
const isView = (name: string) => name.startsWith("v_");

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function columnType(format: string | undefined, type: string | undefined): string {
  if (!format) return type === "object" ? "jsonb" : "text";
  // PostgREST reports the real Postgres type in `format`, including enums as
  // `public.<enum_name>` and arrays as `text[]`.
  return format;
}

/**
 * PostgREST reports defaults with the type cast and quotes stripped, so a text
 * column defaulting to 'OPEN' arrives as the bare word `OPEN`, which is invalid
 * SQL if emitted verbatim. Distinguish expressions from literals.
 */
export function renderDefault(
  raw: unknown,
  format: string | undefined
): { kind: "identity" } | { kind: "expr"; sql: string } | null {
  if (typeof raw === "number" || typeof raw === "boolean") {
    return { kind: "expr", sql: String(raw) };
  }
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (/nextval\(/i.test(value)) return { kind: "identity" };
  if (value === "") return { kind: "expr", sql: "''" };

  // Function calls, casts and parenthesised expressions pass through untouched.
  if (/[()]/.test(value) || value.includes("::")) return { kind: "expr", sql: value };
  if (/^(CURRENT_DATE|CURRENT_TIMESTAMP|CURRENT_TIME|LOCALTIMESTAMP|NULL|TRUE|FALSE)$/i.test(value)) {
    return { kind: "expr", sql: value };
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return { kind: "expr", sql: value };

  const literal = `'${value.replace(/'/g, "''")}'`;
  // JSON literals need an explicit cast; so do enums, or Postgres cannot infer.
  if (/^[[{]/.test(value)) return { kind: "expr", sql: `${literal}::jsonb` };
  if (format?.startsWith("public.")) return { kind: "expr", sql: `${literal}::${format}` };
  return { kind: "expr", sql: literal };
}

function parseKeys(description: string | undefined): {
  isPrimary: boolean;
  foreign?: { table: string; column: string };
} {
  if (!description) return { isPrimary: false };
  const isPrimary = /<pk\/>/.test(description);
  const fk = description.match(/<fk table='([^']+)' column='([^']+)'\/>/);
  return {
    isPrimary,
    foreign: fk ? { table: fk[1], column: fk[2] } : undefined,
  };
}

/**
 * Each constraint is wrapped so one imperfection cannot abort the whole script.
 * This matters because the Supabase SQL editor runs a pasted script in a single
 * transaction: without this, the first failure rolls back all 105 tables.
 */
function tolerant(sql: string): string {
  // A single `WHEN others` handler on purpose. A multi-condition EXCEPTION list
  // requires a semicolon after every handler's statement list, which is easy to
  // get wrong and produced "42601: syntax error at or near WHEN".
  return `DO $$
BEGIN
  ${sql}
EXCEPTION
  WHEN others THEN RAISE NOTICE 'skipped %: %', SQLSTATE, SQLERRM;
END
$$;`;
}

export function generateDdl(spec: Spec): string {
  const enums = new Map<string, string[]>();
  const tables: string[] = [];
  // Primary keys must be created before any foreign key references them, or
  // Postgres reports "no unique constraint matching given keys".
  const primaryKeyConstraints: string[] = [];
  const foreignKeyConstraints: string[] = [];
  const skipped: string[] = [];
  const creatableTables = new Set(
    Object.keys(spec.definitions).filter(
      (name) => !isView(name) && !SKIP_PREFIXES.some((p) => name.startsWith(p))
    )
  );

  // Collect enum types first — tables depend on them.
  for (const def of Object.values(spec.definitions)) {
    for (const prop of Object.values(def.properties ?? {})) {
      if (prop.format?.startsWith("public.") && prop.enum) {
        enums.set(prop.format.replace(/^public\./, ""), prop.enum);
      }
    }
  }

  const names = Object.keys(spec.definitions).sort();

  for (const name of names) {
    if (isView(name) || SKIP_PREFIXES.some((p) => name.startsWith(p))) {
      skipped.push(name);
      continue;
    }

    const def = spec.definitions[name];
    const properties = def.properties ?? {};
    const required = new Set(def.required ?? []);
    const primaryKeys: string[] = [];
    const columnLines: string[] = [];

    for (const [column, prop] of Object.entries(properties)) {
      const { isPrimary, foreign } = parseKeys(prop.description);
      if (isPrimary) primaryKeys.push(column);

      let line = `  ${quoteIdent(column)} ${columnType(prop.format, prop.type)}`;

      const rawDefault = prop.default;
      const rendered = rawDefault === undefined ? null : renderDefault(rawDefault, prop.format);
      if (rendered?.kind === "identity") {
        // Recreate identity rather than chase sequence names.
        line += " GENERATED BY DEFAULT AS IDENTITY";
      } else if (rendered?.kind === "expr") {
        line += ` DEFAULT ${rendered.sql}`;
      }

      // NOT NULL is deliberately NOT reproduced (beyond the implicit primary key).
      // There are 207 non-PK NOT NULL columns without defaults across 93 tables;
      // any of them can abort a seed insert or a record created while recording a
      // video. A capture database only has to render screens, so relaxing this
      // removes a large class of failures and costs nothing we care about.
      void required;

      columnLines.push(line);

      // Skip references to tables we do not create (views, import staging).
      if (foreign && creatableTables.has(foreign.table)) {
        foreignKeyConstraints.push(
          tolerant(
            `ALTER TABLE public.${quoteIdent(name)} ADD CONSTRAINT ${quoteIdent(
              `${name}_${column}_fkey`
            )} FOREIGN KEY (${quoteIdent(column)}) REFERENCES public.${quoteIdent(
              foreign.table
            )}(${quoteIdent(foreign.column)}) ON DELETE SET NULL;`
          )
        );
      }
    }

    if (columnLines.length === 0) {
      skipped.push(`${name} (no columns)`);
      continue;
    }

    tables.push(
      `CREATE TABLE IF NOT EXISTS public.${quoteIdent(name)} (\n${columnLines.join(",\n")}\n);`
    );

    if (primaryKeys.length > 0) {
      primaryKeyConstraints.push(
        tolerant(
          `ALTER TABLE public.${quoteIdent(name)} ADD CONSTRAINT ${quoteIdent(
            `${name}_pkey`
          )} PRIMARY KEY (${primaryKeys.map(quoteIdent).join(", ")});`
        )
      );
    }
  }

  const enumSql = [...enums.entries()].map(
    ([name, values]) => `DO $$ BEGIN
  CREATE TYPE public.${quoteIdent(name)} AS ENUM (${values
    .map((v) => `'${v.replace(/'/g, "''")}'`)
    .join(", ")});
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  );

  return [
    "-- GENERATED FILE — do not edit by hand.",
    "-- Source: production PostgREST schema spec (schema metadata only, zero rows read).",
    "-- Regenerate with: npm run academy:provision",
    "--",
    "-- This is a CAPTURE database: its only job is to render screens for screenshots",
    "-- and video. It is deliberately NOT a faithful copy of production:",
    "--   * NOT NULL is not reproduced (except implicit primary keys)",
    "--   * no triggers, no check constraints beyond enums, no functions",
    "-- Both make inserts more permissive, which is what we want here and would be",
    "-- wrong anywhere else. Never point an application at this database.",
    `-- Tables: ${tables.length} | Enums: ${enums.size} | PKs: ${primaryKeyConstraints.length}` +
      ` | FKs: ${foreignKeyConstraints.length} | Skipped: ${skipped.length}`,
    `-- Skipped (views are in views.sql; tmp_* are historical import staging): ${skipped.join(", ")}`,
    "",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    "",
    "-- Enum types",
    ...enumSql,
    "",
    "-- Tables",
    ...tables,
    "",
    "-- Primary keys — must precede the foreign keys that reference them.",
    ...primaryKeyConstraints,
    "",
    "-- Foreign keys. Each is tolerant: a missing one relaxes integrity but does",
    "-- not stop a screen rendering, and must not abort the rest of the script.",
    ...foreignKeyConstraints,
    "",
  ].join("\n\n");
}

export async function fetchSpec(url: string, serviceKey: string): Promise<Spec> {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/openapi+json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Could not read the schema spec (HTTP ${res.status}). This endpoint requires the service_role key.`
    );
  }
  return (await res.json()) as Spec;
}
