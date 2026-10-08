import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const REPO_ROOT = resolve(__dirname, "../../..");

/** Minimal .env parser — avoids adding a dotenv dependency for scripts. */
function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const captureEnv = parseEnvFile(resolve(REPO_ROOT, ".env.capture"));
const localEnv = parseEnvFile(resolve(REPO_ROOT, ".env.local"));

function read(name: string, source: Record<string, string>): string | undefined {
  return process.env[name] || source[name] || undefined;
}

function require_(name: string, source: Record<string, string>, hint: string): string {
  const value = read(name, source);
  if (!value) throw new Error(`Missing ${name}. ${hint}`);
  return value;
}

/**
 * Where screenshots and video are captured from.
 *
 * Originally an isolated project; that project was deleted and the clinic
 * accepted recording production, so these fall back to the production
 * credentials in .env.local rather than duplicating a service-role key into a
 * second file. Safety is no longer "capture a different database" — it is
 * `lib/readonly.ts`, which blocks every write in the browser.
 */
export const capture = {
  get url() {
    return read("CAPTURE_SUPABASE_URL", captureEnv) || production.url;
  },
  get anonKey() {
    return (
      read("CAPTURE_SUPABASE_ANON_KEY", captureEnv) ||
      require_("NEXT_PUBLIC_SUPABASE_ANON_KEY", localEnv, "Expected in .env.local")
    );
  },
  get serviceKey() {
    return read("CAPTURE_SUPABASE_SERVICE_ROLE_KEY", captureEnv) || production.serviceKey;
  },
  /** Optional: direct Postgres connection, required to apply DDL. */
  get dbUrl() {
    return read("CAPTURE_DB_URL", captureEnv);
  },
  /** Optional: Supabase personal access token, alternative DDL path. */
  get accessToken() {
    return read("SUPABASE_ACCESS_TOKEN", captureEnv);
  },
  get userEmail() {
    return require_("CAPTURE_USER_EMAIL", captureEnv, "Add the capture account to .env.capture");
  },
  get userPassword() {
    return require_(
      "CAPTURE_USER_PASSWORD",
      captureEnv,
      "Add the capture account password to .env.capture"
    );
  },
  get appUrl() {
    return require_(
      "CAPTURE_APP_URL",
      captureEnv,
      "Add the app URL to capture from to .env.capture"
    );
  },
  /** True when capture is pointed at the production project. */
  get isProduction() {
    try {
      return projectRef(capture.url) === projectRef(production.url);
    } catch {
      return false;
    }
  },
};

/** Narration settings. */
export const narration = {
  get provider(): "gemini" | "none" {
    return read("NARRATION_PROVIDER", captureEnv) === "none" ? "none" : "gemini";
  },
  get voice() {
    return read("NARRATION_VOICE", captureEnv) || "Kore";
  },
  get geminiApiKey() {
    return read("GEMINI_API_KEY", localEnv);
  },
};

/** Production — read-only, and only ever for schema metadata or publishing assets. */
export const production = {
  get url() {
    return require_("NEXT_PUBLIC_SUPABASE_URL", localEnv, "Expected in .env.local");
  },
  get serviceKey() {
    return require_("SUPABASE_SERVICE_ROLE_KEY", localEnv, "Expected in .env.local");
  },
};

export function projectRef(url: string): string {
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!match) throw new Error(`Cannot parse a project ref from ${url}`);
  return match[1];
}
