import type { DocModule } from "./types";

export const adminSetupModules: DocModule[] = [
  {
    slug: "settings",
    title: "Settings",
    tagline: "The eight configuration areas that shape how the rest of the platform behaves.",
    category: "admin-setup",
    icon: "settings",
    appPath: ["Menu", "Settings"],
    audience: ["admin"],
    summary:
      "Settings is organised as eight tabs, each covering one area of configuration. Most of it is set up once during onboarding and then touched only when something real changes — a new doctor, a holiday, a new laboratory.",
    keyCapabilities: [
      "Change the interface appearance",
      "Configure external laboratories",
      "Maintain providers and their billing identifiers",
      "Set doctor working hours and days off",
      "Block dates for the whole clinic",
      "Configure the MediData connection",
      "Maintain WhatsApp message templates",
    ],
    sections: [
      {
        id: "the-tabs",
        heading: "The eight tabs",
        table: {
          columns: ["Tab", "What it controls"],
          rows: [
            ["Appearance", "How the interface looks."],
            ["External labs", "The laboratories the clinic sends work to."],
            ["Providers & billing", "Billing entities, doctors and the identifiers used on invoices and insurance submissions."],
            ["Doctor scheduling", "Working hours and appointment slot durations per doctor."],
            ["Doctor days off", "Individual absences per doctor."],
            ["Blocked dates", "Dates closed for the whole clinic."],
            ["MediData connection", "The connection used to submit invoices to insurers."],
            ["WhatsApp templates", "The message templates used for patient WhatsApp."],
          ],
        },
      },
      {
        id: "providers-billing",
        heading: "Providers & billing",
        intro:
          "This is the most consequential tab. The identifiers held here appear on every invoice and every insurance submission, and a wrong one causes rejections that are hard to diagnose from the invoice itself.",
        bullets: [
          "Billing entities are who invoices are issued by",
          "Doctors are the treating providers, with their own identifiers",
          "Other provider roles such as nurse and technician are supported for reporting",
          "Statistics reports filter by billing entity and by doctor using exactly these records",
        ],
        callouts: [
          {
            kind: "warning",
            body: "Do not edit a provider's identifiers to correct a single invoice. Fix the invoice, and change the provider record only when the real-world identifier has changed.",
          },
        ],
      },
      {
        id: "scheduling-tabs",
        heading: "Scheduling: hours, days off and blocked dates",
        intro:
          "Three tabs, three different jobs. Together they decide what can be booked, internally and by patients.",
        bullets: [
          "Doctor scheduling — the recurring pattern and the slot durations, from 5 minutes up to 2 hours",
          "Doctor days off — one doctor, specific dates",
          "Blocked dates — every doctor, specific dates",
        ],
        callouts: [
          {
            kind: "note",
            body: "Blocking a date does not cancel appointments already booked on it. Check the agenda afterwards.",
          },
        ],
      },
      {
        id: "medidata",
        heading: "MediData connection",
        bullets: [
          "Configured once, then used by every insurance submission",
          "If submissions stop leaving the platform, this is the first place to look",
          "Responses and network notifications are read on the MediData page, not here",
        ],
      },
      {
        id: "whatsapp-templates",
        heading: "WhatsApp templates",
        bullets: [
          "Used by both manual sending and automated appointment messages",
          "Keeping them current is what makes automated messages read like your clinic",
          "Templates carry variables filled from the patient record — check the mapping when you add one",
        ],
      },
      {
        id: "external-labs",
        heading: "External labs",
        bullets: [
          "Register the laboratories the clinic works with",
          "Used where clinical work is sent out and results come back",
          "Keep contact details current so results are not chased by phone",
        ],
      },
    ],
    related: ["doctor-availability", "medidata-insurance", "whatsapp", "user-management"],
    keywords: [
      "settings",
      "configuration",
      "providers",
      "billing entity",
      "doctor scheduling",
      "blocked dates",
      "medidata",
      "whatsapp templates",
      "labs",
    ],
  },

  {
    slug: "user-management",
    title: "User management",
    tagline: "Invite colleagues, set their role, and remove access when they leave.",
    category: "admin-setup",
    icon: "users",
    appPath: ["Menu", "User Management"],
    audience: ["admin"],
    summary:
      "User management is restricted to administrators. From here you create accounts, assign Staff or Admin, change a role later, and search the team list. Doctors' clinical and billing configuration is separate, under Settings.",
    keyCapabilities: [
      "Create accounts for colleagues",
      "Assign Staff or Admin",
      "Change a role after the fact",
      "Search the team by name, email or role",
      "Page through a long team list",
      "Remove access for people who leave",
    ],
    sections: [
      {
        id: "creating-an-account",
        heading: "Creating an account",
        steps: [
          { title: "Open User Management", body: "Only administrators see the management controls." },
          { title: "Create a new user", body: "Enter their name and work email address." },
          {
            title: "Choose the role",
            body: "Staff is the default and is right for almost everyone. Admin adds the ability to manage users.",
          },
          {
            title: "Pass on the credentials securely",
            body: "There is no self-registration, so the person needs what you set. Do not send credentials over an unprotected channel.",
          },
        ],
        callouts: [
          {
            kind: "important",
            body: "One account per person, always. Shared logins destroy the attribution that notes, activity history, invoices and the Activity by user report depend on.",
          },
        ],
      },
      {
        id: "changing-roles",
        heading: "Changing a role",
        steps: [
          { title: "Find the person", body: "Search by name, email or role." },
          { title: "Change their role", body: "Between Staff and Admin." },
          { title: "Tell them", body: "A change in what they can see is otherwise confusing." },
        ],
        bullets: [
          "The current role is shown against each person, defaulting to Staff where none is set",
          "The team list is paginated, so a large clinic stays navigable",
        ],
      },
      {
        id: "people-who-leave",
        heading: "When someone leaves",
        steps: [
          { title: "Remove their access the same day", body: "Not at the end of the month." },
          {
            title: "Reassign their work",
            body: "Patients they owned, open tasks, and deals they were responsible for.",
          },
          {
            title: "Leave their history alone",
            body: "Notes, invoices and activity stay attributed to them, which is correct and required for audit.",
          },
        ],
      },
      {
        id: "doctors",
        heading: "Doctors need more than an account",
        bullets: [
          "Create their user account here so they can sign in",
          "Add them as a provider under Settings › Providers & Billing so they can be billed against",
          "Set their hours under Settings › Doctor Scheduling so they can be booked",
          "Enter absences under Settings › Doctor Days Off",
        ],
      },
    ],
    related: ["roles-and-permissions", "settings", "controllers", "my-profile"],
    keywords: ["users", "invite", "roles", "admin", "staff", "access", "offboarding", "team"],
  },

  {
    slug: "my-profile",
    title: "Your profile",
    tagline: "Your photo and the email signature used on your outgoing messages.",
    category: "admin-setup",
    icon: "user",
    appPath: ["Avatar", "Your profile"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "Your profile is short by design: a photograph and an email signature. Both matter more than they sound — the photo makes shared patient files readable, and the signature is what patients see at the bottom of everything you send.",
    keyCapabilities: [
      "Upload a profile photo",
      "Set the signature used on outgoing email",
    ],
    sections: [
      {
        id: "editing",
        heading: "Updating your profile",
        steps: [
          { title: "Open your avatar menu at the top right", body: "Then Your profile." },
          {
            title: "Upload a photo",
            body: "A real photograph, not an initial. It appears on your notes, comments, tasks and activity entries.",
          },
          {
            title: "Write your email signature",
            body: "Name, role and the clinic's contact details. It is appended to email you send from the platform.",
          },
        ],
      },
      {
        id: "why-it-matters",
        heading: "Why it matters",
        bullets: [
          "A patient file worked on by five people is far easier to read when the photos are real",
          "A consistent signature makes automated and manual correspondence look like the same clinic",
          "Patients reply to the person who wrote to them — the signature is what tells them who that was",
        ],
        callouts: [
          {
            kind: "note",
            body: "Password changes and role changes are not done here. Ask an administrator.",
          },
        ],
      },
    ],
    related: ["signing-in", "email", "user-management"],
    keywords: ["profile", "avatar", "photo", "signature", "email signature", "account"],
  },

  {
    slug: "client-onboarding",
    title: "Client onboarding",
    tagline: "The six-step guided setup for a clinic joining the platform.",
    category: "admin-setup",
    icon: "rocket",
    appPath: ["Menu", "Client Onboarding"],
    audience: ["admin"],
    summary:
      "Onboarding a new clinic is run as a six-step questionnaire completed by the clinic itself. A magic link is generated and sent to them; they work through the steps at their own pace, and progress is visible so nothing stalls unnoticed.",
    keyCapabilities: [
      "Generate a magic link for a new clinic",
      "Track progress through six steps",
      "See which step each submission has reached",
      "See completed submissions",
      "Review the details a clinic submitted",
    ],
    sections: [
      {
        id: "the-six-steps",
        heading: "The six steps",
        table: {
          columns: ["Step", "What it collects"],
          rows: [
            ["1. Practice identity", "Who the clinic is, its sites and its main contact."],
            ["2. User management", "Who needs an account and what they do."],
            ["3. Data migration", "What data is coming from the previous system."],
            ["4. Clinical services", "The treatments offered, which becomes the service catalogue."],
            ["5. Marketing", "Channels in use, and what needs connecting."],
            ["6. Compliance", "Regulatory and data-protection requirements."],
          ],
        },
      },
      {
        id: "running-it",
        heading: "Running an onboarding",
        steps: [
          { title: "Generate a magic link", body: "One per clinic being onboarded." },
          { title: "Send it to the clinic's main contact", body: "They do not need an account to complete it." },
          {
            title: "Watch the progress",
            body: "Each submission shows the step reached out of six, as a percentage and as a step-by-step indicator.",
          },
          {
            title: "Chase what stalls",
            body: "A submission sitting on the same step for a week needs a phone call, not another email.",
          },
          { title: "Review the completed submission", body: "Then configure the platform from what they told you." },
        ],
      },
      {
        id: "what-to-do-with-answers",
        heading: "Turning answers into configuration",
        bullets: [
          "Practice identity and compliance → Settings › Providers & Billing",
          "User management → create the accounts in User Management",
          "Clinical services → build the catalogue in Services",
          "Data migration → plan the imports with Lead Import and patient creation",
          "Marketing → connect the channels and set up campaigns and forms",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Build the service catalogue before importing anything. Deals and invoices price themselves from it, and retro-fitting prices is far more work.",
          },
        ],
      },
    ],
    related: ["settings", "user-management", "services", "integrations"],
    keywords: ["onboarding", "setup", "magic link", "implementation", "new clinic", "migration", "go live"],
  },

  {
    slug: "academy",
    title: "Aliice Academy",
    tagline: "Training modules, lessons and certificates for your team.",
    category: "admin-setup",
    icon: "academy",
    appPath: ["Menu", "Academy"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "The Academy is the in-platform training course. Modules contain lessons, each with an estimated time; progress is tracked as lessons are completed, and a certificate is issued at the end. An AI assistant is available while you learn.",
    keyCapabilities: [
      "Work through training modules at your own pace",
      "See the estimated time for each module and the course total",
      "Mark lessons complete and track your progress",
      "Watch video lessons where they exist",
      "Ask the AI assistant questions while learning",
      "Receive a certificate on completion",
    ],
    sections: [
      {
        id: "how-it-works",
        heading: "How it works",
        steps: [
          { title: "Open the Academy", body: "The header shows how many modules there are and the total time." },
          { title: "Check your progress summary", body: "It shows what you have completed and what is left." },
          { title: "Open a module", body: "Modules list their lessons in order." },
          {
            title: "Work through the lessons",
            body: "Mark each one complete as you finish it — that is what drives the progress figures.",
          },
          { title: "Collect the certificate", body: "Issued when you have completed the course." },
        ],
      },
      {
        id: "using-it-as-a-manager",
        heading: "Using it to onboard staff",
        bullets: [
          "Make the Academy the first thing a new colleague does, before they touch real patient data",
          "The estimated times let you block out training properly instead of hoping it happens",
          "Certificates give you evidence that training was completed",
          "Pair it with this documentation: the Academy teaches the workflow, the documentation is the reference",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Have new staff practise on a deliberately created test patient. Training on a real patient file is how mistakes end up in medical records.",
          },
        ],
      },
    ],
    related: ["knowledge-base", "overview", "user-management", "navigating-the-app"],
    keywords: ["academy", "training", "lessons", "modules", "certificate", "learning", "onboarding staff"],
  },

  {
    slug: "knowledge-base",
    title: "Knowledge base",
    tagline: "The clinic's own reference material, organised by topic with attachments.",
    category: "admin-setup",
    icon: "support",
    appPath: ["Menu", "Knowledgebase"],
    audience: ["staff", "admin"],
    summary:
      "The knowledge base holds the clinic's own material: protocols, aftercare texts, price explanations, anything the team needs to look up. Topics can be pinned, searched, sorted and archived, and files attached to them are browsable on their own.",
    keyCapabilities: [
      "Organise material into topics with an icon and colour",
      "Pin the topics used most",
      "Attach files to a topic",
      "Browse all attachments in one place",
      "Search and sort topics",
      "Switch between grid and list view",
      "Archive topics that are out of date",
    ],
    sections: [
      {
        id: "topics",
        heading: "Topics",
        bullets: [
          "Each topic has a title, a description, an icon and a colour, which makes a long list scannable",
          "Message and attachment counts show how substantial a topic is",
          "The last activity time shows what is being maintained and what has been abandoned",
          "Pinned topics stay at the top for everyone",
        ],
      },
      {
        id: "finding-things",
        heading: "Finding things",
        table: {
          columns: ["Control", "What it does"],
          rows: [
            ["Search", "Finds a topic by name or description."],
            ["Sort", "By last updated, created date, number of messages or number of files."],
            ["View", "Grid for browsing, list for scanning a long collection."],
            ["Files tab", "Every attachment across all topics, with its type and size."],
            ["Archived tab", "Topics taken out of circulation but kept."],
          ],
        },
      },
      {
        id: "what-to-put-in-it",
        heading: "What belongs here",
        bullets: [
          "Aftercare instructions per treatment, as the source for email templates",
          "Pricing explanations and what is included",
          "Clinical protocols and standard operating procedures",
          "How the clinic handles common patient questions",
          "Onboarding notes for new staff, alongside the Academy",
        ],
        callouts: [
          {
            kind: "warning",
            body: "Archive rather than leave out-of-date material lying around. A stale price or protocol in the knowledge base will be quoted to a patient sooner or later.",
          },
        ],
      },
    ],
    related: ["academy", "aliice-assistant", "email-templates"],
    keywords: ["knowledge base", "topics", "protocols", "attachments", "reference", "archive", "documentation"],
  },

  {
    slug: "integrations",
    title: "Integrations",
    tagline: "The external services the platform connects to, and what each one needs from you.",
    category: "admin-setup",
    icon: "integrations",
    appPath: ["Menu", "Settings"],
    audience: ["admin"],
    summary:
      "Several features depend on external services. Connecting them is an administrator task done once, and knowing which service sits behind which feature is what lets you diagnose an outage quickly rather than assuming the platform is broken.",
    keyCapabilities: [
      "Understand which feature depends on which service",
      "Know what your clinic must provide for each",
      "Diagnose an outage to the right service",
      "Plan which integrations a new clinic needs",
    ],
    sections: [
      {
        id: "the-integrations",
        heading: "What connects to what",
        table: {
          columns: ["Service", "What it powers", "What your clinic provides"],
          rows: [
            ["Email delivery", "All outgoing patient email, replies, reminders and campaigns.", "A sending domain for the clinic."],
            ["WhatsApp", "Patient WhatsApp conversations, confirmations and reminders.", "A business WhatsApp connection."],
            ["SMS", "Text messages as a fallback channel.", "A messaging account."],
            ["Card payments", "Payment links, instalments and automatic invoice updates.", "A payment provider account."],
            ["MediData", "Electronic insurance submission and insurer responses.", "Clinic and provider identifiers."],
            ["Crisalix", "3D face and body imaging in the patient file.", "A Crisalix account."],
            ["AI voice agents", "Inbound and outbound AI phone calls.", "A phone number for the agent."],
            ["AI assistant", "The Aliice assistant, chat widget and content generation.", "Nothing beyond the platform."],
            ["Meta & Zapier", "Live lead capture from ad platforms and other tools.", "Access to the ad account or Zapier."],
          ],
        },
      },
      {
        id: "diagnosing",
        heading: "Diagnosing a problem",
        table: {
          columns: ["Symptom", "Where to look"],
          rows: [
            ["Email is not arriving", "Email Reports — check whether the send failed or succeeded."],
            ["WhatsApp is not sending", "The WhatsApp connection. Appointment messages will still go by email."],
            ["Insurance submissions are not leaving", "Settings › MediData Connection, then the MediData submissions view."],
            ["A payment did not register", "The invoice — re-synchronise the payment status with the provider."],
            ["The 3D tab is empty or missing", "The Crisalix connection, and whether 3D is enabled for your clinic."],
            ["Leads stopped arriving from ads", "The Meta or Zapier connection, and Lead Import › Meta & Zapier Leads."],
          ],
        },
        callouts: [
          {
            kind: "note",
            body: "Automations that call external systems are queued and retried, so a short outage delays rather than loses events.",
          },
        ],
      },
      {
        id: "security",
        heading: "Security and access",
        bullets: [
          "Credentials for external services are held by your administrator and are never displayed in the interface",
          "Embedded pages are restricted to approved website domains",
          "Give each colleague their own account rather than sharing one",
          "Review who has Admin rights periodically — it is the role that can change everyone else's access",
        ],
        callouts: [
          {
            kind: "important",
            body: "Never send credentials for these services by email or chat. If you believe one has been exposed, tell your administrator immediately so it can be rotated.",
          },
        ],
      },
    ],
    related: ["settings", "medidata-insurance", "whatsapp", "payments", "3d-imaging"],
    keywords: [
      "integrations",
      "connections",
      "email delivery",
      "whatsapp",
      "payments",
      "medidata",
      "crisalix",
      "zapier",
      "troubleshooting",
    ],
  },
];
