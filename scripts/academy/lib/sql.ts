import { Client } from "pg";
import { capture, projectRef } from "./env";

/**
 * Executes DDL against the capture project.
 *
 * Neither the anon nor the service_role key can run DDL — PostgREST is a data
 * plane only (verified: /rest/v1/rpc/query and /rpc/exec_sql both 404). So one
 * of the following is required, in order of preference:
 *
 *   1. CAPTURE_DB_URL          — direct Postgres connection (pure-JS `pg`, no psql needed)
 *   2. SUPABASE_ACCESS_TOKEN   — personal access token, via the Management API
 *   3. neither                 — SQL is written to disk for manual paste into the SQL editor
 */

export type SqlRunner = {
  kind: "postgres" | "management";
  run(sql: string, label: string): Promise<void>;
  close(): Promise<void>;
};

export function describeAvailableRunner(): "postgres" | "management" | "none" {
  if (capture.dbUrl) return "postgres";
  if (capture.accessToken) return "management";
  return "none";
}

async function postgresRunner(): Promise<SqlRunner> {
  const client = new Client({
    connectionString: capture.dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return {
    kind: "postgres",
    async run(sql, label) {
      try {
        await client.query(sql);
      } catch (error) {
        throw new Error(`[${label}] ${(error as Error).message}`);
      }
    },
    async close() {
      await client.end();
    },
  };
}

function managementRunner(): SqlRunner {
  const ref = projectRef(capture.url);
  return {
    kind: "management",
    async run(sql, label) {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${capture.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      if (!res.ok) {
        throw new Error(`[${label}] Management API HTTP ${res.status}: ${await res.text()}`);
      }
    },
    async close() {},
  };
}

export async function getRunner(): Promise<SqlRunner | null> {
  switch (describeAvailableRunner()) {
    case "postgres":
      return postgresRunner();
    case "management":
      return managementRunner();
    default:
      return null;
  }
}

/**
 * Splits a script into statements, keeping dollar-quoted blocks (DO $$ ... $$)
 * intact so enum guards and functions survive.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null;

  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!dollarTag && (trimmed.startsWith("--") || trimmed === "")) {
      if (trimmed.startsWith("--")) continue;
      if (current.trim() === "") continue;
    }

    current += line + "\n";

    const tags = line.match(/\$[a-zA-Z_]*\$/g) ?? [];
    for (const tag of tags) {
      if (!dollarTag) dollarTag = tag;
      else if (dollarTag === tag) dollarTag = null;
    }

    if (!dollarTag && /;\s*$/.test(line)) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}
