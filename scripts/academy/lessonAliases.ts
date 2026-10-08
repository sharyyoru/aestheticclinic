/**
 * Maps captured documentation slugs to the Academy lesson slugs they belong
 * to. Recipes and the media manifest are keyed by documentation module slug
 * ("navigating-the-app"), while the published Academy keeps its own curated
 * lesson slugs ("navigation-basics"). Sync attaches a recording to the lesson
 * named here, or to a lesson sharing the doc slug when no alias exists.
 *
 * Doc slugs without an alias and without a same-named lesson are reported by
 * sync and simply get no video — the curated lesson set is the source of
 * truth, so missing rows are never created.
 */
export const DOC_TO_LESSON_SLUG: Record<string, string> = {
  // Getting Started
  "navigating-the-app": "navigation-basics",
  "dashboard": "dashboard-overview",
  "my-profile": "user-profile",

  // Patient Management
  "patients": "patient-list",
  "patient-record": "patient-details",
  "client-onboarding": "creating-patients",

  // Appointments & Agenda
  "agenda": "calendar-view",
  "online-bookings": "booking-appointments",
  "appointment-reminders": "appointment-reminders",
  "missed-calls": "ai-calls",

  // Deals & Pipeline
  "deals": "kanban-board",

  // Medical Consultations
  "intake-and-consultations": "consultation-notes",
  "medical-records": "medical-history",
  "3d-imaging": "photo-documentation",

  // Swiss Medical Billing
  "invoices": "sumex-invoices",
  "tardoc": "tardoc-codes",
  "medidata-insurance": "medidata",

  // Documents & Templates
  "documents": "file-storage",

  // Communication
  "email": "email-system",
  "whatsapp": "whatsapp-integration",
  "workflows": "workflow-automation",

  // AI Features
  "aliice-assistant": "ai-chat-assistant",
  "knowledge-base": "knowledgebase",

  // Marketing & Leads
  "lead-import": "lead-import",
  "marketing-campaigns": "campaign-tracking",

  // Statistics & Reports
  "financials": "financial-reports",
  "statistics": "patient-analytics",

  // Settings & Admin
  "settings": "system-settings",
  "user-management": "user-management",
  "services": "services-config",
  "integrations": "integrations",
};
