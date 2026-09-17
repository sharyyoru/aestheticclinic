import type { DocModule } from "./types";

export const gettingStartedModules: DocModule[] = [
  {
    slug: "overview",
    title: "Platform overview",
    tagline: "What Aliice is, which problems it solves, and how the modules fit together.",
    category: "getting-started",
    icon: "rocket",
    appPath: ["Home"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "Aliice is a combined CRM and ERP for aesthetic clinics. Instead of running a booking tool, a patient file, a billing package and a marketing tool side by side, everything works on one patient record: enquiries arrive as leads, become deals, turn into appointments, generate clinical notes and photos, and end as invoices that can be billed to the patient or submitted to a Swiss insurer.",
    keyCapabilities: [
      "One patient record shared by reception, doctors and accounting",
      "Agenda with online booking, reminders and no-show follow-up",
      "Sales pipeline for enquiries, quotes and treatment plans",
      "Swiss billing with TarDoc coding and MediData insurance submission",
      "Email, WhatsApp and SMS from inside the patient file",
      "Automation, AI voice agents and an AI assistant for staff",
    ],
    sections: [
      {
        id: "who-uses-it",
        heading: "Who uses which part",
        intro:
          "Most clinics split the platform along existing responsibilities. Nothing is locked to a job title — access is controlled by your role — but this is the usual division.",
        table: {
          columns: ["Role", "Typical daily use"],
          rows: [
            [
              "Reception / front desk",
              "Agenda, online bookings, patient creation, phone and WhatsApp follow-up, tasks",
            ],
            [
              "Patient advisors / sales",
              "Leads, deals pipeline, quotes from the service catalogue, campaign follow-up",
            ],
            [
              "Doctors",
              "Patient cockpit, consultations and clinical notes, medication, photos and 3D imaging",
            ],
            [
              "Accounting",
              "Invoices, financials, MediData insurance submissions, payments and reconciliation",
            ],
            ["Management", "Dashboard, statistics reports, workflows, marketing and user administration"],
          ],
        },
      },
      {
        id: "how-work-flows",
        heading: "How work flows through the system",
        intro:
          "Understanding this chain makes the rest of the documentation easier to follow, because every module is a step in it.",
        steps: [
          {
            title: "An enquiry arrives",
            body: "Someone submits an embedded form, books online, calls the clinic, writes on WhatsApp, or arrives from a Meta ad or CSV import. It lands as a lead with its source recorded.",
          },
          {
            title: "The lead is qualified into a deal",
            body: "Interested enquiries become deals on the pipeline, with a value taken from your service catalogue and a stage that reflects how close the treatment is to being agreed.",
          },
          {
            title: "An appointment is booked",
            body: "The consultation or treatment goes into the agenda against a doctor and a room, and automated reminders are scheduled.",
          },
          {
            title: "The consultation is documented",
            body: "The doctor works in the patient file: clinical notes, intake answers, medication, photos, and optionally 3D simulations.",
          },
          {
            title: "The treatment is billed",
            body: "An invoice is created from the services delivered, priced from the catalogue and coded with TarDoc where relevant.",
          },
          {
            title: "Payment or reimbursement is collected",
            body: "Self-pay invoices go out with a payment link or Swiss QR bill; insured invoices are submitted electronically through MediData and tracked until they are paid.",
          },
          {
            title: "Follow-up is automated",
            body: "Workflows send aftercare messages, create tasks, move deals and trigger recall campaigns without anyone remembering to do it.",
          },
        ],
      },
      {
        id: "module-map",
        heading: "Module map",
        intro: "Each of these has its own page in this documentation.",
        features: [
          {
            name: "Patients & records",
            description:
              "The patient file: contact details, insurance, consultations, documents, photos, medication and 3D imaging.",
          },
          {
            name: "Scheduling",
            description:
              "Agenda, doctor availability and days off, public online booking, and automated appointment reminders.",
          },
          {
            name: "Sales & leads",
            description:
              "Deals pipeline, lead capture and import, missed-call follow-up, lead analytics and the treatment catalogue.",
          },
          {
            name: "Billing & finance",
            description:
              "Invoices, financial overview, TarDoc coding, MediData insurance submissions and payment collection.",
          },
          {
            name: "Communication",
            description: "Email, WhatsApp, SMS, internal comments and a searchable log of every message.",
          },
          {
            name: "Automation & AI",
            description:
              "Workflow builder, marketing campaigns, AI voice agents, the Aliice assistant and the AI knowledge base.",
          },
          {
            name: "Reporting",
            description: "The home dashboard plus detailed statistics reports for revenue, activity and conversion.",
          },
          {
            name: "Patient-facing tools",
            description:
              "Patient app, intake questionnaires, embeddable booking and contact forms, QR codes and payment pages.",
          },
          {
            name: "Administration",
            description: "Settings, user management, client onboarding, the Academy, knowledge base and integrations.",
          },
        ],
      },
      {
        id: "swiss-specifics",
        heading: "Built for Swiss practice",
        intro:
          "Several parts of the platform exist specifically because of how Swiss aesthetic and medical clinics bill.",
        bullets: [
          "TarDoc procedure coding for medically indicated treatments",
          "Electronic insurance submission and response tracking through MediData",
          "A directory of Swiss insurers with their billing details",
          "Swiss QR bill generation on invoices for bank payment",
          "Multi-currency awareness with CHF as the base currency",
          "Multi-language patient communication, with a language preference stored per patient",
        ],
        callouts: [
          {
            kind: "note",
            body: "Purely aesthetic treatments are normally self-pay and never go to an insurer. The billing modules keep both routes separate so a cosmetic invoice is never submitted by mistake.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Do we need to use every module?",
        answer:
          "No. The modules are independent enough to adopt in stages. Most clinics start with patients and the agenda, add deals and invoicing next, and switch on automation and AI once the basics are in daily use.",
      },
      {
        question: "Is this the same as the patient app?",
        answer:
          "No. Staff work in the main platform. Patients get a separate, much smaller interface where they can see their own appointments, invoices, records and photos.",
      },
    ],
    related: ["signing-in", "navigating-the-app", "patients", "agenda"],
    keywords: [
      "aliice",
      "clinic crm",
      "aesthetic clinic software",
      "medical erp",
      "overview",
      "getting started",
      "swiss clinic",
    ],
  },

  {
    slug: "signing-in",
    title: "Signing in",
    tagline: "How to access the platform, what to do when you cannot, and how your own profile works.",
    category: "getting-started",
    icon: "key",
    appPath: ["Sign in"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "Accounts are created by a clinic administrator — there is no public sign-up. You sign in with the email address and password you were given, and stay signed in on that browser until you sign out.",
    keyCapabilities: [
      "Sign in with email and password",
      "Return automatically to the page you were trying to open",
      "Update your profile photo and email signature",
      "Have an administrator reset your access when needed",
    ],
    sections: [
      {
        id: "how-to-sign-in",
        heading: "Signing in",
        steps: [
          {
            title: "Open the clinic address",
            body: "Use the platform address your clinic gave you. If you are not signed in, you are taken to the sign-in screen automatically.",
          },
          {
            title: "Enter your email and password",
            body: "Use the credentials provided by your administrator. Use the eye icon in the password field to check what you typed.",
          },
          {
            title: "Select Sign in",
            body: "You land on the dashboard, or on the page you originally tried to open — a deep link you followed while signed out is remembered and reopened after login.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "There is no self-registration. If you do not have an account yet, an administrator has to create one for you in User management.",
          },
        ],
      },
      {
        id: "trouble-signing-in",
        heading: "When you cannot sign in",
        intro: "The sign-in screen reports the reason directly under the form. The usual causes:",
        table: {
          columns: ["What you see", "What to do"],
          rows: [
            [
              "Invalid email or password",
              "Check for a typo or trailing space, and confirm you are using your work email address. Ask an administrator to reset your password if it persists.",
            ],
            [
              "Email and password are required",
              "One of the two fields is empty — browsers sometimes only fill one of them.",
            ],
            [
              "You keep being returned to sign-in",
              "Your session expired or cookies are blocked for the site. Sign in again, and allow cookies for the clinic address.",
            ],
            [
              "No account at all",
              "Ask an administrator to invite you. Only administrators can create accounts and set roles.",
            ],
          ],
        },
      },
      {
        id: "your-profile",
        heading: "Your own profile",
        intro:
          "Your profile holds the two things other people see when you work: your photo, and the signature added to the emails you send from the platform.",
        steps: [
          {
            title: "Open your profile",
            body: "Select your avatar at the top right of the screen, then Your profile.",
          },
          {
            title: "Upload a profile photo",
            body: "Your photo appears on comments, notes, tasks and activity entries, which makes shared patient files much easier to read.",
          },
          {
            title: "Set your email signature",
            body: "This signature is appended to outgoing patient email sent under your name, so replies look consistent whoever writes them.",
          },
        ],
      },
      {
        id: "signing-out",
        heading: "Signing out and shared computers",
        bullets: [
          "Sign out from the avatar menu at the top right when you leave a shared workstation.",
          "Sessions persist per browser, so signing in on the reception computer does not sign you out on your own.",
          "Never share one login between several people — notes, activity entries and invoices are all attributed to whoever is signed in.",
        ],
        callouts: [
          {
            kind: "important",
            body: "Patient data is medical data. Lock or sign out of any workstation left unattended in a patient-accessible area.",
          },
        ],
      },
    ],
    related: ["navigating-the-app", "roles-and-permissions", "user-management", "my-profile"],
    keywords: ["login", "sign in", "password", "access", "account", "session", "authentication"],
  },

  {
    slug: "navigating-the-app",
    title: "Finding your way around",
    tagline: "The two layouts, the menus, global search, patient tabs and dark mode.",
    category: "getting-started",
    icon: "dashboard",
    appPath: ["Anywhere"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "The platform has two interface layouts covering the same features — a modern top-bar layout and a classic sidebar layout — plus a few navigation aids you will use constantly: the module menu behind the logo, the favourites bar, global patient search, and multi-patient tabs.",
    keyCapabilities: [
      "Switch between the modern and classic layouts",
      "Reach any module from the logo menu",
      "Jump to frequently used pages from the favourites bar",
      "Search for a patient from anywhere",
      "Keep several patient files open at once",
      "Switch to dark mode",
    ],
    sections: [
      {
        id: "two-layouts",
        heading: "Modern and classic layouts",
        intro:
          "Both layouts expose the same modules; only the chrome differs. Pick whichever your team prefers — the choice is per user and is remembered.",
        features: [
          {
            name: "Modern layout",
            description:
              "A slim top bar with HOME, AGENDA, DEALS and PATIENTS, a favourites bar, notification icons on the right, and the full module list behind the logo. Supports dark mode.",
          },
          {
            name: "Classic layout",
            description:
              "A left sidebar listing every module, with the header above it. Always light. Useful on large screens where you want the whole module list permanently visible.",
          },
        ],
        steps: [
          {
            title: "Open the logo menu",
            body: "Select the clinic logo at the top left of the modern layout.",
          },
          {
            title: "Choose the layout toggle at the bottom of the menu",
            body: "It reads Use Classic Layout or Use Modern Layout depending on where you are. The switch takes effect immediately.",
          },
        ],
      },
      {
        id: "module-menu",
        heading: "The module menu",
        intro:
          "The dropdown behind the logo is the complete map of the platform. Items with a chevron expand to show their sub-pages.",
        bullets: [
          "Dashboard, Patients, Agenda and Deals & Pipeline for daily work",
          "Lead Import, which expands to CSV Import, Import History, Meta & Zapier Leads, Aliice Calls and Embed Forms",
          "Financials, Invoices, MediData and Services for the commercial side",
          "Tasks, User Management, Workflows (with Templates), AI Agents and Marketing (with New Campaign)",
          "Controllers, Email Reports and Statistics",
          "Chat with Aliice, which expands to include Chat Logs",
          "Client Onboarding and Invoice Linker",
          "Settings and Knowledgebase in a separate group at the bottom",
        ],
      },
      {
        id: "favourites-and-search",
        heading: "Favourites bar and global patient search",
        features: [
          {
            name: "Favourites bar",
            description:
              "A row of shortcuts under the top bar for Dashboard, Patients, Agenda, Deals, Financials, Missed Calls and Academy, with the current page highlighted.",
          },
          {
            name: "Global patient search",
            description:
              "A search box in the header that finds patients from anywhere in the platform. Start typing a name, pick a result, and you land straight on that patient file. Press Escape to dismiss it.",
          },
          {
            name: "Back and forward",
            description:
              "Arrows next to the logo move through your history inside the app, which is quicker than the browser buttons when you are deep in a patient file.",
          },
        ],
      },
      {
        id: "patient-tabs",
        heading: "Working on several patients at once",
        intro:
          "Opening a patient file adds it to a tab bar that stays with you while you move around the platform — useful on the phone when a second patient calls mid-task.",
        steps: [
          { title: "Open a patient", body: "The patient is added as a tab under the header." },
          {
            title: "Open another patient",
            body: "The previous tab stays. Switch between open files by selecting their tabs.",
          },
          {
            title: "Close what you no longer need",
            body: "Use the cross on a tab to close one file, or clear all tabs at once when you have finished the batch.",
          },
        ],
        callouts: [
          {
            kind: "tip",
            body: "The tab bar is hidden on public pages such as booking and payment screens, so it never appears in front of patients.",
          },
        ],
      },
      {
        id: "notifications-icons",
        heading: "The notification icons",
        intro:
          "The icons at the top right of the modern layout are unread counters. Each opens the matching inbox.",
        table: {
          columns: ["Icon", "What it counts"],
          rows: [
            ["Tasks", "Tasks assigned to you that are still open"],
            ["Deal notifications", "Movement on deals you are involved in"],
            ["Email reports", "Delivery and reply reports on email you sent"],
            ["Insurance email", "Incoming insurer correspondence needing attention"],
            ["Notifications", "General system notifications"],
            ["Comments", "Comments and @mentions addressed to you"],
            ["WhatsApp", "Unread WhatsApp conversations"],
          ],
        },
      },
      {
        id: "dark-mode",
        heading: "Dark mode",
        steps: [
          {
            title: "Use the theme toggle in the top bar",
            body: "It switches the interface between light and dark and remembers your choice on that browser.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "Dark mode applies to the modern layout. The classic sidebar layout always renders light, as do public pages such as booking, intake and this documentation.",
          },
        ],
      },
    ],
    related: ["overview", "patients", "dashboard", "roles-and-permissions"],
    keywords: [
      "navigation",
      "menu",
      "layout",
      "dark mode",
      "theme",
      "favourites",
      "global search",
      "patient tabs",
      "shortcuts",
    ],
  },

  {
    slug: "roles-and-permissions",
    title: "Roles & permissions",
    tagline: "The difference between Staff and Admin, and how doctors are handled separately.",
    category: "getting-started",
    icon: "shield",
    appPath: ["Menu", "User Management"],
    audience: ["admin"],
    summary:
      "Every account has one of two roles: Staff or Admin. Staff can do the clinical and commercial day-to-day work; Admin additionally manages accounts and roles. Doctors are not a login role — they are configured as providers so they can be scheduled and billed against.",
    keyCapabilities: [
      "Assign Staff or Admin to each account",
      "Restrict user administration to administrators",
      "Configure doctors as bookable, billable providers",
      "See who did what through activity entries and attribution",
    ],
    sections: [
      {
        id: "the-two-roles",
        heading: "The two roles",
        table: {
          columns: ["Role", "What it allows"],
          rows: [
            [
              "Staff",
              "Full day-to-day use: patients, agenda, deals, invoices, communication, tasks, workflows and reports.",
            ],
            [
              "Admin",
              "Everything Staff can do, plus User management: inviting accounts, changing roles and deactivating people who leave.",
            ],
          ],
        },
        callouts: [
          {
            kind: "note",
            body: "New accounts default to Staff. Only an existing administrator can promote someone to Admin.",
          },
        ],
      },
      {
        id: "doctors-are-providers",
        heading: "Doctors are configured, not just assigned a role",
        intro:
          "Being a doctor in the clinic affects scheduling and billing rather than login rights, so it is set up outside User management.",
        bullets: [
          "Providers and their billing identifiers are maintained under Settings › Providers & Billing",
          "Working hours are set under Settings › Doctor Scheduling",
          "Absences are entered under Settings › Doctor Days Off",
          "Public booking pages exist per doctor once a doctor is bookable",
        ],
      },
      {
        id: "accountability",
        heading: "Accountability",
        intro:
          "Because several people work on the same patient file, the platform records who did what.",
        bullets: [
          "Patients carry a contact owner, so it is clear who is responsible for the relationship",
          "Notes, comments and activity entries are stamped with the author",
          "The Activity by User report in Statistics summarises what each account did over a period",
          "When two people open the same patient file, an editing indicator warns them so changes are not overwritten",
        ],
        callouts: [
          {
            kind: "important",
            body: "Shared logins destroy all of the above. Give every person their own account.",
          },
        ],
      },
    ],
    related: ["user-management", "signing-in", "settings", "statistics"],
    keywords: ["roles", "permissions", "admin", "staff", "access control", "providers", "doctors"],
  },
];
