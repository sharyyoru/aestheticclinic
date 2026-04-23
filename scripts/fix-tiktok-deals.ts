/**
 * One-off maintenance script: fix TikTok leads that were imported with a
 * broken CSV parser. Their deal titles look like
 *   "Brigitte ESPERON - 7618286701663748359"
 * because the old parser mis-mapped TikTok's `form_id` column into the Form
 * slot (so `detectedService` became the numeric form_id).
 *
 * The xlsx file `docs/sample-imports/lead_generation_0_2026-04-13.numbers`
 * / `.xlsx` that was originally uploaded has form_name="MIA | consultations"
 * for every row, which maps cleanly to the "Consultation" service.
 *
 * Strategy:
 *   1. Find all deals with a title ending in " - 7618…" (TikTok form_id).
 *   2. Replace the service suffix with "Consultation".
 *   3. If a "Consultation" service exists in the services table and the
 *      deal's service_id is still null, populate it.
 *   4. Leave the deal notes alone (the original source info is preserved).
 *
 * Run with:
 *   npx tsx scripts/fix-tiktok-deals.ts              # dry run
 *   npx tsx scripts/fix-tiktok-deals.ts --apply      # actually writes
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually so we don't depend on dotenv
const envPath = resolve(__dirname, "..", ".env");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
console.log("[env] SUPABASE_URL =", (process.env.NEXT_PUBLIC_SUPABASE_URL || "").slice(0, 40));
console.log("[env] SERVICE_KEY  =", (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(0, 20) + "...");

const APPLY = process.argv.includes("--apply");
const NEW_SERVICE_NAME = "Consultation";
const WEIRD_TITLE_PATTERN = "% - 7618%"; // TikTok form_id prefix on 2026-04

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  const sb = createClient(url, key);

  // 1a. Ensure "TikTok" service category exists
  let { data: tiktokCat } = await sb
    .from("service_categories")
    .select("id,name,sort_order")
    .ilike("name", "tiktok")
    .maybeSingle();
  if (!tiktokCat) {
    console.log("No 'TikTok' service category — will create.");
    if (APPLY) {
      const { data: inserted, error: catErr } = await sb
        .from("service_categories")
        .insert({ name: "TikTok", description: "Services auto-created from TikTok Ads lead imports" })
        .select("id,name,sort_order")
        .single();
      if (catErr) throw catErr;
      tiktokCat = inserted;
      console.log(`  created category ${tiktokCat!.id}`);
    } else {
      console.log("  (dry run — category not created)");
    }
  } else {
    console.log(`Found 'TikTok' category: ${tiktokCat.id}`);
  }

  // 1b. Ensure "Consultation" service under TikTok category
  let serviceToLink: { id: string; name: string } | null = null;
  if (tiktokCat) {
    const { data: existingSvc } = await sb
      .from("services")
      .select("id,name")
      .eq("category_id", tiktokCat.id)
      .ilike("name", NEW_SERVICE_NAME)
      .maybeSingle();
    if (existingSvc) {
      serviceToLink = existingSvc;
      console.log(`Found '${NEW_SERVICE_NAME}' under TikTok: ${serviceToLink.id}`);
    } else {
      console.log(`No '${NEW_SERVICE_NAME}' under TikTok — will create.`);
      if (APPLY) {
        const { data: inserted, error: svcErr } = await sb
          .from("services")
          .insert({
            category_id: tiktokCat.id,
            name: NEW_SERVICE_NAME,
            description: "Auto-created from TikTok lead import",
            is_active: true,
            base_price: 0,
          })
          .select("id,name")
          .single();
        if (svcErr) throw svcErr;
        serviceToLink = inserted;
        console.log(`  created service ${serviceToLink!.id}`);
      } else {
        console.log("  (dry run — service not created)");
      }
    }
  }

  // 2. Find affected deals
  const { data: deals, error } = await sb
    .from("deals")
    .select(
      "id, title, created_at, service_id, patient_id, patients!inner(first_name,last_name,email)",
    )
    .ilike("title", WEIRD_TITLE_PATTERN)
    .order("created_at", { ascending: true });
  if (error) throw error;

  console.log(`\nFound ${deals?.length ?? 0} deal(s) with TikTok form_id in title:\n`);
  if (!deals || deals.length === 0) return;

  const updates: Array<{ id: string; from: string; to: string; service_id: string | null; old_service_id: string | null }> = [];
  for (const d of deals as any[]) {
    const patient = d.patients;
    const first = patient.first_name || "";
    const last = patient.last_name || "";
    const newTitle = `${first} ${last}`.trim() + ` - ${NEW_SERVICE_NAME}`;
    // Always point TikTok leads at the TikTok/Consultation service, overriding
    // the Hubspot "To be defined" placeholder that the old importer used.
    const newServiceId = serviceToLink ? serviceToLink.id : d.service_id;
    updates.push({ id: d.id, from: d.title, to: newTitle, service_id: newServiceId, old_service_id: d.service_id });
    console.log(`  ${d.id}`);
    console.log(`    patient: ${first} ${last} <${patient.email ?? ""}>`);
    console.log(`    OLD: ${d.title}`);
    console.log(`    NEW: ${newTitle}`);
    console.log(`    service_id: ${d.service_id ?? "null"} -> ${newServiceId ?? "null"}`);
    console.log();
  }

  if (!APPLY) {
    console.log(`\n${updates.length} deal(s) would be updated. Re-run with --apply to write.`);
    return;
  }

  let done = 0;
  for (const u of updates) {
    const payload: Record<string, unknown> = { title: u.to };
    if (u.service_id) payload.service_id = u.service_id;
    const { error: upErr } = await sb.from("deals").update(payload).eq("id", u.id);
    if (upErr) {
      console.error(`FAILED ${u.id}:`, upErr.message);
    } else {
      done++;
    }
  }
  console.log(`\nUpdated ${done}/${updates.length} deals.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
