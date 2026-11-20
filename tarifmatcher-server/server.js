/**
 * OAAT TarifMatcher HTTP wrapper.
 *
 * The ambulatory flat-rate grouper (gestures + ICD-10 -> flat rate) is a Java
 * library. Vercel's Node runtime has no JVM, so /api/acf/sumex cannot call it
 * in-process — the same reason the old Sumex1 validator lived on its own box.
 * This is a small service around the official jar, deployed the same way the
 * WhatsApp server is.
 *
 * It shells out to the batch grouper rather than binding the Java API: the
 * CLI is the vendor's supported entry point, so the grouping semantics stay
 * theirs rather than becoming a reimplementation we would have to keep
 * correct against 483 decision-tree expressions.
 *
 *   POST /group  { services: ["C09.AC.0140"], diagnoses: ["N64.8"],
 *                  ageYears?: 45, drugs?: [], caseId?: "inv-1009515" }
 *     -> { ok, flatRate: "C09.18B", costWeight: 4525.22, mappedTardocs: [],
 *          applicationYear: 2027, version: "V1.2_lk" }
 *   GET  /health -> { ok, java, applicationYear, version, catalogues }
 */
const http = require("node:http");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = process.env.PORT || 8080;
const DIR = __dirname;
const JAR = path.join(DIR, "tarifmatcher-1.2.1-standalone.jar");
const T = (f) => path.join(DIR, "tariffs", f);

// The jar ships with a broken manifest — Main-Class is declared as
// "...Batchgrouper.java", with the .java suffix, so `java -jar` cannot find
// the class. Invoke it on the classpath instead.
const MAIN_CLASS = "ch.oaat_otma.grouper.batchgrouper.Batchgrouper";

/**
 * One tariff set per application year. A treatment must be grouped with the
 * tariff in force on its own service date: pricing 2026 work with the 2027
 * system produces the wrong flat rate, which is worse than not grouping.
 *
 * The 2026 bundle predates `min_tarifmatcher_version` (introduced in 1.2.0),
 * so that key is absent and the 1.2.1 jar reads it without complaint — one
 * engine serves both years.
 */
const TARIFFS = {
  2026: {
    system: T("system_ambP_11c_260402_lkaat.json"),
    catalogue: T("catalog_ambP_11c.csv"),
    lkaat: T("lkaat_1.0c_251128.json"),
    tardoc: T("tardoc_TARDOC_1.4c_251128_fr.json"),
  },
  2027: {
    system: T("system_ambP_12_lkaat.json"),
    catalogue: T("catalog_ambP_12.csv"),
    lkaat: T("lkaat_1.1.json"),
    tardoc: T("tardoc_TARDOC_1.5_fr.json"),
  },
};

const SUPPORTED_YEARS = Object.keys(TARIFFS).map(Number).sort();
const DEFAULT_YEAR = SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];

function tariffsFor(year) {
  return TARIFFS[year] || null;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

/**
 * The grouper reads a semicolon-separated file whose header names the PCS
 * variables (id, age_years, services, diagnoses, drugs). List values are
 * comma-separated inside their field. Anything containing ; or , would
 * corrupt the row, so codes are validated rather than escaped — a tariff code
 * never legitimately contains either.
 */
const CODE_RE = /^[A-Za-z0-9._-]{1,32}$/;

function buildInputCsv(cases) {
  const rows = ["id;age_years;services;diagnoses;drugs"];
  for (const c of cases) {
    const services = (c.services || []).filter((s) => CODE_RE.test(s));
    const diagnoses = (c.diagnoses || []).filter((d) => CODE_RE.test(d));
    const drugs = (c.drugs || []).filter((d) => CODE_RE.test(d));
    const id = CODE_RE.test(String(c.caseId ?? "")) ? String(c.caseId) : "case";
    const age = Number.isFinite(Number(c.ageYears)) ? Number(c.ageYears) : "";
    rows.push(`${id};${age};${services.join(",")};${diagnoses.join(",")};${drugs.join(",")}`);
  }
  return rows.join("\n") + "\n";
}

function runGrouper(csv, t) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `tm-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
    fs.writeFileSync(tmp, csv, "utf8");
    execFile(
      "java",
      ["-cp", JAR, MAIN_CLASS, "-cat", t.catalogue, "-lkaat", t.lkaat, "-tardoc", t.tardoc, "-map", t.system, tmp],
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        fs.unlink(tmp, () => {});
        if (err) return reject(new Error(`${err.message} ${String(stderr).slice(0, 400)}`));
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

/** Output is `ID;KaP;tax_points;mapped_tardocs`, one row per case. */
function parseOutput(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  const header = (lines.shift() || "").split(";").map((h) => h.trim().toLowerCase());
  const idx = (n) => header.indexOf(n);
  return lines.map((line) => {
    const cols = line.split(";");
    const weight = Number(cols[idx("tax_points")]);
    return {
      caseId: cols[idx("id")] ?? null,
      flatRate: cols[idx("kap")] || null,
      costWeight: Number.isFinite(weight) ? weight : null,
      mappedTardocs: (cols[idx("mapped_tardocs")] || "").split(",").map((s) => s.trim()).filter(Boolean),
    };
  });
}

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  // A shared secret keeps this from being an open grouping endpoint once it
  // is on the public internet. Unset = open, which is fine locally only.
  const secret = process.env.TARIFMATCHER_SECRET;
  if (secret && req.headers["x-tarifmatcher-secret"] !== secret && req.url !== "/health") {
    return send(res, 401, { ok: false, error: "Unauthorized" });
  }

  if (req.method === "GET" && req.url === "/health") {
    const missing = [JAR, ...SUPPORTED_YEARS.flatMap((y) => Object.values(TARIFFS[y]))].filter((f) => !fs.existsSync(f));
    return send(res, missing.length ? 503 : 200, {
      ok: missing.length === 0,
      supportedYears: SUPPORTED_YEARS,
      missing: missing.map((f) => path.basename(f)),
    });
  }

  if (req.method === "POST" && req.url === "/group") {
    try {
      const body = await readJson(req);
      const cases = Array.isArray(body.cases) ? body.cases : [body];
      if (!cases.length || !cases.some((c) => (c.services || []).length)) {
        return send(res, 400, { ok: false, error: "At least one service code is required" });
      }
      // The tariff in force on the service date, not "the newest we have".
      const requested = Number(body.applicationYear) ||
        (body.serviceDate ? new Date(body.serviceDate).getFullYear() : DEFAULT_YEAR);
      const tariffs = tariffsFor(requested);
      if (!tariffs) {
        return send(res, 400, {
          ok: false,
          error: `No tariff loaded for application year ${requested}. Loaded: ${SUPPORTED_YEARS.join(", ")}.`,
          supportedYears: SUPPORTED_YEARS,
        });
      }
      const { stdout, stderr } = await runGrouper(buildInputCsv(cases), tariffs);
      const results = parseOutput(stdout);
      return send(res, 200, {
        ok: true,
        applicationYear: requested,
        results,
        // Surfaced rather than swallowed: the grouper reports unknown codes
        // and unusable rows here, and that is exactly what a biller needs.
        warnings: stderr.trim() ? stderr.trim().split(/\r?\n/).slice(0, 20) : [],
      });
    } catch (e) {
      return send(res, 500, { ok: false, error: String(e.message).slice(0, 500) });
    }
  }

  return send(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, () => console.log(`[tarifmatcher] listening on ${PORT}`));
