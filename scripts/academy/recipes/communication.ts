import type { CaptureRecipe } from "./types";

export const communicationRecipes: CaptureRecipe[] = [
  {
    docSlug: "email",
    title: "Email",
    route: "/email-reports",
    video: true,
    steps: [
      { kind: "goto", path: "/email-reports", caption: "Email Reports is the delivery log for everything you send.", settleMs: 2500 },
      { kind: "shot", name: "reports", alt: "Email reports with totals for sent and failed messages", sectionId: "email-reports" },
      { kind: "caption", text: "Filter by direction, status, source and date to find one problem message." },
      { kind: "shot", name: "filters", alt: "Email report filters", sectionId: "email-reports" },
      { kind: "goto", path: "/notifications/email-replies", caption: "Patient replies come back into the platform.", settleMs: 2000 },
      { kind: "shot", name: "replies", alt: "Incoming email replies", sectionId: "receiving" },
      { kind: "goto", path: "/workflows/templates", caption: "Templates are shared by manual sending, workflows and campaigns.", waitFor: { role: "heading", name: "Email Templates" } },
      { kind: "shot", name: "templates", alt: "The email template library", sectionId: "templates" },
    ],
  },
  {
    docSlug: "whatsapp",
    title: "WhatsApp",
    route: "/settings",
    video: false,
    steps: [
      { kind: "goto", path: "/settings", caption: "WhatsApp templates are maintained in Settings.", waitFor: { role: "heading", name: "Settings" } },
      { kind: "click", target: { text: "WhatsApp Templates" }, caption: "Templates used by manual sending and automation alike.", optional: true },
      { kind: "wait", ms: 1500 },
      { kind: "shot", name: "templates", alt: "WhatsApp message templates", sectionId: "templates" },
      { kind: "goto", path: "/lead-import/resend-whatsapp", caption: "Messages that failed can be re-sent once the number is corrected.", settleMs: 2000 },
      { kind: "shot", name: "resend", alt: "Resending failed WhatsApp messages", sectionId: "queue-and-failures" },
    ],
  },
  {
    docSlug: "sms",
    title: "SMS",
    route: "/chatlogs",
    video: false,
    steps: [
      { kind: "goto", path: "/chatlogs", caption: "SMS sends appear in the communication history alongside every other channel.", waitFor: { role: "heading", name: "Communication Logs" } },
      { kind: "shot", name: "logs", alt: "Communication logs including SMS activity", sectionId: "sending" },
    ],
  },
  {
    docSlug: "internal-chat-and-comments",
    title: "Comments, mentions & tasks",
    route: "/tasks",
    video: true,
    steps: [
      { kind: "goto", path: "/tasks", caption: "Tasks are the unit of follow-up — they have an owner.", waitFor: { role: "heading", name: "Tasks" } },
      { kind: "shot", name: "tasks", alt: "The tasks list", sectionId: "tasks" },
      { kind: "goto", path: "/comments", caption: "Every mention addressed to you collects in one place.", waitFor: { role: "heading", name: "Comments" } },
      { kind: "shot", name: "comments", alt: "Mentions from patient notes and task comments", sectionId: "mentions" },
      { kind: "goto", path: "/notifications", caption: "Each header icon is its own queue.", settleMs: 2000 },
      { kind: "shot", name: "notifications", alt: "The notifications centre", sectionId: "notifications-centre" },
    ],
  },
  {
    docSlug: "communication-logs",
    title: "Communication logs",
    route: "/chatlogs",
    video: true,
    steps: [
      { kind: "goto", path: "/chatlogs", caption: "Every conversation the clinic had, including AI calls.", waitFor: { role: "heading", name: "Communication Logs" } },
      { kind: "shot", name: "list", alt: "Communication logs with type, status and source filters", sectionId: "filters" },
      { kind: "caption", text: "Filter to conversations not linked to a patient — those are enquiries nobody picked up." },
      { kind: "shot", name: "filters", alt: "Conversation filters", sectionId: "filters" },
      { kind: "caption", text: "Each conversation carries its transcript and the data it captured." },
      { kind: "shot", name: "detail", alt: "A conversation with transcript and extracted data", sectionId: "reading-a-conversation" },
    ],
  },
];
