/**
 * Fix existing embed form deals:
 *   1. Cross-reference embed_form_leads with deals via converted_to_patient_id
 *   2. Resolve service strings to service_ids (creating under AliiceForm if needed)
 *   3. Update deal titles from "Name - New Inquiry" to "Name - <Service>"
 *   4. Set service_id where missing
 *
 * Usage:
 *   npx tsx scripts/fix-embed-deals.ts           # Dry run
 *   npx tsx scripts/fix-embed-deals.ts --apply   # Apply changes
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

// ---------------------------------------------------------------------------
// FR → EN alias map (same as embedServiceResolver)
// ---------------------------------------------------------------------------
const FR_TO_EN: Record<string, string> = {
  "augmentation mammaire": "Breast Augmentation",
  "liposuccion": "Liposuction",
  "rhinoplastie": "Rhinoplasty",
  "lifting du visage": "Facelift",
  "blépharoplastie": "Blepharoplasty",
  "soins de la peau": "Skin Care",
  "consultation générale": "General Consultation",
  "autre": "Other",
};

// ---------------------------------------------------------------------------
// Service resolution (inline for script — mirrors embedServiceResolver logic)
// ---------------------------------------------------------------------------
const serviceCache = new Map<string, { id: string; name: string }>();
let aliiceFormCategoryId: string | null = null;

async function ensureCategory(): Promise<string> {
  if (aliiceFormCategoryId) return aliiceFormCategoryId;

  const { data: existing } = await supabase
    .from("service_categories")
    .select("id")
    .eq("name", "AliiceForm")
    .maybeSingle();

  if (existing) {
    aliiceFormCategoryId = existing.id;
    return existing.id;
  }

  const { data: created } = await supabase
    .from("service_categories")
    .insert({ name: "AliiceForm", description: "Services auto-created from embed form leads" })
    .select("id")
    .single();

  aliiceFormCategoryId = created!.id as string;
  console.log(`  Created AliiceForm category: ${aliiceFormCategoryId}`);
  return aliiceFormCategoryId!;
}

async function resolveService(raw: string): Promise<{ id: string; name: string }> {
  const lower = raw.trim().toLowerCase();
  if (serviceCache.has(lower)) return serviceCache.get(lower)!;

  const englishName = FR_TO_EN[lower] ?? raw.trim();
  const englishLower = englishName.toLowerCase();
  if (serviceCache.has(englishLower)) {
    const hit = serviceCache.get(englishLower)!;
    serviceCache.set(lower, hit);
    return hit;
  }

  // Exact match across all categories
  const { data: exact } = await supabase
    .from("services")
    .select("id, name")
    .ilike("name", englishName)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (exact) {
    const r = { id: exact.id, name: exact.name };
    serviceCache.set(lower, r);
    serviceCache.set(englishLower, r);
    return r;
  }

  // Auto-create under AliiceForm
  const catId = await ensureCategory();
  const { data: existingInCat } = await supabase
    .from("services")
    .select("id, name")
    .eq("category_id", catId)
    .ilike("name", englishName)
    .limit(1)
    .maybeSingle();

  if (existingInCat) {
    const r = { id: existingInCat.id, name: existingInCat.name };
    serviceCache.set(lower, r);
    serviceCache.set(englishLower, r);
    return r;
  }

  if (!applyMode) {
    // In dry run, return placeholder
    const r = { id: `(will-create-${englishName})`, name: englishName };
    serviceCache.set(lower, r);
    serviceCache.set(englishLower, r);
    return r;
  }

  const { data: created } = await supabase
    .from("services")
    .insert({
      name: englishName,
      category_id: catId,
      description: "Auto-created from embed form lead",
      is_active: true,
    })
    .select("id, name")
    .single();

  const r = { id: created!.id, name: created!.name };
  serviceCache.set(lower, r);
  serviceCache.set(englishLower, r);
  console.log(`  Created service "${englishName}": ${r.id}`);
  return r;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Fix Embed Form Deals (${applyMode ? "APPLY" : "DRY RUN"}) ===\n`);

  // 1. Get all embed_form_leads with a patient link and a service value
  const { data: leads, error: leadsErr } = await supabase
    .from("embed_form_leads")
    .select("id, first_name, last_name, email, service, converted_to_patient_id, created_at")
    .not("converted_to_patient_id", "is", null)
    .order("created_at", { ascending: true });

  if (leadsErr) {
    console.error("Failed to fetch embed leads:", leadsErr);
    return;
  }

  console.log(`Found ${leads!.length} embed leads with patient links\n`);

  let updated = 0;
  let skipped = 0;
  let alreadyOk = 0;

  for (const lead of leads!) {
    const patientId = lead.converted_to_patient_id;
    const rawService = lead.service;

    // Find deals for this patient from embed forms
    // Look for deals with notes containing "embed" or title "New Inquiry" / "Embed Form Inquiry"
    const { data: deals } = await supabase
      .from("deals")
      .select("id, title, service_id, notes, created_at")
      .eq("patient_id", patientId)
      .or("title.ilike.%New Inquiry%,title.ilike.%Embed Form Inquiry%,notes.ilike.%embed%,notes.ilike.%intake form%")
      .order("created_at", { ascending: false });

    if (!deals || deals.length === 0) {
      skipped++;
      continue;
    }

    for (const deal of deals) {
      const titleEndsWithNewInquiry = deal.title?.endsWith("- New Inquiry") || deal.title?.endsWith("- Embed Form Inquiry");
      const needsTitleFix = titleEndsWithNewInquiry && rawService;
      const needsServiceFix = !deal.service_id && rawService;

      if (!needsTitleFix && !needsServiceFix) {
        alreadyOk++;
        continue;
      }

      // Resolve the service
      let resolved: { id: string; name: string } | null = null;
      if (rawService) {
        resolved = await resolveService(rawService);
      }

      // Build new title
      const titleParts = deal.title?.split(" - ") || [];
      const patientName = titleParts[0] || `${lead.first_name} ${lead.last_name}`;
      const newTitle = resolved
        ? `${patientName} - ${resolved.name}`
        : deal.title;

      const newServiceId = resolved?.id && !resolved.id.startsWith("(will-create") ? resolved.id : null;

      const changes: Record<string, unknown> = {};
      if (needsTitleFix && newTitle !== deal.title) {
        changes.title = newTitle;
      }
      if (needsServiceFix && newServiceId) {
        changes.service_id = newServiceId;
      }

      if (Object.keys(changes).length === 0) {
        alreadyOk++;
        continue;
      }

      console.log(`  ${lead.first_name} ${lead.last_name} (${rawService})`);
      console.log(`    Deal: "${deal.title}" → "${changes.title || deal.title}"`);
      console.log(`    service_id: ${deal.service_id || "NULL"} → ${(changes.service_id as string) || deal.service_id || "NULL"}`);

      if (applyMode) {
        const { error: updateErr } = await supabase
          .from("deals")
          .update(changes)
          .eq("id", deal.id);

        if (updateErr) {
          console.error(`    ERROR updating deal ${deal.id}:`, updateErr);
        } else {
          console.log(`    ✓ Updated`);
          updated++;
        }
      } else {
        updated++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total embed leads processed: ${leads!.length}`);
  console.log(`Deals ${applyMode ? "updated" : "to update"}: ${updated}`);
  console.log(`Deals already OK: ${alreadyOk}`);
  console.log(`Leads with no matching deal: ${skipped}`);

  if (!applyMode && updated > 0) {
    console.log(`\nRun with --apply to apply these changes.`);
  }
}

main().catch(console.error);
