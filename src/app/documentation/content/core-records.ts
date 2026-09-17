import type { DocModule } from "./types";

export const coreRecordsModules: DocModule[] = [
  {
    slug: "patients",
    title: "Patients list",
    tagline: "Find, filter, create and merge the contacts your clinic works with.",
    category: "core-records",
    icon: "users",
    appPath: ["Menu", "Patients"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "The patients list — labelled Contacts in the interface — is the entry point to every patient file. It is built for finding one person fast among thousands, with a category-aware search box, filters for ownership and status, and a merge tool for the duplicates that inevitably arrive from online forms and imports.",
    keyCapabilities: [
      "Search by all fields, name, email, phone or date of birth",
      "Filter by contact owner, creation date and deal status",
      "See when each patient was last contacted, and on which channel",
      "Switch the list between a CRM and a medical priority view",
      "Create patients one at a time or in bulk",
      "Merge duplicate records without losing history",
    ],
    sections: [
      {
        id: "searching",
        heading: "Searching for a patient",
        intro:
          "The search box has a category selector next to it. Choosing a category narrows what is searched, which matters when a name also appears inside an email address.",
        table: {
          columns: ["Category", "Use it for"],
          rows: [
            ["All fields", "The default. Searches name, email, phone and date of birth at once."],
            ["Name", "First or last name. Tolerant of small spelling differences."],
            ["Email", "A full or partial email address."],
            ["Phone", "A full or partial number, useful when a call comes in."],
            ["Birthday", "A year or a full date, for example 1990 or 15/03/1990 — the usual way to confirm identity on the phone."],
          ],
        },
        steps: [
          { title: "Pick the category", body: "Select the icon or label beside the search box and choose the field you want to search." },
          { title: "Start typing", body: "Results refresh as you type; there is a short pause built in so the list is not rebuilt on every keystroke." },
          { title: "Open the record", body: "Select the row to open the patient file. It is added to your patient tabs so you can come back to it." },
        ],
        callouts: [
          {
            kind: "tip",
            body: "Name search is fuzzy, so Mueller will still find Müller. If you are sure of the spelling and get too many results, switch to a narrower category.",
          },
        ],
      },
      {
        id: "filters",
        heading: "Filters",
        intro: "Filters combine with search, so you can look for a name only among your own recent contacts.",
        features: [
          {
            name: "Contact owner",
            description: "Show everything, or only the patients you own. Useful for advisors working their own list.",
          },
          {
            name: "Created",
            description: "Today, the last 7 days, the last 30 days, or all time — the quickest way to review new arrivals.",
          },
          {
            name: "Status",
            description:
              "New patient, has a deal, or has no deal. Use has no deal to find enquiries nobody has converted yet.",
          },
          {
            name: "Priority view",
            description:
              "Switches the columns between a CRM emphasis (ownership, lifecycle, last contact) and a medical emphasis, so reception and clinical staff each see what they need.",
          },
        ],
      },
      {
        id: "last-contact",
        heading: "The last contact column",
        intro:
          "Each row shows when the patient was last contacted and through which channel — email, WhatsApp, SMS or a call — as a relative time such as 3d ago.",
        bullets: [
          "Spot patients who have gone quiet without opening every file",
          "Avoid two colleagues contacting the same person on the same day",
          "Combine with the has no deal filter to build a follow-up list",
        ],
      },
      {
        id: "creating-patients",
        heading: "Creating patients",
        steps: [
          {
            title: "For a single patient, use Add patient",
            body: "Enter name, email, phone and date of birth. Only enough to identify the person is required — the rest of the file can be completed during the consultation.",
          },
          {
            title: "For a batch, paste the list",
            body: "The Add patient screen accepts several people at once and shows what will be created, with email, phone and creation date, before you commit.",
          },
          {
            title: "For a marketing list or an export from another system, use Lead import",
            body: "CSV import maps columns, reports what it did and keeps a history you can review later.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "Patients created by online booking, embedded forms, intake questionnaires or the patient app appear here automatically — you do not create those by hand.",
          },
        ],
      },
      {
        id: "merging-duplicates",
        heading: "Merging duplicates",
        intro:
          "The same person books online, fills in a form and later calls the clinic, and you end up with two or three records. Merging consolidates them.",
        steps: [
          { title: "Find the duplicates", body: "Search by surname or by phone number so all variants of the person appear together." },
          { title: "Select the records", body: "Tick the rows that are the same person." },
          { title: "Open the merge dialog", body: "Choose the merge action and review which record will be kept as the primary one." },
          { title: "Confirm", body: "History from the other records is brought across so appointments, invoices and notes are not orphaned." },
        ],
        callouts: [
          {
            kind: "warning",
            body: "Check the dates of birth before merging. Family members often share a surname, an address and even a phone number.",
          },
        ],
      },
      {
        id: "list-behaviour",
        heading: "How the list is loaded",
        bullets: [
          "The list is paginated in blocks of 50 so it stays fast on large databases",
          "Filters and search are applied on the server, so paging through results keeps them applied",
          "The total number of matching patients is shown alongside the current page",
        ],
      },
    ],
    faqs: [
      {
        question: "A patient called and I only have their number. How do I find them?",
        answer:
          "Switch the search category to Phone and type any part of the number. If nothing is found, the call may be from someone not yet in the system — check Missed calls, which records inbound numbers.",
      },
      {
        question: "Why can I not see a patient a colleague just created?",
        answer:
          "Check your filters. The contact owner filter set to your own name, or a Created filter of Today, hides records that do not match.",
      },
    ],
    related: ["patient-record", "lead-import", "deals", "missed-calls"],
    keywords: ["patients", "contacts", "search", "duplicates", "merge", "filters", "patient list", "crm"],
  },

  {
    slug: "patient-record",
    title: "The patient file",
    tagline: "The cockpit, consultations, notes, invoices, appointments and everything else on one patient.",
    category: "core-records",
    icon: "user",
    appPath: ["Menu", "Patients", "any patient"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "The patient file is where most work happens. It has two modes — CRM for the commercial relationship and Medical for clinical work — and a set of tabs behind each one, so reception and doctors can share a record without wading through each other's screens.",
    keyCapabilities: [
      "Switch between CRM and Medical mode on the same record",
      "See a cockpit summary of the patient at a glance",
      "Record consultations, clinical notes and medication",
      "Review invoices with totals by status, filtered by payment method",
      "Store documents, photos and 3D scans",
      "Read intake answers and submitted forms",
      "Track appointments, calls and activity history",
      "See when a colleague is editing the same file",
    ],
    sections: [
      {
        id: "two-modes",
        heading: "CRM mode and Medical mode",
        intro:
          "The toggle at the top of the file switches which set of tabs you see. Your choice is kept in the page address, so a link you share opens on the same view.",
        features: [
          {
            name: "CRM mode",
            description:
              "The commercial view: contact details, ownership, lifecycle stage, communication preferences, deals and activity.",
          },
          {
            name: "Medical mode",
            description:
              "The clinical view: cockpit, consultations and notes, medication and prescriptions, medical records, photos, 3D, documents, appointments and forms.",
          },
        ],
      },
      {
        id: "cockpit",
        heading: "The cockpit",
        intro:
          "The default landing view in Medical mode. It gathers what a clinician wants before walking into the room: identity and age, insurance, recent consultations, current medication and outstanding items.",
        bullets: [
          "Age is shown as a badge next to the name, calculated from the date of birth",
          "Insurance entries list the provider, the card number and the type of cover",
          "Language and clinic preferences are visible, so you write to the patient in the right language",
        ],
      },
      {
        id: "tabs",
        heading: "The tabs",
        table: {
          columns: ["Tab", "What it holds"],
          rows: [
            ["Cockpit", "The summary view described above."],
            ["Consultations / Notes", "Consultation entries and free clinical notes, in date order."],
            ["Medication", "Current and past medication, prescriptions and the eMediplan medication plan."],
            ["Medical records", "Structured medical record entries and notes kept separately from consultations."],
            ["Invoices", "Every invoice for this patient with totals per status, filterable by payment method."],
            ["Photos", "Clinical photography, including before-and-after comparisons."],
            ["3D", "Crisalix 3D scans and simulations for this patient."],
            ["Documents", "Uploaded files organised in folders."],
            ["Appointments", "Past and upcoming appointments for the patient."],
            ["Forms", "Forms the patient submitted, including photos attached to them."],
            ["Patient information", "The full identity, address, employment and source data."],
            ["CRM", "Ownership, lifecycle stage, communication preferences and deals."],
          ],
        },
      },
      {
        id: "editing-details",
        heading: "Editing patient details",
        steps: [
          { title: "Select Edit details", body: "Available from the patient header." },
          {
            title: "Update the fields you need",
            body: "Identity, contact details, address, nationality, profession and employer, plus language and clinic preference and the source the patient came from.",
          },
          { title: "Save", body: "The change is recorded in the activity history, with your name against it." },
        ],
        callouts: [
          {
            kind: "warning",
            body: "If a colleague has the same file open, an editing indicator appears. Coordinate before saving, or the later save wins.",
          },
        ],
      },
      {
        id: "invoices-on-the-file",
        heading: "Invoices seen from the patient file",
        intro:
          "The invoice tab is a financial summary of this one patient, not just a list. Totals are computed per status so you can see instantly whether anything is outstanding.",
        bullets: [
          "Totals for billed, paid, unpaid, overpaid, partially paid, cancelled and complimentary amounts",
          "Selecting a status filters the list to it; selecting it again clears the filter",
          "A payment method filter narrows the view to card, cash, bank transfer and so on",
          "Instalment sub-invoices are excluded from the totals so amounts are not counted twice",
        ],
      },
      {
        id: "activity-and-notes",
        heading: "Activity, notes and mentions",
        features: [
          {
            name: "Activity history",
            description:
              "A chronological record of what happened on this patient: changes, communication, appointments and deals.",
          },
          {
            name: "Notes",
            description: "Free-text notes for the team, with @mentions to pull a colleague in.",
          },
          {
            name: "Call log",
            description: "Inbound and outbound calls associated with the patient, including AI agent calls.",
          },
          {
            name: "Intake answers",
            description:
              "Anything the patient submitted through an intake or pre-consultation questionnaire, presented as a card so the doctor can read it before the consultation.",
          },
        ],
      },
      {
        id: "sharing",
        heading: "Sending things to the patient",
        intro: "Several tabs can send their content straight out without leaving the file.",
        bullets: [
          "Email a document or a set of photos to the patient from the file",
          "Send the medication plan as an eMediplan attachment",
          "Start an AI agent call to the patient from the header",
        ],
        callouts: [
          {
            kind: "important",
            body: "Everything you send from here is medical correspondence. Check the recipient address on the record before sending, especially on records created from imported lists.",
          },
        ],
      },
    ],
    related: ["patients", "documents", "medical-records", "3d-imaging", "invoices"],
    keywords: [
      "patient file",
      "patient record",
      "cockpit",
      "consultation",
      "clinical notes",
      "medical mode",
      "crm mode",
      "tabs",
    ],
  },

  {
    slug: "documents",
    title: "Documents & photos",
    tagline: "Upload, organise, edit and share patient files, including before-and-after images.",
    category: "core-records",
    icon: "documents",
    appPath: ["Patient file", "Documents"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "Every patient file has document storage with folders, an upload dialog that reports progress per file, in-app editing of Word documents and PDFs, and a photo editor for before-and-after comparisons. Documents can be emailed to the patient or attached to an invoice or insurance submission.",
    keyCapabilities: [
      "Upload one or many files with progress and error reporting",
      "Organise documents into folders per patient",
      "Preview documents without downloading them",
      "Edit Word documents in the browser",
      "Build before-and-after image comparisons",
      "Email documents and photos to the patient",
    ],
    sections: [
      {
        id: "uploading",
        heading: "Uploading documents",
        steps: [
          { title: "Open the Documents tab", body: "In the patient file, in Medical mode." },
          { title: "Choose Upload", body: "Select one or several files. Large batches are handled one after another." },
          {
            title: "Watch the progress",
            body: "The dialog shows which file is uploading, overall progress and whether each file succeeded or failed.",
            note: "If a file fails, the error is shown against it so you can retry just that one.",
          },
          { title: "File it in a folder", body: "Navigate into a folder before uploading, or move the document afterwards." },
        ],
      },
      {
        id: "folders",
        heading: "Folders",
        intro:
          "Documents are stored per patient and can be nested in folders, which keeps consent forms, correspondence, lab results and photography apart.",
        bullets: [
          "Folders are listed before files and sorted alphabetically",
          "Navigate into a folder to see its contents, and back out again with the path shown at the top",
          "Older documents stored before folders were introduced remain accessible in the file",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Agree one folder convention across the clinic — for example Consent, Correspondence, Lab, Photos — before uploading in volume. Renaming later is far more work.",
          },
        ],
      },
      {
        id: "previewing-editing",
        heading: "Previewing and editing",
        features: [
          {
            name: "Preview",
            description:
              "Documents open in a preview inside the platform, so you can read a consent form during a consultation without downloading it.",
          },
          {
            name: "Word editing",
            description:
              "Word documents can be edited in the browser with a rich text editor, then saved back to the patient file.",
          },
          {
            name: "PDF output",
            description:
              "Documents and generated paperwork can be produced as PDF for printing or sending.",
          },
          {
            name: "Image handling",
            description:
              "Clinical photography, including images from phones and tablets in HEIC format, is converted so it can be viewed on any device.",
          },
        ],
      },
      {
        id: "before-after",
        heading: "Before-and-after comparisons",
        intro:
          "The photo editor builds a side-by-side comparison from two images on the patient file — the single most requested artefact in aesthetic practice.",
        steps: [
          { title: "Open the photo editor", body: "From the patient's photos, choose the before-and-after editor." },
          { title: "Pick the two images", body: "Select the earlier and the later photograph." },
          {
            title: "Align them",
            body: "Zoom and reposition each image so the framing matches. Consistent framing is what makes a comparison credible.",
          },
          { title: "Save or send", body: "Keep the result on the patient file, or email it to the patient." },
        ],
        callouts: [
          {
            kind: "important",
            body: "Patient photographs are sensitive personal data. Obtain written consent before using any comparison outside the clinical record — marketing use in particular.",
          },
        ],
      },
      {
        id: "sending-documents",
        heading: "Sending documents to patients",
        steps: [
          { title: "Select the document or photo", body: "From the patient file." },
          { title: "Choose the email option", body: "A share dialog opens with the patient's address prefilled." },
          {
            title: "Review and send",
            body: "The message goes out from the clinic with your signature, and is recorded against the patient so the team can see it was sent.",
          },
        ],
      },
    ],
    related: ["patient-record", "3d-imaging", "email", "forms-and-embeds"],
    keywords: [
      "documents",
      "files",
      "upload",
      "folders",
      "photos",
      "before after",
      "word",
      "docx",
      "pdf",
      "consent",
    ],
  },

  {
    slug: "medical-records",
    title: "Consultations, notes & medication",
    tagline: "Clinical documentation, prescriptions and the eMediplan medication plan.",
    category: "core-records",
    icon: "stethoscope",
    appPath: ["Patient file", "Medical"],
    audience: ["doctor", "staff"],
    summary:
      "Clinical documentation lives in three places on the patient file: consultations for what happened in the room, medical records for structured clinical entries, and medication for what the patient takes — including prescriptions and a shareable eMediplan medication plan.",
    keyCapabilities: [
      "Record consultations against a patient and a date",
      "Keep structured medical record entries with notes",
      "Add medication with a per-time-of-day dosing schedule",
      "Save an entry as a prescription",
      "Publish medication to an eMediplan plan and email it to the patient",
      "Look up medicines rather than typing names by hand",
    ],
    sections: [
      {
        id: "consultations",
        heading: "Recording a consultation",
        steps: [
          { title: "Open the patient in Medical mode", body: "Then go to the consultations view." },
          {
            title: "Create a consultation entry",
            body: "Record what was discussed, what was examined and what was agreed. Entries are listed newest first.",
          },
          {
            title: "Attach evidence",
            body: "Link the photographs, documents or 3D simulations taken during the visit so the entry stands on its own later.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "Consultations are also what the reporting counts — the first consultations and consultations per patient reports in Statistics are built from these entries.",
          },
        ],
      },
      {
        id: "medical-records-tab",
        heading: "Medical records and notes",
        intro:
          "The medical records tab is for clinical content that is not tied to a single visit: history, findings, standing observations.",
        bullets: [
          "Notes are edited in place, with an unsaved-changes indicator so nothing is lost by navigating away",
          "Entries are kept separate from CRM notes, so commercial comments never mix with clinical documentation",
        ],
      },
      {
        id: "medication",
        heading: "Adding medication",
        steps: [
          {
            title: "Open the medication card",
            body: "In the patient file, in Medical mode.",
          },
          {
            title: "Choose New medication",
            body: "Search for the medicine rather than typing it, so the correct product and packaging are recorded.",
          },
          {
            title: "Set the dosing",
            body: "Enter the amount for Morning, Noon, Evening and Night, plus the quantity and the date intake starts.",
          },
          {
            title: "Assign the prescribing doctor",
            body: "Select the doctor responsible for the medication.",
          },
          {
            title: "Decide how it is used",
            body: "Save it as a prescription, and choose whether it appears in the patient's eMediplan.",
          },
        ],
      },
      {
        id: "emediplan",
        heading: "The eMediplan medication plan",
        intro:
          "eMediplan is the Swiss standard medication plan. Anything flagged to appear in it is collected into a single plan for the patient.",
        steps: [
          { title: "Flag the medication", body: "Tick Show in eMediplan on each entry that belongs on the plan." },
          { title: "Generate the plan", body: "The platform assembles the current medication into an eMediplan document." },
          {
            title: "Send it",
            body: "Email the plan to the patient as an attachment, or print it for the consultation.",
          },
        ],
      },
      {
        id: "editing-stopping",
        heading: "Changing or stopping medication",
        bullets: [
          "Edit an entry to change dosing per time of day or the quantity",
          "Entries that are no longer current stay on the record rather than disappearing, so the history remains readable",
          "The prescription list and the medicine list are shown separately, so you can see what was formally prescribed",
        ],
        callouts: [
          {
            kind: "important",
            body: "The platform documents medication; it does not check interactions or contraindications. Clinical judgement and the usual verification remain with the prescribing doctor.",
          },
        ],
      },
    ],
    related: ["patient-record", "documents", "statistics", "3d-imaging"],
    keywords: [
      "consultation",
      "clinical notes",
      "medical records",
      "medication",
      "prescription",
      "emediplan",
      "dosage",
      "compendium",
    ],
  },

  {
    slug: "3d-imaging",
    title: "3D imaging (Crisalix)",
    tagline: "Turn patient photographs into 3D face and body simulations.",
    category: "core-records",
    icon: "scan",
    appPath: ["Patient file", "3D"],
    audience: ["doctor", "staff"],
    summary:
      "The platform integrates with Crisalix so a patient's photographs can be turned into a 3D model and simulation, viewed inside the patient file. It is used in consultation to show a realistic expectation of a result before anything is agreed.",
    keyCapabilities: [
      "Create face or body 3D scans per patient",
      "Use photos already on the patient file or upload new ones",
      "View simulations in a player inside the patient record",
      "Keep scans attached to the patient's clinical history",
    ],
    sections: [
      {
        id: "prerequisites",
        heading: "Before you start",
        bullets: [
          "Your clinic needs an active Crisalix account, connected by an administrator",
          "Photographs must meet Crisalix's requirements for angle, lighting and framing, or the model will not build",
          "Patient consent for photography should already be on file",
        ],
        callouts: [
          {
            kind: "note",
            body: "3D imaging is part of the top plan tier. If the 3D tab is not available in your clinic, it has not been enabled.",
          },
        ],
      },
      {
        id: "creating-a-scan",
        heading: "Creating a scan",
        steps: [
          { title: "Open the patient's 3D tab", body: "Then start a new setup." },
          {
            title: "Choose Face or Body",
            body: "The two paths ask for different views, so pick before you attach images.",
          },
          {
            title: "Provide the images",
            body: "For each required view, either upload a new file or select an image already stored on the patient's Documents tab.",
            note: "If nothing appears when selecting from documents, upload the photographs to the Documents tab first.",
          },
          {
            title: "Submit for processing",
            body: "The images are sent to Crisalix, which builds the model. This is not instant — come back to it.",
          },
          {
            title: "Open the result",
            body: "Completed models open in a 3D player inside the patient file, ready to show the patient on screen.",
          },
        ],
      },
      {
        id: "using-in-consultation",
        heading: "Using it in the consultation",
        bullets: [
          "Show the simulation on screen next to the patient's own photographs",
          "Keep the scan on the record so a later comparison has a documented starting point",
          "Reference the simulation in the consultation entry, so it is clear what was discussed",
        ],
        callouts: [
          {
            kind: "important",
            body: "A simulation is an expectation-setting tool, not a promise of outcome. Say so explicitly during the consultation and record that you did.",
          },
        ],
      },
      {
        id: "troubleshooting",
        heading: "When a scan does not work",
        table: {
          columns: ["Problem", "Likely cause"],
          rows: [
            ["No images available to select", "The photographs are not on the patient's Documents tab yet."],
            ["The model fails to build", "The views do not meet the required angles, or one required view is missing."],
            ["The 3D tab is missing", "3D imaging is not enabled for your clinic."],
            ["The player does not open", "The Crisalix connection needs to be re-authorised by an administrator."],
          ],
        },
      },
    ],
    related: ["patient-record", "documents", "integrations", "medical-records"],
    keywords: ["3d", "crisalix", "simulation", "imaging", "face", "body", "scan", "consultation"],
  },
];
