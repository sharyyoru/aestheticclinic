/**
 * Find and fix invoice_line_items with TARDOC ref_codes that will be rejected
 * by Sumex's Zuschlag (supplement) validation rules.
 *
 * Strategy:
 *   1. Collect all unique (code, ref_code) pairs from invoice_line_items
 *      where tariff_code = 7 (TARDOC).
 *   2. For each pair, call the Sumex TARDOC validator's IValidate.AddService
 *      with just that pair. If the validator rejects it with a Zuschlag-rule
 *      abort, mark the pair as invalid.
 *   3. Report all affected rows (dry run).
 *   4. In --apply mode, clear ref_code on every row whose (code, ref_code)
 *      pair was flagged invalid.
 *
 * Usage:
 *   npx tsx scripts/fix-invalid-tardoc-refcodes.ts            # Dry run
 *   npx tsx scripts/fix-invalid-tardoc-refcodes.ts --apply    # Apply
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const applyMode = process.argv.includes("--apply");
const SUMEX_BASE_URL =
  process.env.SUMEX_TARDOC_URL ||
  "http://34.100.230.253:8080/tardocValidatorServer100";

// ---------------------------------------------------------------------------
// Sumex low-level helpers (mirrors src/lib/sumexTardoc.ts)
// ---------------------------------------------------------------------------
async function getProperty<T>(iface: string, prop: string, handle: number, handleParam?: string): Promise<T> {
  const param = handleParam || `p${iface}`;
  const url = `${SUMEX_BASE_URL}/${iface}/Get${prop}?${param}=${handle}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${iface}/Get${prop} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
async function callMethod<T>(iface: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = `${SUMEX_BASE_URL}/${iface}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  // Sumex returns HTTP 422 with a JSON body when business-logic validation
  // rejects (pbStatus:false). We must parse the body either way.
  // Only treat true protocol errors (4xx/5xx with no JSON body) as errors.
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`POST ${iface}/${method} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return parsed as T;
}
async function createSubInterface(validatorHandle: number, sub: string): Promise<number> {
  const data = await getProperty<Record<string, number>>("ITardocValidator", `Create${sub}`, validatorHandle);
  const key = `pI${sub}`;
  if (!(key in data)) throw new Error(`Missing ${key} in response`);
  return data[key];
}

let cachedValidatorHandle: number | null = null;
async function getValidator(): Promise<number> {
  if (cachedValidatorHandle) return cachedValidatorHandle;
  const factoryRes = await fetch(`${SUMEX_BASE_URL}/ITardocValidator/GetCreateTardocValidator`, { cache: "no-store" });
  if (!factoryRes.ok) throw new Error("Failed to create TardocValidator");
  const factoryData = (await factoryRes.json()) as { pITardocValidator: number };
  const handle = factoryData.pITardocValidator;
  const openRes = await callMethod<{ pbStatus: boolean }>("ITardocValidator", "Open", {
    pITardocValidator: handle,
    eLanguage: 2,
  });
  if (!openRes.pbStatus) throw new Error("Failed to open TardocValidator");
  cachedValidatorHandle = handle;
  return handle;
}

// ---------------------------------------------------------------------------
// Per-pair validation
// ---------------------------------------------------------------------------
type ValidateResult = {
  accepted: boolean;
  errorMessage: string;
};

async function setupContext(validateHandle: number, tardocInputHandle: number): Promise<void> {
  await callMethod("IValidate", "Initialize", { pIValidate: validateHandle });
  await callMethod("ITardocInput", "Initialize", { pITardocInput: tardocInputHandle });

  await callMethod("ITardocInput", "SetPhysician", {
    pITardocInput: tardocInputHandle,
    eMedicalRole: 1, eBillingRole: 3,
    bstrGLNProvider: "", bstrGLNResponsible: "", bstrMedicalSectionCode: "",
  });
  await callMethod("ITardocInput", "SetPatient", {
    pITardocInput: tardocInputHandle,
    dBirthdate: "1980-01-01", eSex: 0,
  });
  // Geneva (8), KVG (1), Ambulatory (0). bstrGLNSection required.
  await callMethod("ITardocInput", "SetTreatment", {
    pITardocInput: tardocInputHandle,
    eCanton: 8, eLaw: 1, eTreatment: 0, bstrGLNSection: "",
  });
}

async function addOneService(
  validateHandle: number,
  tardocInputHandle: number,
  code: string,
  refCode: string,
  hook: number,
): Promise<{ accepted: boolean; status: number; abortInfo: string }> {
  const today = new Date().toISOString().split("T")[0];
  const addRes = await callMethod<{ plStatus: number; pbStatus: boolean }>(
    "IValidate", "AddService",
    {
      pIValidate: validateHandle,
      pITardocInput: tardocInputHandle,
      bstrCode: code,
      bstrReferenceCode: refCode,
      dQuantity: 1,
      lSessionNumber: 1,
      dDate: today,
      eSide: 0,
      dTPValue_MT: 0.93,
      dExternalFactor_MT: 1,
      dTPValue_TT: 0.93,
      dExternalFactor_TT: 1,
      eIgnoreValidate: 0,
      lHook: hook,
    },
  );
  let abortInfo = "";
  if (!addRes.pbStatus) {
    try {
      const ab = await callMethod<{ pbstrAbort: string; pbstrInfo?: string }>(
        "IValidate", "GetAbortInfo", { pIValidate: validateHandle },
      );
      abortInfo = ab.pbstrAbort || ab.pbstrInfo || "";
    } catch { /* ignore */ }
  }
  return { accepted: addRes.pbStatus, status: addRes.plStatus, abortInfo };
}

async function validatePair(code: string, refCode: string): Promise<ValidateResult> {
  const validatorHandle = await getValidator();
  const validateHandle = await createSubInterface(validatorHandle, "Validate");
  const tardocInputHandle = await createSubInterface(validatorHandle, "TardocInput");

  try {
    await setupContext(validateHandle, tardocInputHandle);
  } catch (err) {
    return {
      accepted: false,
      errorMessage: `Setup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 1. Add the base code (refCode) first — this provides the context
  //    a supplement needs. If the base itself is rejected, we can't judge
  //    the pair cleanly, so we bail.
  const baseRes = await addOneService(validateHandle, tardocInputHandle, refCode, "", 1);
  if (!baseRes.accepted) {
    // Base alone failed — likely the refCode is not a valid standalone code
    // in TARDOC. That itself means the pair is bogus as a Zuschlag link.
    return {
      accepted: false,
      errorMessage: `Base '${refCode}' rejected (status=${baseRes.status}): ${baseRes.abortInfo || "unknown"}`,
    };
  }

  // 2. Now add the supplement pointing at the base.
  const supRes = await addOneService(validateHandle, tardocInputHandle, code, refCode, 2);
  if (supRes.accepted) {
    return { accepted: true, errorMessage: "" };
  }
  return {
    accepted: false,
    errorMessage: supRes.abortInfo || `Rejected (status=${supRes.status})`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Fix invalid TARDOC ref_codes (${applyMode ? "APPLY" : "DRY RUN"}) ===\n`);
  console.log(`Sumex URL: ${SUMEX_BASE_URL}`);

  // 1. Fetch all TARDOC line items with ref_code set
  const { data: items, error } = await supabase
    .from("invoice_line_items")
    .select("id, invoice_id, code, tardoc_code, ref_code, tariff_code, name")
    .eq("tariff_code", 7)
    .not("ref_code", "is", null)
    .neq("ref_code", "");

  if (error) {
    console.error("Failed to fetch:", error);
    return;
  }
  console.log(`Found ${items!.length} TARDOC line items with ref_code set\n`);

  // 2. Group by unique (code, ref_code) pair
  type Pair = { code: string; refCode: string; rowIds: string[]; rowRefs: Array<{ id: string; invoice_id: string; name: string | null }> };
  const pairMap = new Map<string, Pair>();
  for (const it of items!) {
    const code = (it.code || it.tardoc_code || "").trim();
    const refCode = (it.ref_code || "").trim();
    if (!code || !refCode) continue;
    const key = `${code}|${refCode}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, { code, refCode, rowIds: [], rowRefs: [] });
    }
    pairMap.get(key)!.rowIds.push(it.id);
    pairMap.get(key)!.rowRefs.push({ id: it.id, invoice_id: it.invoice_id, name: it.name });
  }
  const pairs = [...pairMap.values()];
  console.log(`Unique (code, ref_code) pairs to validate: ${pairs.length}\n`);

  // 3. Validate each pair
  const invalidPairs: Array<{ pair: Pair; error: string }> = [];
  const validPairs: Pair[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    process.stdout.write(`  [${i + 1}/${pairs.length}] ${p.code} -> ${p.refCode} ... `);
    try {
      const result = await validatePair(p.code, p.refCode);
      if (result.accepted) {
        console.log("OK");
        validPairs.push(p);
      } else {
        console.log(`INVALID: ${result.errorMessage}`);
        invalidPairs.push({ pair: p, error: result.errorMessage });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`NETWORK ERROR: ${msg}`);
      // Don't treat network errors as "invalid" — skip
    }
  }

  // 4. Classify errors
  //    - STRUCTURAL: a pair-wide data bug that will always fail regardless of
  //      the specific invoice row. These are safe to auto-clear.
  //    - CONTEXTUAL: errors triggered by the generic test context
  //      (dummy birthdate / no side). The real invoice row may be fine.
  //      We report but do NOT auto-clear these.
  function classify(errorMessage: string): "structural" | "contextual" {
    const msg = errorMessage.toLowerCase();
    // Category 1: the exact Zuschlag relationship is forbidden by TARDOC
    if (msg.includes("kann nicht als zuschlag")) return "structural";
    // Category 2: the "base" is itself a Zuschlag — it cannot serve as a base
    if (msg.includes("muss eine referenzleistung angegeben werden")) return "structural";
    // Everything else (age, side, sex, qualification, …) depends on
    // per-invoice context — skip auto-fix.
    return "contextual";
  }

  const structural: Array<{ pair: Pair; error: string }> = [];
  const contextual: Array<{ pair: Pair; error: string }> = [];
  for (const entry of invalidPairs) {
    if (classify(entry.error) === "structural") structural.push(entry);
    else contextual.push(entry);
  }

  console.log(`\n=== Results ===`);
  console.log(`Valid pairs: ${validPairs.length}`);
  console.log(`Invalid pairs: ${invalidPairs.length}`);
  console.log(`  Structural (will clear ref_code): ${structural.length}`);
  console.log(`  Contextual (skipped — manual review): ${contextual.length}`);

  if (contextual.length > 0) {
    console.log(`\nContextual failures (NOT auto-fixed — may be false positives due to`);
    console.log(`the generic test context: birthdate 1980-01-01, no side indication):`);
    for (const { pair, error } of contextual) {
      console.log(`  ${pair.code} -> ${pair.refCode} (${pair.rowIds.length} rows)`);
      console.log(`    Error: ${error}`);
    }
  }

  if (structural.length === 0) {
    console.log("\nNo structural errors to fix.");
    return;
  }

  let totalRows = 0;
  console.log(`\nStructural errors (ref_code will be cleared):`);
  for (const { pair, error } of structural) {
    console.log(`  ${pair.code} -> ${pair.refCode} (${pair.rowIds.length} rows)`);
    console.log(`    Error: ${error}`);
    totalRows += pair.rowIds.length;
  }
  console.log(`\nTotal line-item rows affected: ${totalRows}`);

  if (!applyMode) {
    console.log(`\nRun with --apply to clear ref_code on these ${totalRows} rows.`);
    return;
  }

  // 5. Apply fix
  console.log(`\n=== Applying fix ===`);
  let updated = 0;
  for (const { pair } of structural) {
    const { error: updErr } = await supabase
      .from("invoice_line_items")
      .update({ ref_code: null })
      .in("id", pair.rowIds);

    if (updErr) {
      console.error(`  ✗ Failed to update ${pair.code} -> ${pair.refCode}:`, updErr);
    } else {
      console.log(`  ✓ Cleared ref_code on ${pair.rowIds.length} rows (${pair.code} -> ${pair.refCode})`);
      updated += pair.rowIds.length;
    }
  }

  console.log(`\n=== Done === Updated ${updated}/${totalRows} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
