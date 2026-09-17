import type { DocModule } from "./types";

export const analyticsModules: DocModule[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    tagline: "The home screen: today's numbers, your tasks, your mentions and quick actions.",
    category: "analytics",
    icon: "dashboard",
    appPath: ["Home"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "The dashboard is what you land on after signing in. It is deliberately personal rather than a management report: what you completed today, what is still open for you, who has asked for you, and shortcuts into the work you do most.",
    keyCapabilities: [
      "See appointments completed today",
      "See how many tasks are still open",
      "See the week's completion rate",
      "Work your tasks without leaving the page",
      "See mentions addressed to you",
      "Search patients from the home screen",
      "Jump straight into a patient or an appointment",
    ],
    sections: [
      {
        id: "the-numbers",
        heading: "The numbers at the top",
        table: {
          columns: ["Figure", "What it tells you"],
          rows: [
            ["Completed today", "Appointments marked done today — progress through the day."],
            ["Open tasks", "Work assigned and not yet closed."],
            ["Week rate", "How much of the week's work has been completed."],
          ],
        },
        callouts: [
          {
            kind: "note",
            body: "These figures depend on appointments being marked done and tasks being closed. If the dashboard looks wrong, it is usually because the agenda was not kept up to date.",
          },
        ],
      },
      {
        id: "tasks-and-mentions",
        heading: "Tasks and mentions",
        features: [
          {
            name: "Tasks",
            description: "Your open tasks, workable from here so the dashboard is a working screen rather than a summary.",
          },
          {
            name: "Mentions",
            description: "Notes and task comments where a colleague named you, with the context they came from.",
          },
        ],
      },
      {
        id: "quick-actions",
        heading: "Quick actions and shortcuts",
        bullets: [
          "Add patient — for a first-time caller",
          "Schedule appointment — straight into booking",
          "Patient search — find a record without navigating away",
          "Shortcuts to Workflows, Invoices, Email Reports, AI Agents and Chat Logs",
        ],
      },
      {
        id: "start-of-day",
        heading: "A sensible start-of-day routine",
        steps: [
          { title: "Read the dashboard", body: "Clear your mentions and check your open tasks." },
          { title: "Open the agenda", body: "Check today, and look for anything that needs moving." },
          { title: "Check Online Bookings", body: "Review what patients booked themselves overnight." },
          { title: "Clear Missed Calls", body: "Call back everything still pending." },
          { title: "Work the deals 3-day list", body: "Contact whoever has gone quiet." },
        ],
      },
    ],
    related: ["internal-chat-and-comments", "agenda", "statistics", "navigating-the-app"],
    keywords: ["dashboard", "home", "kpi", "tasks", "mentions", "shortcuts", "today"],
  },

  {
    slug: "statistics",
    title: "Statistics reports",
    tagline: "Detailed operational and financial reports, filterable and exportable.",
    category: "analytics",
    icon: "chart",
    appPath: ["Menu", "Statistics"],
    audience: ["admin"],
    summary:
      "Statistics is the reporting module. Each report answers one question, and they all share the same filter bar: a date range, a billing entity, a doctor, the applicable insurance law, the billing type and whether to include cancelled items. Several reports export to Excel for accountants who want their own view.",
    keyCapabilities: [
      "Run reports over any date range",
      "Filter by billing entity and doctor",
      "Filter by insurance law and by Tiers Garant or Tiers Payant",
      "Include or exclude cancelled items",
      "Export key reports to Excel",
      "Review insurance submission status in aggregate",
      "Measure activity per staff member",
    ],
    sections: [
      {
        id: "shared-filters",
        heading: "The shared filters",
        intro: "Set these once; they apply to the report you are looking at.",
        table: {
          columns: ["Filter", "What it does"],
          rows: [
            ["From / to", "The reporting period. Defaults are sensible but always check them before quoting a number."],
            ["Billing entity", "Restricts to one billing entity, where the clinic bills under more than one."],
            ["Doctor", "Restricts to one treating doctor."],
            ["Insurance law", "Restricts to invoices under a particular health insurance law."],
            ["Billing type", "TG (Tiers Garant) or TP (Tiers Payant)."],
            ["Include cancelled", "Whether cancelled items are counted. Off gives you the commercial reality; on gives you the full audit picture."],
          ],
        },
      },
      {
        id: "available-reports",
        heading: "Available reports",
        table: {
          columns: ["Report", "What it shows"],
          rows: [
            ["Debiteurs", "Open invoices per entity, doctor and patient — the debtor list."],
            ["Sent invoices", "Invoices issued in the period."],
            ["Paid invoices", "Invoices paid in the period."],
            ["Invoiced services", "Service lines billed in the period."],
            ["Paid services", "Service lines paid in the period."],
            [
              "1ères consultations",
              "Patients who had their first consultation in the period. Exports to Excel.",
            ],
            [
              "Agenda patients payments",
              "Patients from a specific agenda or location and what they paid during the period.",
            ],
            [
              "MediData status",
              "Insurance invoices in aggregate: sent, paid, rejected, transmitted and stornoed, plus duplicates, aging and routing.",
            ],
            [
              "Activity by user",
              "What a staff member touched — stage changes, appointments, notes, tasks and emails. Exports to Excel.",
            ],
          ],
        },
      },
      {
        id: "coming-soon",
        heading: "Reports not yet available",
        intro:
          "Four reports are visible in the interface but not yet released. They appear locked rather than empty, so you know they exist and are not misreading a blank page.",
        bullets: [
          "Services aperçu — services performed grouped by treatment date",
          "Non-invoiced services — services performed but not yet billed",
          "Cash collection — payments received by date and method",
          "Consultations per patient — consultation counts per patient and month",
        ],
        callouts: [
          {
            kind: "note",
            body: "Until these arrive, use the financial overview for revenue by service, and the invoices list filtered by payment method for cash collection.",
          },
        ],
      },
      {
        id: "using-the-reports",
        heading: "Which report answers which question",
        table: {
          columns: ["Question", "Report"],
          rows: [
            ["Who owes us money?", "Debiteurs"],
            ["Did we bill more than last quarter?", "Sent invoices, with the period changed"],
            ["Did we collect what we billed?", "Paid invoices against sent invoices"],
            ["Which treatments produce revenue?", "Invoiced services and paid services"],
            ["Is the top of the funnel healthy?", "1ères consultations"],
            ["Where are insurance claims stuck?", "MediData status"],
            ["Who in the team is doing what?", "Activity by user"],
          ],
        },
        callouts: [
          {
            kind: "important",
            body: "Sent invoices and paid invoices will not agree, and should not — they measure different periods of the same money. Be explicit about which you are quoting.",
          },
        ],
      },
      {
        id: "exports",
        heading: "Exporting",
        steps: [
          { title: "Set the filters", body: "The export follows exactly what is on screen." },
          { title: "Export to Excel", body: "Available on 1ères consultations and Activity by user." },
          {
            title: "Keep the filter settings with the file",
            body: "A spreadsheet without its period and filters is not auditable later.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Why does Statistics disagree with the financial overview?",
        answer:
          "Usually the date basis or the cancelled setting. The financial overview lets you choose between invoice date and payment date; Statistics reports each measure a specific event. Check both before assuming an error.",
      },
      {
        question: "Can staff see these reports?",
        answer:
          "They contain full financial and per-user activity data, so treat them as management information and restrict who runs them by role convention within your clinic.",
      },
    ],
    related: ["financials", "invoices", "medidata-insurance", "lead-analytics", "dashboard"],
    keywords: [
      "statistics",
      "reports",
      "debiteurs",
      "excel export",
      "revenue",
      "activity",
      "medidata status",
      "consultations",
    ],
  },
];
