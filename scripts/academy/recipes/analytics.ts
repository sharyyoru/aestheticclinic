import type { CaptureRecipe } from "./types";

export const analyticsRecipes: CaptureRecipe[] = [
  {
    docSlug: "dashboard",
    title: "Dashboard",
    route: "/",
    video: true,
    steps: [
      { kind: "goto", path: "/", caption: "The dashboard is personal: your day, your work.", waitFor: { text: "Open Tasks" } },
      { kind: "shot", name: "overview", alt: "The dashboard with completed today, open tasks and week rate", sectionId: "the-numbers" },
      { kind: "caption", text: "Completed today, open tasks and the week's completion rate." },
      { kind: "shot", name: "figures", alt: "Dashboard headline figures", sectionId: "the-numbers" },
      { kind: "caption", text: "Tasks and mentions are workable from here, so it is not just a summary." },
      { kind: "shot", name: "tasks-mentions", alt: "Tasks and mentions panels on the dashboard", sectionId: "tasks-and-mentions" },
      { kind: "caption", text: "Shortcuts jump straight into the work you do most." },
      { kind: "shot", name: "shortcuts", alt: "Dashboard shortcuts", sectionId: "quick-actions" },
    ],
  },
  {
    docSlug: "statistics",
    title: "Statistics reports",
    route: "/statistics",
    video: true,
    steps: [
      { kind: "goto", path: "/statistics", caption: "Each report answers one question.", waitFor: { role: "heading", name: "Statistics" } },
      { kind: "shot", name: "reports", alt: "The statistics report list", sectionId: "available-reports" },
      { kind: "caption", text: "All reports share one filter bar: period, entity, doctor, law and billing type." },
      { kind: "shot", name: "filters", alt: "Shared statistics filters", sectionId: "shared-filters" },
      { kind: "click", target: { text: "Debiteurs" }, caption: "Debiteurs is the debtor list — who owes you money.", optional: true },
      { kind: "wait", ms: 2500 },
      { kind: "shot", name: "debiteurs", alt: "The Debiteurs report showing open invoices", sectionId: "available-reports" },
      { kind: "caption", text: "Four reports are visible but not yet released — they appear locked rather than empty." },
      { kind: "shot", name: "locked", alt: "Reports marked as coming soon", sectionId: "coming-soon" },
    ],
  },
];
