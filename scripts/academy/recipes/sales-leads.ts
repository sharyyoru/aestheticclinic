import type { CaptureRecipe } from "./types";

export const salesLeadsRecipes: CaptureRecipe[] = [
  {
    docSlug: "deals",
    title: "Deals & pipeline",
    route: "/deals",
    video: true,
    steps: [
      { kind: "goto", path: "/deals", caption: "A deal is one treatment opportunity for one patient.", waitFor: { role: "heading", name: "Deals" } },
      { kind: "shot", name: "list", alt: "The deals list view", sectionId: "list-and-board" },
      { kind: "caption", text: "The board view shows where the pipeline is congested." },
      { kind: "shot", name: "filters", alt: "Deal filters for stage, service, owner and contact recency", sectionId: "filters-and-staleness" },
      { kind: "caption", text: "Filtering to 'no contact in 3 days' and sorting by staleness gives you today's call list." },
      { kind: "shot", name: "staleness", alt: "Deals filtered by contact recency", sectionId: "filters-and-staleness" },
    ],
  },
  {
    docSlug: "lead-import",
    title: "Lead capture & import",
    route: "/lead-import",
    video: true,
    steps: [
      { kind: "goto", path: "/lead-import", caption: "Leads arrive from ad platforms, spreadsheets, web forms and AI calls.", waitFor: { role: "heading", name: "Lead Import" } },
      { kind: "shot", name: "upload", alt: "The lead import upload screen with the expected file format", sectionId: "file-import" },
      { kind: "caption", text: "The expected format is listed on screen — a name plus an email or a phone number." },
      { kind: "shot", name: "format", alt: "Expected lead file format", sectionId: "file-format" },
      { kind: "goto", path: "/lead-import/meta-leads", caption: "Live leads from Meta and Zapier, with campaign context.", settleMs: 2500 },
      { kind: "shot", name: "meta", alt: "Meta and Zapier leads with campaign filters", sectionId: "meta-and-zapier" },
      { kind: "goto", path: "/lead-import/embed-forms", caption: "Submissions from forms embedded in your own site.", waitFor: { role: "heading", name: "Embed Form Leads" } },
      { kind: "shot", name: "embed-forms", alt: "Embedded form leads with conversion counts", sectionId: "embed-form-leads" },
      { kind: "goto", path: "/lead-import/history", caption: "Every import is kept, so a bad file can be identified later.", settleMs: 2000 },
      { kind: "shot", name: "history", alt: "Lead import history", sectionId: "history-and-resend" },
    ],
  },
  {
    docSlug: "lead-analytics",
    title: "Lead analytics",
    route: "/lead-analytics",
    video: false,
    steps: [
      { kind: "goto", path: "/lead-analytics", caption: "Where enquiries come from, and which convert.", waitFor: { role: "heading", name: "Lead Analytics" } },
      { kind: "shot", name: "channels", alt: "Leads broken down by channel", sectionId: "by-channel" },
      { kind: "shot", name: "services", alt: "Leads by service and by campaign", sectionId: "by-service-and-campaign" },
    ],
  },
  {
    docSlug: "missed-calls",
    title: "Missed calls",
    route: "/missed-calls",
    video: true,
    steps: [
      { kind: "goto", path: "/missed-calls", caption: "Missed calls are the most expensive thing a clinic loses.", waitFor: { role: "heading", name: "Missed Calls" } },
      { kind: "shot", name: "list", alt: "Missed calls with the calling number, matched patient and status", sectionId: "what-is-listed" },
      { kind: "caption", text: "Filter to pending — that is your queue." },
      { kind: "shot", name: "statuses", alt: "Missed call contact statuses", sectionId: "working-the-list" },
    ],
  },
  {
    docSlug: "services",
    title: "Services & pricing",
    route: "/services",
    video: true,
    steps: [
      { kind: "goto", path: "/services", caption: "The service catalogue is the single price list behind everything.", waitFor: { role: "heading", name: "Services" } },
      { kind: "shot", name: "catalogue", alt: "The service catalogue grouped into categories", sectionId: "structure" },
      { kind: "caption", text: "Each service has a code, a description and a base price in CHF." },
      { kind: "shot", name: "service-fields", alt: "Service fields including code and base price", sectionId: "adding" },
      { kind: "caption", text: "Withdraw a treatment by deactivating it, so past invoices keep their history." },
      { kind: "shot", name: "active", alt: "Active and inactive services", sectionId: "changing-prices" },
    ],
  },
];
