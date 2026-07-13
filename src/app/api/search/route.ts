import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PAGES = [
  { label: "Dashboard", href: "/", category: "pages" },
  { label: "Patients", href: "/patients", category: "pages" },
  { label: "Agenda / Appointments", href: "/appointments", category: "pages" },
  { label: "Deals & Pipeline", href: "/deals", category: "pages" },
  { label: "Lead Import", href: "/lead-import", category: "pages" },
  { label: "CSV Import", href: "/lead-import", category: "pages" },
  { label: "Import History", href: "/lead-import/history", category: "pages" },
  { label: "Meta & Zapier Leads", href: "/lead-import/meta-leads", category: "pages" },
  { label: "Aliice Calls", href: "/lead-import/retell-calls", category: "pages" },
  { label: "Embed Forms", href: "/lead-import/embed-forms", category: "pages" },
  { label: "Financials", href: "/financials", category: "pages" },
  { label: "Invoices", href: "/invoices", category: "pages" },
  { label: "MediData", href: "/medidata", category: "pages" },
  { label: "Services", href: "/services", category: "pages" },
  { label: "Tasks", href: "/tasks", category: "pages" },
  { label: "User Management", href: "/users", category: "pages" },
  { label: "Workflows", href: "/workflows", category: "pages" },
  { label: "Workflow Templates", href: "/workflows/templates", category: "pages" },
  { label: "AI Agents", href: "/agents", category: "pages" },
  { label: "Marketing", href: "/marketing", category: "pages" },
  { label: "New Campaign", href: "/marketing/campaigns", category: "pages" },
  { label: "Controllers", href: "/controllers", category: "pages" },
  { label: "Email Reports", href: "/email-reports", category: "pages" },
  { label: "Statistics", href: "/statistics", category: "pages" },
  { label: "Chat with Aliice", href: "/chat", category: "pages" },
  { label: "Chat Logs", href: "/chatlogs", category: "pages" },
  { label: "Client Onboarding", href: "/client-onboarding", category: "pages" },
  { label: "Invoice Linker", href: "/invoice-linker", category: "pages" },
  { label: "Settings", href: "/settings", category: "pages" },
  { label: "Knowledgebase", href: "/knowledgebase", category: "pages" },
  { label: "Online Booking Settings", href: "/settings/online-booking", category: "pages" },
  { label: "3D Patient View", href: "/patients", category: "pages" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, page = 1, limit = 20 } = body as {
      query: string;
      categories?: string[];
      page?: number;
      limit?: number;
    };

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [], query: "" });
    }

    const searchTerm = query.trim();
    const offset = (page - 1) * limit;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search pages (local, instant)
    const lowerTerm = searchTerm.toLowerCase();
    const pageResults = SYSTEM_PAGES.filter((p) =>
      p.label.toLowerCase().includes(lowerTerm),
    ).map((p) => ({
      id: p.href,
      title: p.label,
      subtitle: p.href,
      href: p.href,
      category: "pages" as const,
    }));

    // Search patients
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email, phone")
      .or(
        `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
      )
      .range(offset, offset + limit - 1)
      .limit(limit);

    const patientResults = (patients || []).map((p: any) => ({
      id: p.id,
      title: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unnamed",
      subtitle: p.email || p.phone || "",
      href: `/patients/${p.id}`,
      category: "patients" as const,
    }));

    // Search tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, name, status")
      .ilike("name", `%${searchTerm}%`)
      .range(offset, offset + limit - 1)
      .limit(limit);

    const taskResults = (tasks || []).map((t: any) => ({
      id: t.id,
      title: t.name || "Untitled task",
      subtitle: t.status || "",
      href: `/tasks`,
      category: "tasks" as const,
    }));

    // Search deals
    const { data: deals } = await supabase
      .from("deals")
      .select("id, title, patient_id")
      .ilike("title", `%${searchTerm}%`)
      .range(offset, offset + limit - 1)
      .limit(limit);

    const dealResults = (deals || []).map((d: any) => ({
      id: d.id,
      title: d.title || "Untitled deal",
      subtitle: "",
      href: d.patient_id
        ? `/patients/${d.patient_id}?m_tab=crm&crm_sub=deals&dealId=${d.id}`
        : `/deals`,
      category: "deals" as const,
    }));

    // Search services
    const { data: services } = await supabase
      .from("services")
      .select("id, name, description")
      .ilike("name", `%${searchTerm}%`)
      .range(offset, offset + limit - 1)
      .limit(limit);

    const serviceResults = (services || []).map((s: any) => ({
      id: s.id,
      title: s.name || "Unnamed service",
      subtitle: s.description || "",
      href: `/services`,
      category: "services" as const,
    }));

    // Search invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, patient_id")
      .ilike("invoice_number", `%${searchTerm}%`)
      .range(offset, offset + limit - 1)
      .limit(limit);

    const invoiceResults = (invoices || []).map((i: any) => ({
      id: i.id,
      title: `Invoice #${i.invoice_number || i.id.slice(0, 8)}`,
      subtitle: "",
      href: i.patient_id
        ? `/patients/${i.patient_id}?m_tab=crm&crm_sub=invoices`
        : `/invoices`,
      category: "invoices" as const,
    }));

    const results = [
      { category: "pages", items: pageResults.slice(0, limit), total: pageResults.length },
      { category: "patients", items: patientResults, total: patientResults.length },
      { category: "tasks", items: taskResults, total: taskResults.length },
      { category: "deals", items: dealResults, total: dealResults.length },
      { category: "services", items: serviceResults, total: serviceResults.length },
      { category: "invoices", items: invoiceResults, total: invoiceResults.length },
    ].filter((r) => r.items.length > 0);

    return NextResponse.json({ results, query: searchTerm });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Search failed" },
      { status: 500 },
    );
  }
}
