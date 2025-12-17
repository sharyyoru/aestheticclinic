import { supabaseClient } from "./supabaseClient";
import { isDemoUser } from "./demoMode";

const DEMO_TABLES = [
  "patients",
  "appointments",
  "deals",
  "emails",
  "whatsapp_messages",
  "documents",
  "patient_notes",
  "tasks",
  "consultations",
  "workflows",
  "email_templates",
  "providers",
  "deal_stages",
  "chat_conversations",
  "chat_messages",
  "users",
];

export async function from(table: string) {
  const isDemo = await isDemoUser();
  
  const query = supabaseClient.from(table);
  
  if (DEMO_TABLES.includes(table)) {
    return query.eq("is_demo", isDemo);
  }
  
  return query;
}

export async function insertDemo(table: string, data: any) {
  const isDemo = await isDemoUser();
  
  const dataWithDemo = Array.isArray(data)
    ? data.map(item => ({ ...item, is_demo: isDemo }))
    : { ...data, is_demo: isDemo };
  
  return supabaseClient.from(table).insert(dataWithDemo);
}

export async function upsertDemo(table: string, data: any, options?: any) {
  const isDemo = await isDemoUser();
  
  const dataWithDemo = Array.isArray(data)
    ? data.map(item => ({ ...item, is_demo: isDemo }))
    : { ...data, is_demo: isDemo };
  
  return supabaseClient.from(table).upsert(dataWithDemo, options);
}
