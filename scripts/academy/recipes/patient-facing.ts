import type { CaptureRecipe } from "./types";

export const patientFacingRecipes: CaptureRecipe[] = [
  {
    docSlug: "patient-app",
    title: "Patient app",
    route: "/patientapp/login",
    video: false,
    loggedOut: true,
    viewport: { width: 430, height: 932 },
    steps: [
      { kind: "goto", path: "/patientapp/login", caption: "Patients sign in with a code sent to their email — no password.", settleMs: 2000 },
      { kind: "shot", name: "login", alt: "The patient app sign-in screen asking for an email address", sectionId: "signing-in" },
      { kind: "fill", target: { css: "input[type=email]" }, value: "patient@example.invalid", caption: "The address must match the one on their record.", optional: true },
      { kind: "shot", name: "login-filled", alt: "Patient app sign-in with an email entered", sectionId: "signing-in" },
    ],
  },
  {
    docSlug: "intake-and-consultations",
    title: "Intake & consultation questionnaires",
    route: "/intake",
    video: true,
    loggedOut: true,
    steps: [
      { kind: "goto", path: "/intake", caption: "Intake collects history and insurance before the patient arrives.", settleMs: 2500 },
      { kind: "shot", name: "intake", alt: "The patient intake questionnaire", sectionId: "general-intake" },
      { kind: "goto", path: "/intake/steps", caption: "The form is broken into sections the patient can work through.", settleMs: 2500 },
      { kind: "shot", name: "steps", alt: "Intake sections for patient, insurance and health background", sectionId: "general-intake" },
    ],
  },
  {
    docSlug: "forms-and-embeds",
    title: "Forms, embeds & QR codes",
    route: "/lead-import/embed-forms",
    video: true,
    steps: [
      { kind: "goto", path: "/lead-import/embed-forms", caption: "The embed addresses are here, ready to copy.", waitFor: { role: "heading", name: "Embed Form Leads" } },
      { kind: "shot", name: "embed-urls", alt: "Embed addresses for the contact and booking forms", sectionId: "embedding" },
      { kind: "goto", path: "/embedtutorial", caption: "The snippet includes a script that resizes the iframe to fit.", settleMs: 2000 },
      { kind: "shot", name: "snippet", alt: "Copy-paste embed snippets", sectionId: "embedding" },
      { kind: "goto", path: "/qr-codes", caption: "Permanent QR codes for intake and booking, designed to be printed.", waitFor: { role: "heading", name: "QR Codes" } },
      { kind: "shot", name: "qr-codes", alt: "Printable QR codes for intake and booking", sectionId: "qr-codes" },
    ],
  },
  {
    docSlug: "mobile-and-tablet",
    title: "Mobile & tablet use",
    route: "/",
    video: false,
    viewport: { width: 430, height: 932 },
    steps: [
      { kind: "goto", path: "/", caption: "The platform works on a phone.", settleMs: 3000 },
      { kind: "shot", name: "phone-dashboard", alt: "The dashboard on a phone-sized screen", sectionId: "phone-app-modes" },
      { kind: "goto", path: "/patients", caption: "Patient lookup is the most common thing done away from a desk.", settleMs: 2500 },
      { kind: "shot", name: "phone-patients", alt: "The contacts list on a phone", sectionId: "good-practice" },
    ],
  },
  {
    docSlug: "payment-pages",
    title: "Patient payment pages",
    route: "/invoice/payment-success",
    video: false,
    loggedOut: true,
    steps: [
      { kind: "goto", path: "/invoice/payment-success", caption: "What the patient sees when a payment succeeds.", settleMs: 1500 },
      { kind: "shot", name: "success", alt: "The payment successful page", sectionId: "the-outcomes" },
      { kind: "goto", path: "/invoice/payment-failed", caption: "A declined payment says so clearly.", settleMs: 1500 },
      { kind: "shot", name: "failed", alt: "The payment failed page", sectionId: "the-outcomes" },
      { kind: "goto", path: "/invoice/payment-cancelled", caption: "And a patient who backs out can follow the link again later.", settleMs: 1500 },
      { kind: "shot", name: "cancelled", alt: "The payment cancelled page", sectionId: "the-outcomes" },
    ],
  },
];
