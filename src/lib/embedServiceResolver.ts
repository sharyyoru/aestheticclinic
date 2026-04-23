/**
 * Resolve embed form service strings to database service IDs.
 *
 * Embed forms send localised service names (EN / FR). This module:
 *   1. Normalises FR names to their EN equivalent via an alias map.
 *   2. Looks up the service across ALL categories (exact match first).
 *   3. Falls back to fuzzy keyword matching.
 *   4. If still unresolved, auto-creates the service under the "AliiceForm"
 *      category (creating the category itself if missing).
 *
 * The resolver is designed to be called from both the `patient-created` and
 * `embed-lead-followup` workflow routes.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// FR → EN alias map (embed form translations)
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
// Fuzzy keyword → service name fallback
// ---------------------------------------------------------------------------
const KEYWORD_MAP: { keywords: string[]; serviceName: string }[] = [
  { keywords: ["breast", "augment", "mammaire"], serviceName: "Breast Augmentation" },
  { keywords: ["lipo", "liposuc"], serviceName: "Liposuction" },
  { keywords: ["rhino", "nez"], serviceName: "Rhinoplasty" },
  { keywords: ["facelift", "lifting", "face lift"], serviceName: "Facelift" },
  { keywords: ["blepharo", "paupière", "eyelid"], serviceName: "Blepharoplasty" },
  { keywords: ["botox", "filler", "injection"], serviceName: "Injections (Botox/Fillers)" },
  { keywords: ["skin care", "soins de la peau", "skincare"], serviceName: "Skin Care" },
  { keywords: ["general consultation", "consultation générale", "consultation generale"], serviceName: "General Consultation" },
  { keywords: ["other", "autre"], serviceName: "Other" },
];

// ---------------------------------------------------------------------------
// In-memory cache (per process lifetime)
// ---------------------------------------------------------------------------
const cache = new Map<string, { id: string; name: string }>();
let aliiceFormCategoryId: string | null = null;

/** Category name used for auto-created embed form services */
const CATEGORY_NAME = "AliiceForm";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ResolvedService = { id: string; name: string };

/**
 * Resolve a service string from an embed form to a `{ id, name }` pair.
 *
 * Returns `null` only if the input is empty / null / undefined.
 */
export async function resolveEmbedService(
  supabase: SupabaseClient,
  rawService: string | null | undefined,
): Promise<ResolvedService | null> {
  if (!rawService || !rawService.trim()) return null;

  const trimmed = rawService.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check cache
  if (cache.has(lower)) return cache.get(lower)!;

  // 2. Normalise FR → EN
  const englishName = FR_TO_EN[lower] ?? trimmed;
  const englishLower = englishName.toLowerCase();

  // Also check cache for the normalised name
  if (cache.has(englishLower)) {
    const hit = cache.get(englishLower)!;
    cache.set(lower, hit); // cache the FR key too
    return hit;
  }

  // 3. Exact match across all categories
  const { data: exact } = await supabase
    .from("services")
    .select("id, name")
    .ilike("name", englishName)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (exact) {
    const result = { id: exact.id, name: exact.name };
    cache.set(lower, result);
    cache.set(englishLower, result);
    return result;
  }

  // 4. Fuzzy keyword match
  for (const { keywords, serviceName } of KEYWORD_MAP) {
    if (keywords.some((kw) => englishLower.includes(kw) || lower.includes(kw))) {
      const { data: fuzzy } = await supabase
        .from("services")
        .select("id, name")
        .ilike("name", `%${serviceName}%`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (fuzzy) {
        const result = { id: fuzzy.id, name: fuzzy.name };
        cache.set(lower, result);
        cache.set(englishLower, result);
        return result;
      }
    }
  }

  // 5. Auto-create under "AliiceForm" category
  const catId = await ensureAliiceFormCategory(supabase);
  if (!catId) {
    console.error("[EmbedServiceResolver] Cannot create AliiceForm category — skipping service creation");
    const fallback = { id: "", name: englishName };
    cache.set(lower, fallback);
    return fallback;
  }

  // Check if it already exists under AliiceForm (maybe inactive or race condition)
  const { data: existing } = await supabase
    .from("services")
    .select("id, name")
    .eq("category_id", catId)
    .ilike("name", englishName)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const result = { id: existing.id, name: existing.name };
    cache.set(lower, result);
    cache.set(englishLower, result);
    return result;
  }

  const { data: created, error: createErr } = await supabase
    .from("services")
    .insert({
      name: englishName,
      category_id: catId,
      description: "Auto-created from embed form lead",
      is_active: true,
    })
    .select("id, name")
    .single();

  if (createErr) {
    console.error("[EmbedServiceResolver] Failed to create service:", createErr);
    const fallback = { id: "", name: englishName };
    cache.set(lower, fallback);
    return fallback;
  }

  const result = { id: created!.id, name: created!.name };
  cache.set(lower, result);
  cache.set(englishLower, result);
  console.log(`[EmbedServiceResolver] Created service "${englishName}" under ${CATEGORY_NAME}: ${result.id}`);
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function ensureAliiceFormCategory(supabase: SupabaseClient): Promise<string | null> {
  if (aliiceFormCategoryId) return aliiceFormCategoryId;

  const { data: existing } = await supabase
    .from("service_categories")
    .select("id")
    .eq("name", CATEGORY_NAME)
    .maybeSingle();

  if (existing) {
    aliiceFormCategoryId = existing.id;
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("service_categories")
    .insert({ name: CATEGORY_NAME, description: "Services auto-created from embed form leads" })
    .select("id")
    .single();

  if (error) {
    console.error("[EmbedServiceResolver] Failed to create category:", error);
    return null;
  }

  aliiceFormCategoryId = created!.id;
  console.log(`[EmbedServiceResolver] Created category "${CATEGORY_NAME}": ${aliiceFormCategoryId}`);
  return aliiceFormCategoryId;
}
