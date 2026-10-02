export type AcademyTourSafety = "observe" | "navigate" | "practice-input" | "simulate-submit" | "demo-only" | "blocked";

export type AcademyTourStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  description: string;
  safety: AcademyTourSafety;
  placement?: "top" | "right" | "bottom" | "left";
};

export type AcademyExperience = {
  slug: string;
  version: number;
  minimumWidth: number;
  status: "pilot" | "published";
  steps: AcademyTourStep[];
};

const pilotExperiences: AcademyExperience[] = [
  {
    slug: "navigating-the-app",
    version: 1,
    minimumWidth: 768,
    status: "pilot",
    steps: [
      { id: "dashboard", route: "/", target: "app.dashboard", title: "Your daily starting point", description: "The dashboard brings together today's clinic activity, tasks and shortcuts.", safety: "observe", placement: "bottom" },
      { id: "navigation", route: "/", target: "app.primary-navigation", title: "Primary navigation", description: "Use the main navigation to move between the areas you use most often.", safety: "observe", placement: "bottom" },
      { id: "patients", route: "/patients", target: "patients.page", title: "Patient contacts", description: "Opening Patients takes you to the searchable contact list.", safety: "navigate", placement: "top" },
    ],
  },
  {
    slug: "patients",
    version: 1,
    minimumWidth: 768,
    status: "pilot",
    steps: [
      { id: "page", route: "/patients", target: "patients.page", title: "Patient contacts", description: "This list is the central place to find and open patient records.", safety: "observe", placement: "bottom" },
      { id: "search", route: "/patients", target: "patients.search", title: "Search safely", description: "Search by name, email, phone number or date of birth. This tutorial will not enter or submit patient information.", safety: "practice-input", placement: "bottom" },
      { id: "filters", route: "/patients", target: "patients.filters", title: "Narrow the list", description: "Use ownership, creation date and status filters when a text search is too broad.", safety: "observe", placement: "bottom" },
    ],
  },
  {
    slug: "agenda",
    version: 1,
    minimumWidth: 768,
    status: "pilot",
    steps: [
      { id: "page", route: "/appointments", target: "agenda.page", title: "The clinic agenda", description: "The agenda shows the clinical day across doctors and locations.", safety: "observe", placement: "top" },
      { id: "toolbar", route: "/appointments", target: "agenda.toolbar", title: "Choose a view", description: "Switch dates and views here. Creating or moving appointments is disabled during this tutorial.", safety: "observe", placement: "bottom" },
      { id: "calendar", route: "/appointments", target: "agenda.calendar", title: "Read the schedule", description: "Colour and position make availability, appointment category and timing easy to scan.", safety: "blocked", placement: "top" },
    ],
  },
  {
    slug: "invoices",
    version: 1,
    minimumWidth: 768,
    status: "pilot",
    steps: [
      { id: "page", route: "/invoices", target: "invoices.page", title: "Invoice management", description: "Review patient, doctor, amount and payment status from this page.", safety: "observe", placement: "bottom" },
      { id: "summary", route: "/invoices", target: "invoices.summary", title: "Financial summary", description: "These cards summarize the currently visible invoice set.", safety: "observe", placement: "bottom" },
      { id: "filters", route: "/invoices", target: "invoices.filters", title: "Find invoices needing attention", description: "Filter by status, billing type and insurance submission state. No invoice action can run during the tutorial.", safety: "blocked", placement: "bottom" },
    ],
  },
  {
    slug: "workflows",
    version: 1,
    minimumWidth: 768,
    status: "pilot",
    steps: [
      { id: "page", route: "/workflows", target: "workflows.page", title: "Workflow automation", description: "A workflow combines a trigger with one or more actions.", safety: "observe", placement: "bottom" },
      { id: "filters", route: "/workflows", target: "workflows.filters", title: "Active and inactive workflows", description: "Use these controls to review automation status without activating anything.", safety: "observe", placement: "bottom" },
      { id: "list", route: "/workflows", target: "workflows.list", title: "Review before activation", description: "Open a workflow to inspect it after leaving the tutorial. Activation and execution are blocked here.", safety: "blocked", placement: "top" },
    ],
  },
];

export const ACADEMY_EXPERIENCES = Object.fromEntries(pilotExperiences.map((experience) => [experience.slug, experience])) as Record<string, AcademyExperience>;

export function getAcademyExperience(slug: string): AcademyExperience | null {
  return ACADEMY_EXPERIENCES[slug] ?? null;
}
