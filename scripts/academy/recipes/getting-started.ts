import type { CaptureRecipe } from "./types";

export const gettingStartedRecipes: CaptureRecipe[] = [
  {
    docSlug: "overview",
    title: "Platform overview",
    route: "/",
    video: false,
    steps: [
      { kind: "goto", path: "/", caption: "The dashboard is where every day starts.", waitFor: { text: "Open Tasks" } },
      { kind: "shot", name: "dashboard", alt: "The Aliice dashboard showing today's figures, tasks and shortcuts", sectionId: "module-map" },
      { kind: "goto", path: "/patients", caption: "Patients sit at the centre of everything.", waitFor: { role: "heading", name: "Contacts" } },
      { kind: "shot", name: "patients", alt: "The contacts list", sectionId: "how-work-flows" },
      { kind: "goto", path: "/appointments", caption: "The agenda drives the clinical day.", settleMs: 2500 },
      { kind: "shot", name: "agenda", alt: "The clinic agenda", sectionId: "how-work-flows" },
      { kind: "goto", path: "/invoices", caption: "Treatment ends in an invoice.", waitFor: { role: "heading", name: "Invoices" } },
      { kind: "shot", name: "invoices", alt: "The invoices list", sectionId: "swiss-specifics" },
    ],
  },
  {
    docSlug: "signing-in",
    title: "Signing in",
    route: "/login",
    video: false,
    loggedOut: true,
    steps: [
      { kind: "goto", path: "/login", caption: "The sign-in screen.", waitFor: { text: "Sign in to your clinic" } },
      { kind: "shot", name: "sign-in", alt: "The sign-in screen with email and password fields", sectionId: "how-to-sign-in" },
      { kind: "fill", target: { label: "Email" }, value: "you@clinic.example", caption: "Enter the address your administrator gave you." },
      { kind: "shot", name: "sign-in-filled", alt: "Sign-in form with an email address entered", sectionId: "how-to-sign-in" },
    ],
  },
  {
    docSlug: "navigating-the-app",
    title: "Finding your way around",
    route: "/",
    video: true,
    steps: [
      { kind: "goto", path: "/", caption: "Everything is reachable from the top bar.", waitFor: { text: "Open Tasks" } },
      { kind: "shot", name: "top-bar", alt: "The top bar with HOME, AGENDA, DEALS and PATIENTS", sectionId: "two-layouts" },
      { kind: "click", target: { css: "header button:has(img)" }, caption: "The logo opens the full module menu.", optional: true },
      { kind: "wait", ms: 600 },
      { kind: "shot", name: "module-menu", alt: "The module menu listing every area of the platform", sectionId: "module-menu" },
      { kind: "press", key: "Escape", caption: "Escape closes it again." },
      { kind: "caption", text: "The favourites bar keeps your most-used pages one click away." },
      { kind: "shot", name: "favourites", alt: "The favourites bar", sectionId: "favourites-and-search" },
      { kind: "goto", path: "/patients", caption: "Opening a patient adds it to your tabs, so you can keep several open.", waitFor: { role: "heading", name: "Contacts" } },
      { kind: "shot", name: "patient-tabs", alt: "The patients list, from which patient tabs are opened", sectionId: "patient-tabs" },
    ],
  },
  {
    docSlug: "roles-and-permissions",
    title: "Roles & permissions",
    route: "/users",
    video: false,
    steps: [
      { kind: "goto", path: "/users", caption: "User management is where roles are set.", waitFor: { role: "heading", name: "User Management" } },
      { kind: "shot", name: "user-list", alt: "The user list showing each account's role", sectionId: "the-two-roles" },
      { kind: "goto", path: "/settings", caption: "Doctors are configured separately, under Settings.", waitFor: { role: "heading", name: "Settings" } },
      { kind: "shot", name: "settings-tabs", alt: "Settings tabs including Providers & Billing and Doctor Scheduling", sectionId: "doctors-are-providers" },
    ],
  },
];
