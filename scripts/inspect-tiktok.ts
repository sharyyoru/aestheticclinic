import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
for (const line of readFileSync(resolve(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  // 1) All service categories
  const { data: cats } = await sb.from("service_categories").select("id,name").order("name");
  console.log("=== Service categories ===");
  for (const c of cats || []) console.log(`  ${c.id}  ${c.name}`);

  // 2) All services named Consultation (any case)
  const { data: consults } = await sb
    .from("services")
    .select("id,name,category_id,is_active,base_price,service_categories(name)")
    .ilike("name", "%consultation%");
  console.log("\n=== Services matching 'consultation' ===");
  for (const s of (consults || []) as any[]) {
    console.log(
      `  ${s.id}  "${s.name}"  category=${s.service_categories?.name || s.category_id}  active=${s.is_active}  price=${s.base_price}`,
    );
  }

  // 3) The 9 TikTok deals: service_id linkage
  const { data: deals } = await sb
    .from("deals")
    .select("id,title,service_id,services(name,category_id,service_categories(name))")
    .ilike("title", "% - 7618%");
  console.log(`\n=== The 9 TikTok deals' current service links ===`);
  for (const d of (deals || []) as any[]) {
    const sc = d.services;
    console.log(
      `  ${d.id}  service_id=${d.service_id || "null"}  name="${sc?.name || ""}"  cat="${sc?.service_categories?.name || ""}"`,
    );
  }

  // 4) Look at how other imports tag their lead source on patients / deals
  const { data: samplePatients } = await sb
    .from("patients")
    .select("id,first_name,last_name,source,notes")
    .in("id", ((deals || []) as any[]).map((d) => d.patient_id).filter(Boolean));
  console.log("\n=== Patient source for these leads ===");
  for (const p of (samplePatients || []) as any[]) {
    console.log(`  ${p.first_name} ${p.last_name}  source="${p.source}"`);
    console.log(`    notes: ${(p.notes || "").slice(0, 200)}`);
  }
})();
