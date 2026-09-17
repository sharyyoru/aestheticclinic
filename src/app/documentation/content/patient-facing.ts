import type { DocModule } from "./types";

export const patientFacingModules: DocModule[] = [
  {
    slug: "patient-app",
    title: "Patient app",
    tagline: "What your patients see: their appointments, invoices, records and photos.",
    category: "patient-facing",
    icon: "heart",
    appPath: ["Patient app"],
    audience: ["patient", "staff"],
    summary:
      "Patients get their own small interface, separate from the staff platform. They sign in with a one-time code sent to their email address — no password to forget — and see only their own appointments, invoices, medical records, photos and profile.",
    keyCapabilities: [
      "Sign in with a code sent by email, without a password",
      "See upcoming and past appointments",
      "See invoices and pay them",
      "See medical records shared with them",
      "See their photographs",
      "Check and correct their own profile details",
    ],
    sections: [
      {
        id: "signing-in",
        heading: "How a patient signs in",
        steps: [
          { title: "The patient enters their email address", body: "It must be the address held on their record." },
          { title: "A six-digit code is emailed to them", body: "" },
          { title: "They enter the code", body: "They are signed in. There is no password to create, forget or reset." },
        ],
        callouts: [
          {
            kind: "note",
            body: "If a patient cannot sign in, the usual cause is a different or misspelt email address on their record. Check it in the patient file and correct it.",
          },
        ],
      },
      {
        id: "what-patients-see",
        heading: "What the patient sees",
        table: {
          columns: ["Section", "Contents"],
          rows: [
            ["Home", "A greeting and an overview of what needs their attention."],
            ["My appointments", "Upcoming and past appointments with dates and times."],
            ["My invoices", "Their invoices, and the ability to pay outstanding ones."],
            ["My medical records", "Records shared with them."],
            ["My photos", "Photographs from their treatment."],
            ["My profile", "Their own contact details."],
          ],
        },
        callouts: [
          {
            kind: "important",
            body: "Patients see only their own data. Even so, remember that anything on their record may be read by them — write clinical notes accordingly.",
          },
        ],
      },
      {
        id: "supporting-patients",
        heading: "Supporting patients on it",
        bullets: [
          "Point them at the app instead of emailing documents when they ask for a copy of something",
          "Encourage payment through the app rather than by bank transfer with a missing reference",
          "If a patient reports missing information, check what is actually on their record — the app shows only what exists",
          "Correcting an email address in the patient file immediately fixes their sign-in",
        ],
      },
    ],
    related: ["payment-pages", "patient-record", "documents", "invoices"],
    keywords: ["patient app", "patient portal", "otp", "one time code", "my appointments", "my invoices", "photos"],
  },

  {
    slug: "intake-and-consultations",
    title: "Intake & consultation questionnaires",
    tagline: "Collect history, insurance and treatment goals before the patient arrives.",
    category: "patient-facing",
    icon: "clipboard",
    appPath: ["Intake"],
    audience: ["patient", "staff", "doctor"],
    summary:
      "Intake questionnaires collect the information a consultation would otherwise spend twenty minutes gathering: identity, insurance, health background and how the patient wants to be contacted. Treatment-specific questionnaires go further, asking about goals, prior procedures, measurements and photographs.",
    keyCapabilities: [
      "Collect patient identity and insurance details before arrival",
      "Collect health background and contact preferences",
      "Run treatment-specific questionnaires per category",
      "Ask patients to upload their own photographs",
      "Capture measurements and budget where relevant",
      "Have the answers appear on the patient file",
    ],
    sections: [
      {
        id: "general-intake",
        heading: "The general intake form",
        intro: "Completed by the patient before a first consultation, in sections.",
        bullets: [
          "Patient information — identity and contact details",
          "Insurance information — cover and card details",
          "Health background — history relevant to treatment",
          "Contact preference — how and when they want to be reached",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Send the intake link when the appointment is booked, not the day before. Completion rates are far higher while the patient is still enthusiastic.",
          },
        ],
      },
      {
        id: "treatment-questionnaires",
        heading: "Treatment-specific questionnaires",
        intro:
          "Per-category questionnaires ask what actually matters for that treatment. What is asked depends on the category — body, breast or facial treatments each have their own path.",
        bullets: [
          "Treatment goals and priorities — which area matters most to the patient",
          "Prior procedures and relevant conditions",
          "Body measurements where the assessment needs them",
          "Budget, where it is relevant to planning",
          "Photograph uploads from the patient's own device",
        ],
      },
      {
        id: "where-answers-go",
        heading: "Where the answers end up",
        steps: [
          { title: "The patient submits the questionnaire", body: "" },
          {
            title: "A patient record is created or matched",
            body: "So an intake from someone new does not sit outside the system.",
          },
          {
            title: "The answers appear on the patient file",
            body: "As an intake card the doctor can read before the consultation, with any photographs attached.",
          },
          {
            title: "Automation can react",
            body: "Form submitted is a workflow trigger, so an advisor can be notified and a deal opened automatically.",
          },
        ],
        callouts: [
          {
            kind: "warning",
            body: "If a submission fails, the patient is told rather than left guessing. Ask them to try again and check the record — a duplicate submission is better than a lost one.",
          },
        ],
      },
      {
        id: "pre-consultation",
        heading: "Pre-consultation and consultation steps",
        bullets: [
          "A pre-consultation flow prepares the patient for what the consultation will cover",
          "Consultation steps guide the conversation itself, so different advisors cover the same ground",
          "Both are patient-facing pages, usable on a tablet in the clinic as well as at home",
        ],
      },
    ],
    related: ["forms-and-embeds", "patient-record", "workflows", "medical-records"],
    keywords: [
      "intake",
      "questionnaire",
      "consultation",
      "health background",
      "insurance",
      "photos",
      "measurements",
      "pre-consultation",
    ],
  },

  {
    slug: "forms-and-embeds",
    title: "Forms, embeds & QR codes",
    tagline: "Put the clinic's forms on your website, in print and on the front desk.",
    category: "patient-facing",
    icon: "file",
    appPath: ["Menu", "Lead Import", "Embed Forms"],
    audience: ["admin", "staff"],
    summary:
      "The same forms can be reached three ways: embedded in your own website as an iframe, opened directly by link, or scanned from a printed QR code in the clinic. Whichever route a patient takes, the submission lands in the platform as a lead attached to a patient record.",
    keyCapabilities: [
      "Embed the contact form and the booking form in your website",
      "Auto-resize the embedded form so it never scrolls internally",
      "Share direct links to individual forms",
      "Print permanent QR codes for intake and booking",
      "Download QR codes as SVG for high-quality printing",
      "See every submission as a lead",
    ],
    sections: [
      {
        id: "embedding",
        heading: "Embedding a form in your website",
        steps: [
          { title: "Open Lead Import › Embed Forms", body: "The embed addresses for the contact and booking forms are listed there." },
          { title: "Copy the snippet", body: "It is an iframe plus a short script." },
          {
            title: "Paste it into your page",
            body: "Where the form should appear. The script listens for the form's height and resizes the iframe, so the form never gets its own scrollbar.",
          },
          {
            title: "Choose the language",
            body: "Snippets are available for French and English versions of the forms.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "Embedded pages are restricted to approved website domains. Ask your administrator to add a domain before embedding the form on a new site.",
          },
        ],
      },
      {
        id: "which-form",
        heading: "Which form to use where",
        table: {
          columns: ["Form", "Use it for"],
          rows: [
            ["Contact form", "General enquiries. Produces a lead with the enquiry and the contact details."],
            ["Booking form", "Patients who already know what they want. Produces a booking in the agenda."],
            ["Intake questionnaire", "After an appointment is agreed, to collect history and insurance."],
          ],
        },
      },
      {
        id: "qr-codes",
        heading: "QR codes",
        intro:
          "The QR codes page holds permanent codes for patient intake and appointment booking, designed to be printed.",
        steps: [
          { title: "Open the QR codes page", body: "Each code is shown with its title, description and address." },
          { title: "Print the page", body: "One button prints all the codes, laid out for printing." },
          {
            title: "Or download individual codes as SVG",
            body: "SVG scales without pixellation, so use it for posters, cards and window displays.",
          },
        ],
        bullets: [
          "The codes are permanent and continue to work",
          "Put the intake code on reception cards and appointment letters",
          "Put the booking code in the window and in printed advertising",
        ],
      },
      {
        id: "tracking-submissions",
        heading: "Tracking what comes in",
        bullets: [
          "Embedded form submissions are listed under Lead Import › Embed Forms with totals for contact and booking forms",
          "Converted leads are counted separately, so you can see whether the form is producing patients rather than noise",
          "Filter by location where the clinic operates from more than one site",
          "Form submitted is a workflow trigger, so notification and deal creation can be automatic",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Check the converted count monthly. A form producing many leads and few conversions usually needs fewer fields, not more marketing.",
          },
        ],
      },
    ],
    related: ["online-bookings", "intake-and-consultations", "lead-import", "aliice-assistant"],
    keywords: ["forms", "embed", "iframe", "qr code", "contact form", "booking form", "website", "leads", "print"],
  },

  {
    slug: "mobile-and-tablet",
    title: "Mobile & tablet use",
    tagline: "Working from a phone or tablet, and the app-mode interfaces.",
    category: "patient-facing",
    icon: "mobile",
    appPath: ["Mobile"],
    audience: ["staff", "doctor"],
    summary:
      "The platform is used on phones and tablets as well as desktops. Alongside the responsive main interface there are dedicated app-mode interfaces designed for a phone screen, with their own sign-in, which is what the clinic's mobile app wraps.",
    keyCapabilities: [
      "Use the main platform on a tablet, including drag-to-create booking by touch",
      "Use a phone-optimised app interface",
      "Sign in on mobile without losing the page you were opening",
      "Keep patient tabs while moving around on a small screen",
    ],
    sections: [
      {
        id: "tablet",
        heading: "On a tablet",
        bullets: [
          "The agenda supports touch, so appointments can be created by dragging across the time",
          "The classic sidebar layout is often easier on a tablet in landscape, because the module list stays visible",
          "Photograph upload works from the tablet's own camera roll, including phone image formats",
        ],
      },
      {
        id: "phone-app-modes",
        heading: "The phone interfaces",
        intro:
          "The app-mode interfaces show a compact header and a reduced set of screens, sized for one-handed use. They have their own sign-in pages.",
        bullets: [
          "Designed for the work that genuinely happens away from a desk: checking the day, looking up a patient, following up a call",
          "Sign-in uses the same account as the desktop platform",
          "The patient tab bar and the desktop shell are hidden, so the screen is not wasted on navigation",
        ],
        callouts: [
          {
            kind: "note",
            body: "Sign-in is handled so that it works inside a mobile app's embedded browser as well as in a normal one, which is why you land back on the page you were opening.",
          },
        ],
      },
      {
        id: "good-practice",
        heading: "Good practice on mobile",
        bullets: [
          "Do not document consultations on a phone — clinical notes deserve a keyboard",
          "Use mobile for the agenda, patient lookup, tasks and WhatsApp",
          "Sign out on any device that leaves the clinic and is not yours",
          "Beware of photographing patients on a personal device; upload to the patient file and delete the local copy",
        ],
        callouts: [
          {
            kind: "important",
            body: "A phone with a live session is a patient database in someone's pocket. Require a device passcode, and tell your administrator immediately if a device is lost.",
          },
        ],
      },
    ],
    related: ["navigating-the-app", "agenda", "signing-in", "documents"],
    keywords: ["mobile", "tablet", "phone", "app", "touch", "responsive", "ipad", "on the go"],
  },

  {
    slug: "payment-pages",
    title: "Patient payment pages",
    tagline: "What the patient sees when they follow a payment link.",
    category: "patient-facing",
    icon: "card",
    appPath: ["Payment link"],
    audience: ["patient", "staff"],
    summary:
      "A payment link opens a page showing the invoice and a way to pay it. Each outcome — paid, failed, cancelled — has its own page, and a link that has already been used says so instead of taking a second payment.",
    keyCapabilities: [
      "Show the patient the invoice behind the link",
      "Take card payment without the patient needing an account",
      "Confirm success clearly",
      "Explain failure and cancellation",
      "Refuse to charge an invoice twice",
      "Update the invoice automatically",
    ],
    sections: [
      {
        id: "the-outcomes",
        heading: "The pages a patient can land on",
        table: {
          columns: ["Page", "When it appears", "What the patient should do"],
          rows: [
            ["Payment page", "The link is valid and the invoice is unpaid.", "Pay."],
            ["Payment successful", "The payment went through.", "Nothing — the invoice is settled."],
            ["Payment failed", "The payment was declined.", "Try again, or use another card."],
            ["Payment cancelled", "The patient backed out.", "Follow the link again when ready."],
            ["Already paid", "The invoice has been settled.", "Nothing. Contact the clinic if they believe they paid twice."],
            ["Payment link error", "The link is invalid or no longer usable.", "Ask the clinic for a new link."],
          ],
        },
      },
      {
        id: "supporting-patients",
        heading: "Helping a patient who is stuck",
        steps: [
          {
            title: "Ask which page they are seeing",
            body: "The six pages above are distinguishable, and each points at a different cause.",
          },
          {
            title: "Check the invoice in the platform",
            body: "The status tells you whether the money arrived, whatever the patient saw.",
          },
          {
            title: "Re-synchronise the payment status if a result seems delayed",
            body: "Payment results can be re-checked with the provider from the invoice.",
          },
          { title: "Issue a fresh link if the old one is unusable", body: "" },
        ],
        callouts: [
          {
            kind: "tip",
            body: "Send payment links by WhatsApp as well as email. Patients open them far more often, and get paid-invoice friction out of the way on the day.",
          },
        ],
      },
    ],
    related: ["payments", "invoices", "patient-app", "whatsapp"],
    keywords: ["payment page", "payment link", "card payment", "failed payment", "already paid", "checkout"],
  },
];
