import type { DocModule } from "./types";

export const salesLeadsModules: DocModule[] = [
  {
    slug: "deals",
    title: "Deals & pipeline",
    tagline: "Track every treatment opportunity from first enquiry to operation.",
    category: "sales-leads",
    icon: "target",
    appPath: ["Menu", "Deals & Pipeline"],
    audience: ["staff", "admin"],
    summary:
      "A deal represents one treatment opportunity for one patient. Deals move through stages your clinic defines — typically from lead to consultation, surgery, post-op and follow-up — and can be worked either as a list or as a board. The screen is built around the question every clinic asks: who has gone quiet and needs contacting?",
    keyCapabilities: [
      "Work deals as a list or as a stage board",
      "Link each deal to a patient and a service with its price",
      "Filter by stage, service, owner and creation date",
      "Find deals that have not been contacted in 3 or 7 days",
      "Sort by staleness to work the coldest first",
      "See the linked appointment for deals that reached scheduling",
      "Get notified when deals move",
    ],
    sections: [
      {
        id: "what-a-deal-is",
        heading: "What a deal holds",
        features: [
          { name: "Patient", description: "The person the opportunity belongs to. Opening the deal gets you to their file." },
          {
            name: "Service",
            description: "The treatment from your catalogue, which supplies the default value of the deal.",
          },
          { name: "Value", description: "The expected revenue in CHF. Editable if the quote differs from the list price." },
          { name: "Stage", description: "Where the opportunity has reached. Stages are configured for your clinic." },
          { name: "Owner", description: "The advisor responsible. Filters and reporting use this." },
          { name: "Pipeline and location", description: "Which pipeline and which clinic site the deal belongs to." },
          { name: "Title and notes", description: "A short label plus free notes for context the next person will need." },
        ],
      },
      {
        id: "stages",
        heading: "Stages",
        intro:
          "Stages are defined per clinic, each with an underlying type so the platform knows what kind of step it is.",
        table: {
          columns: ["Stage type", "Typical meaning"],
          rows: [
            ["Lead", "An enquiry that has not been qualified yet."],
            ["Consultation", "A consultation is being arranged or has happened."],
            ["Surgery", "Treatment or operation agreed and scheduled."],
            ["Post-op", "Treatment delivered, aftercare in progress."],
            ["Follow-up", "Longer-term follow-up, recall or a further treatment."],
            ["Other", "Anything specific to your clinic's process."],
          ],
        },
        bullets: [
          "Stages have a display order, and one is the default for new deals",
          "Deals in appointment-related stages show their linked appointment on the card",
          "Moving a deal between stages can trigger a workflow — for example an automatic follow-up email",
        ],
      },
      {
        id: "list-and-board",
        heading: "List view and board view",
        features: [
          {
            name: "List view",
            description:
              "A dense table. Best for filtering, sorting by staleness and working through a call list.",
          },
          {
            name: "Board view",
            description:
              "A column per stage with deal cards. Best for seeing where the pipeline is congested. Long columns load more on demand rather than all at once.",
          },
        ],
        steps: [
          { title: "Switch view", body: "Use the list and board toggle above the deals." },
          { title: "Filter first", body: "Filters apply to both views, so set them once." },
        ],
      },
      {
        id: "filters-and-staleness",
        heading: "Filters, and finding neglected deals",
        intro:
          "This is the part that drives revenue. The contact filters use the last time the patient was contacted on any channel.",
        table: {
          columns: ["Filter", "What it finds"],
          rows: [
            ["Never contacted", "Deals where no contact has been recorded at all."],
            ["No contact in 3 days", "Deals going cold — the usual daily working list."],
            ["No contact in 7 days", "Deals at real risk of being lost."],
            ["Stage", "One stage only, for example everyone awaiting a consultation."],
            ["Service", "One treatment, useful when a campaign runs on a single procedure."],
            ["Owner", "One advisor's deals."],
            ["Date range", "Deals created between two dates."],
          ],
        },
        steps: [
          { title: "Set the contact filter to 3 days", body: "" },
          { title: "Turn on sort by staleness", body: "The longest-neglected deals rise to the top." },
          {
            title: "Work down the list",
            body: "Open the patient, contact them on their preferred channel, and the deal drops off the list automatically once contact is recorded.",
          },
        ],
        callouts: [
          {
            kind: "tip",
            body: "Make this the first screen each advisor opens. It replaces the spreadsheet everyone otherwise keeps.",
          },
        ],
      },
      {
        id: "creating-and-moving",
        heading: "Creating and moving deals",
        steps: [
          {
            title: "Create a deal against the patient",
            body: "Choose the service — the value is filled in from the catalogue — and set the owner and stage.",
          },
          {
            title: "Move it as reality changes",
            body: "In board view move the card; in list view change the stage on the deal.",
          },
          {
            title: "Let automation do the rest",
            body: "Stage changes are a workflow trigger, so aftercare mail, tasks and notifications can fire without anyone remembering.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "Deals are also created automatically by lead import, so imported campaign leads arrive in the pipeline rather than sitting in a file nobody opens.",
          },
        ],
      },
      {
        id: "notifications",
        heading: "Deal notifications",
        bullets: [
          "The deals icon in the header counts movement on deals you are involved in",
          "A dedicated deal notifications page lists what changed",
          "Combined with stage-change workflows, this is how handover between advisor and clinical team happens without a meeting",
        ],
      },
    ],
    faqs: [
      {
        question: "One patient wants two different treatments. One deal or two?",
        answer:
          "Two. Each deal carries one service and one value, so two deals keep the pipeline value and conversion reporting honest.",
      },
      {
        question: "Why is a deal still on my 3-day list after I emailed the patient?",
        answer:
          "The contact filters use recorded contact. Email, WhatsApp and SMS sent from inside the platform are recorded automatically; a call from your mobile is not. Log it, or call from the platform.",
      },
    ],
    related: ["patients", "services", "lead-import", "workflows", "lead-analytics"],
    keywords: [
      "deals",
      "pipeline",
      "kanban",
      "stages",
      "sales",
      "opportunity",
      "conversion",
      "follow up",
      "staleness",
    ],
  },

  {
    slug: "lead-import",
    title: "Lead capture & import",
    tagline: "Bring leads in from ad platforms, spreadsheets, web forms and AI phone calls.",
    category: "sales-leads",
    icon: "inbox",
    appPath: ["Menu", "Lead Import"],
    audience: ["staff", "admin"],
    summary:
      "Leads arrive from many places, and this module handles all of them: file imports from ad platforms and spreadsheets, live leads from Meta and Zapier, submissions from embedded forms, and calls handled by the AI agent. Every route creates or matches a patient and can open a deal, so nothing sits in a download folder.",
    keyCapabilities: [
      "Import CSV and Excel files, including native TikTok and Meta Ads exports",
      "Recognise column names in six languages",
      "Normalise Swiss phone numbers automatically",
      "Detect the service from the filename or a per-lead form column",
      "Preview and fix problems before anything is created",
      "Track live Meta and Zapier leads with campaign and ad filters",
      "See leads from embedded contact and booking forms",
      "Review leads generated by AI phone calls",
      "Keep a full import history",
      "Re-send WhatsApp messages that failed",
    ],
    sections: [
      {
        id: "file-import",
        heading: "Importing a file",
        steps: [
          { title: "Open Lead Import and choose a file", body: "CSV, Excel .xlsx or .xls, exported from TikTok Ads, Meta Ads, Google Sheets, Excel or Numbers." },
          {
            title: "Check the preview",
            body: "The platform reports the total number of leads, how many are valid, how many need review and how many have phone problems.",
          },
          {
            title: "Check service detection",
            body: "Services are detected from the filename or from a per-lead Form column, and the breakdown per service is shown so you can confirm it guessed right.",
          },
          {
            title: "Fix what needs review",
            body: "Correct problem rows before importing rather than cleaning up patients afterwards.",
          },
          {
            title: "Confirm the import",
            body: "Progress is shown as it runs.",
          },
          {
            title: "Read the result",
            body: "You get counts of new patients, deals created, existing patients matched and rows that failed.",
          },
        ],
      },
      {
        id: "file-format",
        heading: "What the file needs to contain",
        bullets: [
          "Headers in the first row",
          "Required: a name, plus at least one of email or phone",
          "Optional and used when present: Created, Source, Form, Channel, Stage, Labels",
          "Column headings are recognised in English, French, German, Spanish, Russian and Ukrainian",
          "Native ad-platform exports are recognised directly, including ad_name, campaign_name, form_name, created_time and localised field names",
          "Phone numbers are reformatted for Switzerland automatically",
        ],
        callouts: [
          {
            kind: "note",
            body: "Apple Numbers files cannot be read directly — export to CSV or Excel first with File › Export To.",
          },
          {
            kind: "tip",
            body: "Name the file after the treatment when the export has no Form column. Service detection uses the filename, and a deal with the right service is worth far more than an untagged lead.",
          },
        ],
      },
      {
        id: "meta-and-zapier",
        heading: "Meta & Zapier leads",
        intro:
          "Leads sent in live from Meta lead ads or through Zapier arrive continuously and are listed with their campaign context.",
        bullets: [
          "Totals for today, this week and this month, so you can see whether spend is producing enquiries",
          "Filter by campaign, by individual ad, by service and by stage",
          "Each lead keeps the campaign and ad it came from, which is what makes cost-per-consultation calculable",
        ],
      },
      {
        id: "embed-form-leads",
        heading: "Embedded form leads",
        intro:
          "Submissions from the contact form and booking form embedded in your website are listed together, with the embed addresses to copy.",
        bullets: [
          "Totals for all leads, converted leads, contact-form submissions and booking-form submissions",
          "The embed address for each form is shown ready to copy into your site",
          "Filter by location when the clinic runs more than one site",
        ],
      },
      {
        id: "ai-call-leads",
        heading: "Leads from AI calls",
        intro:
          "Calls handled by the AI voice agent produce leads too. The Aliice Calls page lists them with the outcome of the call.",
        bullets: [
          "See which calls produced a booking and which need a human to call back",
          "Recordings and transcripts are attached to the patient where available",
          "Follow-up tasks can be created automatically by a workflow",
        ],
      },
      {
        id: "history-and-resend",
        heading: "Import history and WhatsApp re-sending",
        features: [
          {
            name: "Import history",
            description:
              "Every import is kept with what it created, so a bad file can be identified after the fact rather than guessed at.",
          },
          {
            name: "Resend WhatsApp",
            description:
              "Where a welcome or follow-up WhatsApp message failed — usually a bad number — it can be re-sent after the number is corrected.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Will importing the same file twice create duplicates?",
        answer:
          "Existing patients are matched and reported separately from new ones, so re-importing is not catastrophic. Even so, check the import history before repeating an import, and use the merge tool on the patients list if duplicates do appear.",
      },
      {
        question: "The import says 'needs review'. What is wrong?",
        answer:
          "Usually a missing name, no email and no phone, or a phone number that cannot be interpreted as a Swiss or international number. The preview lists the affected rows before anything is created.",
      },
    ],
    related: ["deals", "patients", "lead-analytics", "forms-and-embeds", "ai-agents"],
    keywords: [
      "lead import",
      "csv",
      "excel",
      "meta ads",
      "tiktok",
      "zapier",
      "leads",
      "campaign",
      "embed form",
      "import history",
    ],
  },

  {
    slug: "lead-analytics",
    title: "Lead analytics",
    tagline: "Where your enquiries come from, and which ones turn into treatment.",
    category: "sales-leads",
    icon: "pie",
    appPath: ["Menu", "Lead Analytics"],
    audience: ["staff", "admin"],
    summary:
      "Lead analytics breaks enquiries down by channel, by service and by the campaign or form that produced them, over a period you choose. It answers the two questions that decide marketing budget: which channel produces enquiries, and which produces the enquiries that actually convert.",
    keyCapabilities: [
      "See leads by channel for a chosen period",
      "Drill into a channel to see the individual leads",
      "See leads by service",
      "See submissions per campaign or form name",
      "Compare periods to judge whether spend is working",
    ],
    sections: [
      {
        id: "by-channel",
        heading: "Leads by channel",
        steps: [
          { title: "Choose the period", body: "The whole page is scoped to it." },
          { title: "Read the channel breakdown", body: "Each channel shows how many leads it produced." },
          {
            title: "Select a channel",
            body: "You get the individual leads behind the number, with name, email, phone and source, so a suspicious total can be verified rather than trusted.",
          },
        ],
      },
      {
        id: "by-service-and-campaign",
        heading: "By service and by campaign",
        features: [
          {
            name: "Leads by service",
            description:
              "Which treatments people are enquiring about. Use it to decide what to promote and what to staff for.",
          },
          {
            name: "Campaign and form breakdown",
            description:
              "Submissions per campaign or form name, which is how a specific ad or landing page is judged.",
          },
        ],
      },
      {
        id: "using-it",
        heading: "Making decisions with it",
        bullets: [
          "Compare lead volume against consultations booked in the same period, from the Statistics reports",
          "A channel with many leads and few consultations is a targeting problem, not a volume problem",
          "A service with many enquiries and little revenue usually means the price or the consultation script needs work",
          "Check the deals pipeline for the same period — leads that never became deals were never worked",
        ],
        callouts: [
          {
            kind: "note",
            body: "Attribution is only as good as the data coming in. Keep the Source, Form and Channel columns populated in imports, and keep campaign names consistent between platforms.",
          },
        ],
      },
    ],
    related: ["lead-import", "deals", "statistics", "marketing-campaigns"],
    keywords: [
      "lead analytics",
      "attribution",
      "channel",
      "campaign",
      "conversion",
      "marketing",
      "source",
      "reporting",
    ],
  },

  {
    slug: "missed-calls",
    title: "Missed calls",
    tagline: "Every call the clinic did not answer, with a status until it is dealt with.",
    category: "sales-leads",
    icon: "missedCall",
    appPath: ["Menu", "Missed Calls"],
    audience: ["staff", "admin"],
    summary:
      "Missed calls are the most expensive thing a clinic loses, because the caller has already decided to act. This page lists calls that were not answered or were dropped, matched to a patient where possible, with a contact status so a call is only removed from the list once someone has dealt with it.",
    keyCapabilities: [
      "See missed and dropped calls with the number that called",
      "See which patient the number belongs to, when it is known",
      "See the reason the call ended",
      "Set a contact status per call and record when it was resolved",
      "Filter by status to work a queue",
      "See who the call is assigned to and any linked task",
    ],
    sections: [
      {
        id: "what-is-listed",
        heading: "What appears here",
        bullets: [
          "The calling number and the direction of the call",
          "Why the call ended, so a dropped call is distinguishable from an unanswered one",
          "The matched patient with name and email, where the number is recognised",
          "Who the call is assigned to, and a task if one was created",
          "When the call came in",
        ],
        callouts: [
          {
            kind: "note",
            body: "Calls handled by the AI voice agent are included, so a call the agent could not complete still reaches a human.",
          },
        ],
      },
      {
        id: "working-the-list",
        heading: "Working the list",
        steps: [
          { title: "Filter to pending", body: "That is your queue." },
          {
            title: "Open the patient if the number is matched",
            body: "You then have their history before you call back — the difference between a cold callback and a useful one.",
          },
          {
            title: "Call back",
            body: "For unmatched numbers, treat it as a new enquiry: create the patient, and create a deal if there is interest.",
          },
          {
            title: "Set the status",
            body: "Marking a call as anything other than pending stamps it with the time it was resolved and takes it out of the queue.",
          },
        ],
      },
      {
        id: "why-it-matters",
        heading: "Using it as a discipline",
        bullets: [
          "Clear the list at fixed times — mid-morning and late afternoon work well",
          "A number that appears repeatedly is a patient trying to reach you: prioritise it",
          "Missed calls clustering at particular hours is a staffing signal, not a bad-luck signal",
          "Where callbacks cannot be done quickly, let an AI agent call back and book",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Create a workflow that opens a task for every missed call. Statuses get forgotten; tasks with owners do not.",
          },
        ],
      },
    ],
    related: ["ai-agents", "communication-logs", "deals", "workflows"],
    keywords: ["missed calls", "callback", "phone", "dropped call", "call log", "follow up", "enquiries"],
  },

  {
    slug: "services",
    title: "Services & pricing",
    tagline: "The treatment catalogue that prices deals, invoices and booking.",
    category: "sales-leads",
    icon: "tags",
    appPath: ["Menu", "Services"],
    audience: ["admin", "staff"],
    summary:
      "The service catalogue is the single price list behind the rest of the platform. Services are grouped into categories, each with a code, a description and a base price in CHF, and can be deactivated when they are withdrawn without erasing the history of what was sold at that price.",
    keyCapabilities: [
      "Group treatments into categories",
      "Set a base price in CHF per service",
      "Give each service a code for billing and reporting",
      "Deactivate withdrawn services instead of deleting them",
      "Search and filter a long catalogue",
      "Feed prices into deals, invoices and reporting automatically",
    ],
    sections: [
      {
        id: "structure",
        heading: "Categories and services",
        intro: "Two levels only, deliberately: a category, and the services inside it.",
        features: [
          {
            name: "Category",
            description: "A grouping such as injectables, surgery, dermatology or laser. Created before the services that belong to it.",
          },
          { name: "Name", description: "What staff will search for. Use the term your team actually says out loud." },
          { name: "Code", description: "A short identifier used for billing and in reports." },
          { name: "Description", description: "Detail for whoever quotes the treatment." },
          { name: "Base price", description: "The standard price in CHF. It becomes the default value of a deal and the default line price on an invoice." },
          { name: "Active", description: "Inactive services stop being offered but stay attached to past deals and invoices." },
        ],
      },
      {
        id: "adding",
        heading: "Adding a service",
        steps: [
          { title: "Create the category first if it does not exist", body: "A service must belong to one." },
          { title: "Select the category", body: "" },
          { title: "Enter the name, code and description", body: "" },
          {
            title: "Enter the base price in CHF",
            body: "It must be a valid amount — the form rejects anything it cannot read as a price.",
          },
          { title: "Save", body: "The service is immediately available to deals, invoices and reporting." },
        ],
      },
      {
        id: "changing-prices",
        heading: "Changing prices, and withdrawing services",
        bullets: [
          "Editing a base price changes what new deals and invoices default to; it does not rewrite existing ones",
          "Deactivate rather than delete, so historical invoices and the services reports stay intact",
          "Use the category filter and search to find a service quickly in a long catalogue",
        ],
        callouts: [
          {
            kind: "warning",
            body: "Deleting a service that has been sold breaks the link from past deals and invoices. Deactivate it instead.",
          },
        ],
      },
      {
        id: "where-it-is-used",
        heading: "Where the catalogue is used",
        bullets: [
          "Deals take their value from the service, so pipeline value is real rather than typed",
          "Invoice lines are priced from it",
          "The Invoiced services and Paid services reports in Statistics group by it",
          "Lead import maps detected services onto it, which is how campaign leads arrive correctly tagged",
        ],
      },
    ],
    related: ["deals", "invoices", "statistics", "lead-import"],
    keywords: ["services", "catalogue", "price list", "pricing", "chf", "categories", "treatments", "codes"],
  },
];
