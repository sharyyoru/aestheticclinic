/**
 * Inspect embed form leads: their deals, service links, and available services.
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

async function main() {
  console.log("=== 1. Embed Form Leads (embed_form_leads table) ===");
  const { data: embedLeads, error: e1 } = await supabase
    .from("embed_form_leads")
    .select("id, first_name, last_name, email, service, form_type, status, converted_to_patient_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (e1) console.error("Error fetching embed leads:", e1);
  console.log(`Total embed leads (up to 50):`, embedLeads?.length);
  
  // Service breakdown
  const svcMap: Record<string, number> = {};
  for (const l of embedLeads || []) {
    const s = l.service || "(null)";
    svcMap[s] = (svcMap[s] || 0) + 1;
  }
  console.log("\nService breakdown:");
  for (const [k, v] of Object.entries(svcMap).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  // Form type breakdown
  const ftMap: Record<string, number> = {};
  for (const l of embedLeads || []) {
    const ft = l.form_type || "(null)";
    ftMap[ft] = (ftMap[ft] || 0) + 1;
  }
  console.log("\nForm type breakdown:");
  for (const [k, v] of Object.entries(ftMap).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\n=== 2. Deals from embed leads (source like embed_%) ===");
  // Find patients with source starting with embed_
  const { data: embedPatients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, source")
    .ilike("source", "embed_%")
    .limit(200);
  console.log(`Patients with source like embed_%: ${embedPatients?.length}`);

  // Also find deals with title containing "Embed Form Inquiry" or "New Inquiry"
  const { data: embedDeals } = await supabase
    .from("deals")
    .select("id, title, service_id, patient_id, pipeline, created_at, notes")
    .or("title.ilike.%Embed Form Inquiry%,title.ilike.%New Inquiry%,notes.ilike.%embed form%,notes.ilike.%embed_%")
    .order("created_at", { ascending: false })
    .limit(100);

  console.log(`Deals matching embed patterns: ${embedDeals?.length}`);

  // Title pattern breakdown
  const titleMap: Record<string, number> = {};
  const svcIdMap: Record<string, number> = {};
  for (const d of embedDeals || []) {
    // Extract the part after " - "
    const parts = d.title?.split(" - ");
    const suffix = parts?.length > 1 ? parts.slice(1).join(" - ") : "(no dash)";
    titleMap[suffix] = (titleMap[suffix] || 0) + 1;
    svcIdMap[d.service_id ? "has service_id" : "NO service_id"] = (svcIdMap[d.service_id ? "has service_id" : "NO service_id"] || 0) + 1;
  }

  console.log("\nDeal title suffix breakdown:");
  for (const [k, v] of Object.entries(titleMap).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${k}": ${v}`);
  }
  console.log("\nService ID status:");
  for (const [k, v] of Object.entries(svcIdMap)) {
    console.log(`  ${k}: ${v}`);
  }

  // Show some sample deals
  console.log("\nSample deals (first 10):");
  for (const d of (embedDeals || []).slice(0, 10)) {
    console.log(`  [${d.created_at}] "${d.title}" | service_id: ${d.service_id || "NULL"} | pipeline: ${d.pipeline}`);
  }

  console.log("\n=== 3. Existing Service Categories + Services ===");
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id, name, description")
    .order("name");
  console.log("Categories:");
  for (const c of categories || []) {
    console.log(`  [${c.id}] ${c.name} — ${c.description || "(no desc)"}`);
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, category_id, is_active")
    .order("name");
  console.log(`\nAll services (${services?.length}):`);
  const catNameMap = new Map((categories || []).map(c => [c.id, c.name]));
  for (const s of services || []) {
    console.log(`  [${s.id}] ${s.name} | category: ${catNameMap.get(s.category_id) || s.category_id} | active: ${s.is_active}`);
  }

  // Check: do any existing services match embed form service names?
  const embedServiceNames = [
    "Breast Augmentation", "Liposuction", "Rhinoplasty", "Facelift",
    "Blepharoplasty", "Injections (Botox/Fillers)", "Skin Care",
    "General Consultation", "Other",
    // French
    "Augmentation Mammaire", "Liposuccion", "Rhinoplastie",
    "Lifting du Visage", "Blépharoplastie", "Soins de la Peau",
    "Consultation Générale", "Autre",
  ];
  console.log("\n=== 4. Embed form service → existing service match ===");
  const serviceNamesLower = new Set((services || []).map(s => s.name.toLowerCase()));
  for (const name of embedServiceNames) {
    const matched = serviceNamesLower.has(name.toLowerCase());
    console.log(`  "${name}" → ${matched ? "FOUND" : "MISSING"}`);
  }
}

main().catch(console.error);
