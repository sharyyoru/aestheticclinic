import type { DocCategory, DocModule, DocSearchEntry } from "./types";
import { gettingStartedModules } from "./getting-started";
import { coreRecordsModules } from "./core-records";
import { schedulingModules } from "./scheduling";
import { salesLeadsModules } from "./sales-leads";
import { billingModules } from "./billing";
import { communicationModules } from "./communication";
import { automationAiModules } from "./automation-ai";
import { analyticsModules } from "./analytics";
import { patientFacingModules } from "./patient-facing";
import { adminSetupModules } from "./admin-setup";

export const DOCS_LAST_UPDATED = "September 2025";

export const CATEGORIES: DocCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "What the platform is, how to sign in, and how to find your way around.",
    icon: "rocket",
  },
  {
    id: "core-records",
    title: "Patients & records",
    description: "Patient files, clinical records, documents and 3D imaging.",
    icon: "users",
  },
  {
    id: "scheduling",
    title: "Scheduling",
    description: "The agenda, doctor availability, online booking and reminders.",
    icon: "calendar",
  },
  {
    id: "sales-leads",
    title: "Sales & leads",
    description: "Pipeline, lead capture and import, call follow-up and your treatment catalogue.",
    icon: "trending",
  },
  {
    id: "billing",
    title: "Billing & finance",
    description: "Invoices, Swiss insurance billing, TarDoc coding and payments.",
    icon: "receipt",
  },
  {
    id: "communication",
    title: "Communication",
    description: "Email, WhatsApp, SMS, internal comments and the full message history.",
    icon: "mail",
  },
  {
    id: "automation-ai",
    title: "Automation & AI",
    description: "Workflows, marketing campaigns, AI voice agents and the Aliice assistant.",
    icon: "workflow",
  },
  {
    id: "analytics",
    title: "Reporting",
    description: "The dashboard and the statistics reports behind it.",
    icon: "chart",
  },
  {
    id: "patient-facing",
    title: "Patient-facing tools",
    description: "Patient app, intake questionnaires, embeddable forms and payment pages.",
    icon: "heart",
  },
  {
    id: "admin-setup",
    title: "Administration",
    description: "Settings, users, onboarding, training and integrations.",
    icon: "settings",
  },
];

export const MODULES: DocModule[] = [
  ...gettingStartedModules,
  ...coreRecordsModules,
  ...schedulingModules,
  ...salesLeadsModules,
  ...billingModules,
  ...communicationModules,
  ...automationAiModules,
  ...analyticsModules,
  ...patientFacingModules,
  ...adminSetupModules,
];

export function getModule(slug: string): DocModule | undefined {
  return MODULES.find((m) => m.slug === slug);
}

export function getCategory(id: string): DocCategory | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryModules(categoryId: string): DocModule[] {
  return MODULES.filter((m) => m.category === categoryId);
}

/** Modules grouped in category order — the order used by the sidebar. */
export function getGroupedModules(): { category: DocCategory; modules: DocModule[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    modules: getCategoryModules(category.id),
  })).filter((group) => group.modules.length > 0);
}

/** Sidebar order, flattened — used for previous/next navigation. */
export function getOrderedModules(): DocModule[] {
  return getGroupedModules().flatMap((group) => group.modules);
}

export function getAdjacentModules(slug: string): { previous?: DocModule; next?: DocModule } {
  const ordered = getOrderedModules();
  const index = ordered.findIndex((m) => m.slug === slug);
  if (index === -1) return {};
  return { previous: ordered[index - 1], next: ordered[index + 1] };
}

export function getRelatedModules(doc: DocModule): DocModule[] {
  return (doc.related ?? [])
    .map((slug) => getModule(slug))
    .filter((m): m is DocModule => Boolean(m));
}

function sectionText(doc: DocModule, sectionId: string): string {
  const section = doc.sections.find((s) => s.id === sectionId);
  if (!section) return "";
  return [
    section.intro ?? "",
    ...(section.bullets ?? []),
    ...(section.features ?? []).map((f) => `${f.name} ${f.description}`),
    ...(section.steps ?? []).map((s) => `${s.title} ${s.body}`),
    ...(section.callouts ?? []).map((c) => `${c.title ?? ""} ${c.body}`),
    ...(section.table ? section.table.rows.flat() : []),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One entry per module plus one per section, for fuzzy search. */
export function buildSearchEntries(): DocSearchEntry[] {
  const entries: DocSearchEntry[] = [];
  for (const doc of MODULES) {
    const categoryTitle = getCategory(doc.category)?.title ?? "";
    entries.push({
      moduleSlug: doc.slug,
      moduleTitle: doc.title,
      categoryTitle,
      heading: doc.title,
      body: `${doc.tagline} ${doc.summary} ${doc.keyCapabilities.join(" ")}`,
      keywords: doc.keywords.join(" "),
    });
    for (const section of doc.sections) {
      entries.push({
        moduleSlug: doc.slug,
        moduleTitle: doc.title,
        categoryTitle,
        sectionId: section.id,
        heading: section.heading,
        body: sectionText(doc, section.id),
        keywords: doc.keywords.join(" "),
      });
    }
  }
  return entries;
}
