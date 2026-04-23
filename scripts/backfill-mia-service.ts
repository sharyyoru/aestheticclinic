/**
 * Backfill MIA service on existing deals whose title clearly states MIA.
 *
 * Steps:
 *   1. Ensure the TikTok service category + MIA service exist (create if missing).
 *   2. Find all deals whose title contains the standalone uppercase token MIA
 *      (case-sensitive \bMIA\b). This excludes patient names like "Mia",
 *      "Samia", "Adamian" where "mia" is lowercase or part of a larger word.
 *   3. Report the matches with their current service_id, and in --apply mode
 *      update each deal's service_id to point at TikTok/MIA.
 *
 * Usage:
 *   npx tsx scripts/backfill-mia-service.ts            # dry run
 *   npx tsx scripts/backfill-mia-service.ts --apply    # apply
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const apply = process.argv.includes("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Case-sensitive check: is "MIA" clearly the *service* being referenced,
 * not a patient name? The deal titles used in this codebase follow the
 * format "<First Last> - <Service>" so we prefer matching the service part
 * (after the last " - "). For titles without that separator we fall back to
 * matching the full title.
 */
function isMiaServiceTitle(title: string): boolean {
  if (!title) return false;
  const servicePart = title.includes(" - ")
    ? title.split(" - ").slice(-1)[0]
    : title;
  // Uppercase MIA as a standalone word. This rules out "Mia", "Samia",
  // "Adamian", "mian", etc. while still catching "MIA", "MIA BREAST
  // AUGMENTATION", "REPRISE MIA", "MIA (oxana liste)".
  return /\bMIA\b/.test(servicePart);
}

async function main() {
  console.log(`\n=== Backfill MIA service on deals (${apply ? "APPLY" : "DRY RUN"}) ===\n`);

  // 1. Ensure TikTok category
  let { data: tiktokCat } = await supabase
    .from("service_categories")
    .select("id, name")
    .eq("name", "TikTok")
    .maybeSingle();

  if (!tiktokCat) {
    console.log("TikTok category missing.");
    if (!apply) {
      console.log("  (dry run — would create it)");
    } else {
      const { data: created, error } = await supabase
        .from("service_categories")
        .insert({ name: "TikTok", description: "Services auto-created from TikTok Ads lead imports" })
        .select("id, name")
        .single();
      if (error) throw error;
      tiktokCat = created;
      console.log(`  Created TikTok category: ${tiktokCat!.id}`);
    }
  } else {
    console.log(`TikTok category: ${tiktokCat.id}`);
  }

  // 2. Ensure MIA service under TikTok
  let miaService: { id: string; name: string } | null = null;
  if (tiktokCat) {
    const { data: existing } = await supabase
      .from("services")
      .select("id, name")
      .eq("category_id", tiktokCat.id)
      .ilike("name", "MIA")
      .maybeSingle();

    if (existing) {
      miaService = existing;
      console.log(`TikTok/MIA service already exists: ${miaService.id}`);
    } else {
      console.log("TikTok/MIA service missing.");
      if (!apply) {
        console.log("  (dry run — would create it)");
      } else {
        const { data: created, error } = await supabase
          .from("services")
          .insert({
            name: "MIA",
            category_id: tiktokCat.id,
            description: "Auto-created for MIA breast augmentation TikTok leads",
            is_active: true,
          })
          .select("id, name")
          .single();
        if (error) throw error;
        miaService = created;
        console.log(`  Created TikTok/MIA service: ${miaService!.id}`);
      }
    }
  }

  // 3. Find candidate deals
  //    Cast a broad net with ilike %mia%, then filter with our strict
  //    case-sensitive regex to eliminate patient-name false positives.
  const { data: candidates, error: dealErr } = await supabase
    .from("deals")
    .select("id, title, service_id, created_at, patient_id, patients(first_name, last_name, source)")
    .ilike("title", "%mia%")
    .order("created_at", { ascending: false });

  if (dealErr) throw dealErr;

  const targets = (candidates || []).filter((d) => isMiaServiceTitle(d.title || ""));

  // Split: already pointing at MIA vs needs update
  const alreadyOk = miaService ? targets.filter((d) => d.service_id === miaService!.id) : [];
  const needsUpdate = miaService ? targets.filter((d) => d.service_id !== miaService!.id) : targets;

  console.log(`\n=== Deals found ===`);
  console.log(`Candidates (title ilike %mia%): ${candidates?.length ?? 0}`);
  console.log(`True MIA-service matches (case-sensitive \\bMIA\\b): ${targets.length}`);
  console.log(`Already pointing at TikTok/MIA: ${alreadyOk.length}`);
  console.log(`Need service_id update: ${needsUpdate.length}`);

  if (needsUpdate.length === 0) {
    console.log("\nNothing to update.");
    return;
  }

  console.log(`\nDeals to update:`);
  for (const d of needsUpdate) {
    const p = (d as any).patients;
    const src = p?.source || "unknown";
    console.log(`  ${d.id.slice(0, 8)} | ${d.title}`);
    console.log(`    patient: ${p?.first_name ?? ""} ${p?.last_name ?? ""} (source: ${src})`);
    console.log(`    service_id: ${d.service_id ?? "null"} -> ${miaService?.id ?? "(MIA not created — dry run)"}`);
  }

  if (!apply) {
    console.log(`\nRun with --apply to update ${needsUpdate.length} deal(s).`);
    return;
  }

  if (!miaService) {
    console.error("MIA service was not created — aborting update.");
    return;
  }

  let updated = 0;
  for (const d of needsUpdate) {
    const { error } = await supabase
      .from("deals")
      .update({ service_id: miaService.id })
      .eq("id", d.id);
    if (error) {
      console.error(`  ✗ Failed ${d.id.slice(0, 8)}:`, error.message);
    } else {
      console.log(`  ✓ Updated ${d.id.slice(0, 8)} (${d.title})`);
      updated++;
    }
  }
  console.log(`\n=== Done === Updated ${updated}/${needsUpdate.length} deals`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
