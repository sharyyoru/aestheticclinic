import type { DocModule } from "./types";

export const automationAiModules: DocModule[] = [
  {
    slug: "workflows",
    title: "Workflows",
    tagline: "Make the follow-up happen automatically when something changes.",
    category: "automation-ai",
    icon: "workflow",
    appPath: ["Menu", "Workflows"],
    audience: ["admin", "staff"],
    summary:
      "A workflow is a trigger plus a sequence of actions. Something happens — a deal moves stage, a patient is created, an appointment is completed — and the platform sends the message, creates the task or updates the record without anyone remembering to. The workflows list shows every automation, whether it is active, and what fires it.",
    keyCapabilities: [
      "Trigger automation from seven kinds of event",
      "Send email, WhatsApp, notifications and AI calls",
      "Create and update tasks, deals and patient records",
      "Branch on conditions and wait between steps",
      "Call an external system with a webhook",
      "Activate and deactivate automations without deleting them",
      "Search and filter workflows by trigger",
    ],
    sections: [
      {
        id: "triggers",
        heading: "The triggers",
        intro: "A workflow starts from exactly one of these.",
        table: {
          columns: ["Trigger", "Fires when", "Typical use"],
          rows: [
            [
              "Deal stage changed",
              "A deal moves into a stage — optionally one specific stage.",
              "Send a quote when a deal reaches consultation booked; start aftercare when it reaches post-op.",
            ],
            ["Patient created", "A new patient record appears, however it was created.", "Welcome message and an owner assignment task."],
            ["Appointment created", "An appointment is booked.", "Preparation instructions, or an intake form request."],
            ["Appointment completed", "An appointment is marked done.", "Aftercare instructions and a review request."],
            ["Form submitted", "A patient submits a form.", "Notify the advisor and open a deal."],
            ["Task completed", "A task is closed.", "Trigger the next step in a longer process."],
            ["Manual trigger", "Someone runs it deliberately.", "One-off broadcasts to a selected group."],
          ],
        },
        callouts: [
          {
            kind: "warning",
            title: "Four of these cannot be saved yet",
            body: "The database currently accepts only Deal stage changed, Appointment created, Appointment updated and Manual. Choosing Patient created, Appointment completed, Form submitted or Task completed fails on save. A migration to widen it ships as 20260917_widen_workflow_trigger_type.sql — until it is applied, use a deal-stage or manual trigger instead.",
          },
        ],
      },
      {
        id: "actions",
        heading: "The actions",
        table: {
          columns: ["Action", "What it does"],
          rows: [
            ["Send email", "Sends an email to the patient or to staff, using a template."],
            ["Send WhatsApp", "Sends a WhatsApp template message to the patient."],
            ["Send notification", "Raises an in-app notification for a user."],
            ["Create task", "Opens a task for a user, so follow-up has an owner."],
            ["Update task", "Changes an existing task."],
            ["Create deal", "Opens a deal for the patient."],
            ["Update deal", "Moves the stage or changes properties of a deal."],
            ["Update patient", "Writes back to the patient record."],
            ["Send webhook", "Posts the data to an external address, for integrating another system."],
            ["Add delay", "Waits before the next step."],
            ["AI phone call", "Triggers an outbound call from an AI voice agent."],
          ],
        },
      },
      {
        id: "conditions",
        heading: "Conditions",
        intro:
          "Conditions let one workflow behave differently for different patients, instead of building four near-identical automations.",
        bullets: [
          "Test patient email, phone or source",
          "Test the deal's pipeline, value, stage or service",
          "Test the appointment's type or provider",
          "Compare with equals, does not equal, contains and similar operators",
        ],
        callouts: [
          {
            kind: "tip",
            body: "A condition on deal value is the easiest way to give high-value enquiries a different, more personal follow-up sequence.",
          },
        ],
      },
      {
        id: "managing",
        heading: "Managing your workflows",
        bullets: [
          "The list shows each workflow's trigger, with an icon and colour per trigger type",
          "Filter by trigger type, or search by name",
          "Workflows can be active or inactive — deactivate rather than delete while you test",
          "Deal-stage workflows show which target stage they watch",
          "Manual workflows show the broadcast action they will perform",
        ],
      },
      {
        id: "practical-examples",
        heading: "Automations worth building first",
        steps: [
          {
            title: "New patient welcome",
            body: "Trigger on patient created. Send a welcome email, then create a task for the advisor to call within 24 hours.",
          },
          {
            title: "Consultation aftercare",
            body: "Trigger on appointment completed. Wait a day, then send aftercare instructions by WhatsApp with email as backup.",
          },
          {
            title: "Quote follow-up",
            body: "Trigger on deal stage changed to quote sent. Wait three days, then create a task to call if the deal has not moved.",
          },
          {
            title: "Form to pipeline",
            body: "Trigger on form submitted. Create a deal with the right service and notify the advisor.",
          },
        ],
        callouts: [
          {
            kind: "warning",
            body: "Test every new workflow on a test patient before activating it. Patient-facing automation that misfires reaches real people immediately.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Can a workflow send to a list of patients?",
        answer:
          "Use a manual trigger with a broadcast action for a one-off send to a group; use Marketing campaigns for anything audience-based and recurring.",
      },
      {
        question: "Will a workflow message a patient we have marked as cancelled?",
        answer:
          "Appointment reminders are suppressed for moved and cancelled appointments. Other workflows do exactly what you configure, so add a condition if a state should stop them.",
      },
    ],
    related: ["workflow-builder", "email-templates", "marketing-campaigns", "deals", "ai-agents"],
    keywords: [
      "workflows",
      "automation",
      "triggers",
      "actions",
      "conditions",
      "webhook",
      "follow up",
      "sequences",
    ],
  },

  {
    slug: "workflow-builder",
    title: "Workflow builder",
    tagline: "Draw the automation on a canvas, configure each step, then activate it.",
    category: "automation-ai",
    icon: "workflow",
    appPath: ["Menu", "Workflows", "Builder"],
    audience: ["admin"],
    summary:
      "The builder is a canvas. You place a trigger, then chain actions, conditions and delays after it, and configure each node in a side panel. Message steps pick a template and map variables, so the same automation can address every patient personally.",
    keyCapabilities: [
      "Build automations visually rather than in a form",
      "Add action, condition and delay steps",
      "Configure each step in a side panel",
      "Map message variables to patient fields or fixed text",
      "Branch on conditions",
      "Save as inactive and activate when ready",
    ],
    sections: [
      {
        id: "building",
        heading: "Building a workflow",
        steps: [
          { title: "Start with the trigger", body: "Choose what event starts the automation, and narrow it if the trigger supports it." },
          {
            title: "Add an action",
            body: "Pick from the action list. The step appears on the canvas connected to what precedes it.",
          },
          {
            title: "Configure the step",
            body: "Select the node to open its panel. What you see depends on the action — an email step asks for a template, a task step asks for an owner, a deal step asks which stage.",
          },
          {
            title: "Add a delay where the timing matters",
            body: "Aftercare the same minute a consultation ends reads as automated; the next morning reads as care.",
          },
          {
            title: "Add a condition to branch",
            body: "Test a patient, deal or appointment field and continue differently depending on the answer.",
          },
          { title: "Save", body: "Then activate it from the workflows list once you have tested it." },
        ],
      },
      {
        id: "message-steps",
        heading: "Configuring a message step",
        intro:
          "Email and WhatsApp steps are the ones you will configure most, and they work slightly differently.",
        features: [
          {
            name: "Email",
            description:
              "Choose a template from the email template library, and set the recipient — the patient, or a member of staff.",
          },
          {
            name: "WhatsApp",
            description:
              "Choose a template and map each variable in it. Variables can be filled from a patient field or with fixed text, which is what stops a message reading as a form letter.",
          },
          {
            name: "Notification",
            description: "Choose the user to notify and the message they see in the app.",
          },
          {
            name: "AI phone call",
            description: "Choose the agent and what the call is for; the agent then places the call.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "WhatsApp variable mapping is prefilled with sensible patient fields where it can be. Check them anyway — a mismapped variable produces a message that makes no sense.",
          },
        ],
      },
      {
        id: "webhooks",
        heading: "Webhook steps",
        intro:
          "A webhook step posts the workflow's data to an external address, which is how another system is brought into the process.",
        bullets: [
          "Give the address of the receiving system",
          "Use it to push into accounting, a data warehouse or an automation platform",
          "Deliveries are queued and processed continuously, so a temporarily unavailable receiver does not lose the event",
        ],
      },
      {
        id: "testing",
        heading: "Testing before activation",
        steps: [
          { title: "Save the workflow inactive", body: "It will not fire." },
          { title: "Create a test patient with your own contact details", body: "" },
          { title: "Cause the trigger", body: "Move the test deal, book the test appointment, submit the test form." },
          {
            title: "Check what arrived",
            body: "Look at Email Reports and the communication logs, and read the message as the patient would.",
          },
          { title: "Activate", body: "Only once the output is right." },
        ],
        callouts: [
          {
            kind: "important",
            body: "A delay step is the easiest thing to get wrong. A workflow that looks correct but waits zero time will message patients seconds after an event, which patients notice.",
          },
        ],
      },
    ],
    related: ["workflows", "email-templates", "whatsapp", "ai-agents"],
    keywords: ["workflow builder", "canvas", "nodes", "conditions", "delay", "variables", "templates", "webhook"],
  },

  {
    slug: "email-templates",
    title: "Email templates",
    tagline: "One library of templates shared by manual email, workflows and campaigns.",
    category: "automation-ai",
    icon: "file",
    appPath: ["Menu", "Workflows", "Templates"],
    audience: ["admin", "staff"],
    summary:
      "Templates are written once and used everywhere: by staff sending manually, by workflow email steps and by marketing campaigns. That is what keeps automated correspondence looking like it came from your clinic rather than from software.",
    keyCapabilities: [
      "Create and edit reusable email templates",
      "Build a template from existing branded HTML",
      "Preview a template before it is used",
      "Use the same template in workflows and campaigns",
    ],
    sections: [
      {
        id: "creating",
        heading: "Creating a template",
        steps: [
          { title: "Open Workflows › Templates", body: "" },
          { title: "Create a template and name it clearly", body: "Colleagues will pick it from a list — Aftercare — injectables beats Template 4." },
          { title: "Write the content", body: "Use an editor, or import HTML your clinic already has." },
          { title: "Preview it", body: "Check how it reads before anyone sends it to a patient." },
          { title: "Save", body: "It is immediately available to manual sending, workflows and campaigns." },
        ],
      },
      {
        id: "which-templates",
        heading: "Templates worth having",
        bullets: [
          "Welcome message for a new enquiry",
          "Consultation confirmation with what to bring and where to come",
          "Quote or treatment plan covering letter",
          "Aftercare instructions, one per treatment family",
          "Recall or follow-up invitation",
          "Invoice and payment link covering letter",
          "Document delivery message",
        ],
      },
      {
        id: "good-practice",
        heading: "Good practice",
        bullets: [
          "Keep templates short — long automated mail is not read",
          "Write in the patient's language; keep a version per language you serve",
          "Avoid clinical detail in subject lines",
          "Change the template rather than editing the same wording in five workflows",
        ],
        callouts: [
          {
            kind: "warning",
            body: "Editing a template changes every workflow and campaign that uses it. Check where a template is used before rewriting it.",
          },
        ],
      },
    ],
    related: ["email", "workflows", "marketing-campaigns"],
    keywords: ["email templates", "html email", "library", "branding", "reusable", "campaigns"],
  },

  {
    slug: "marketing-campaigns",
    title: "Marketing campaigns",
    tagline: "Build an audience from your own patient data, preview it, and send.",
    category: "automation-ai",
    icon: "campaign",
    appPath: ["Menu", "Marketing"],
    audience: ["admin", "staff"],
    summary:
      "Campaigns are built in four steps: filter your patients into an audience, save the list if you will use it again, choose a template, and send. Audience filters use the data you already hold — whether the patient has a deal, when they were created, their birthday month, their owner and their lead source.",
    keyCapabilities: [
      "Filter patients into an audience",
      "Save and reload audience lists",
      "Preview exactly who will receive the campaign",
      "Choose from the shared email template library",
      "Send and see delivered and failed counts",
      "Keep a history of every campaign sent",
    ],
    sections: [
      {
        id: "building-an-audience",
        heading: "Building the audience",
        table: {
          columns: ["Filter", "Use it for"],
          rows: [
            ["Has a deal / has no deal", "Reactivating enquiries that never converted, or up-selling patients who did."],
            ["Created on or after / before", "Targeting a cohort — everyone who arrived during a campaign period."],
            ["Birthday month", "Birthday offers, the highest-response campaign most clinics run."],
            ["Contact owner", "Letting an advisor write to their own patients."],
            ["Lead source", "Speaking differently to patients who came from an ad than to referrals."],
          ],
        },
        steps: [
          { title: "Set the filters", body: "They combine, so you can be quite specific." },
          { title: "Preview the recipients", body: "Check the list before sending. It is the last chance to catch a filter mistake." },
          { title: "Save the list if it is reusable", body: "Saved lists can be reloaded for the next campaign." },
        ],
      },
      {
        id: "sending",
        heading: "Choosing a template and sending",
        steps: [
          {
            title: "Pick a template",
            body: "From the shared email template library. If nothing suitable exists, create it in Templates first.",
          },
          { title: "Preview the template", body: "Including the HTML if you need to check something specific." },
          { title: "Send", body: "Campaigns are processed continuously rather than all at once." },
          {
            title: "Read the result",
            body: "You get the campaign status with how many were delivered and how many failed.",
          },
        ],
      },
      {
        id: "history",
        heading: "Campaign history",
        bullets: [
          "Every campaign is kept with its subject, status, recipient count and failure count",
          "Saved audience lists are listed alongside, ready to reuse",
          "Cross-check against Email Reports to investigate individual failures",
        ],
      },
      {
        id: "good-practice",
        heading: "Sending responsibly",
        bullets: [
          "Only write to patients who have a relationship with the clinic; this is not a tool for bought lists",
          "Respect the patient's language preference",
          "Keep clinical claims out of marketing email — Swiss advertising rules for medical treatment are strict",
          "Watch failure counts: a rising rate means your patient data needs cleaning",
        ],
        callouts: [
          {
            kind: "important",
            body: "Patient marketing is regulated. Have your clinic's own compliance sign-off on the wording before a campaign goes to a large audience.",
          },
        ],
      },
    ],
    related: ["email-templates", "email", "lead-analytics", "patients"],
    keywords: ["marketing", "campaigns", "audience", "segments", "birthday", "recall", "bulk email", "lists"],
  },

  {
    slug: "ai-agents",
    title: "AI voice agents",
    tagline: "Let an AI answer or place calls, and make sure a human picks up what it cannot.",
    category: "automation-ai",
    icon: "agent",
    appPath: ["Menu", "AI Agents"],
    audience: ["admin", "staff"],
    summary:
      "AI voice agents take calls the clinic cannot answer and place outbound calls triggered by workflows. The important half of the module is what happens afterwards: dropped and unresolved calls are listed with a status and an assigned owner, and can be distributed around the team automatically.",
    keyCapabilities: [
      "Have an AI agent handle calls, including booking",
      "Trigger outbound AI calls from workflows",
      "See every agent call with its outcome",
      "Track dropped calls through to resolution",
      "Assign follow-up to staff, including round-robin distribution",
      "Read transcripts and captured data",
    ],
    sections: [
      {
        id: "what-agents-do",
        heading: "What the agents do",
        bullets: [
          "Answer calls when the clinic cannot, and take the details rather than losing the enquiry",
          "Book appointments into real availability, using the same free slots as the online booking page",
          "Place outbound calls when a workflow asks for one — for example following up an unconverted enquiry",
          "Capture what the caller wanted, so a human callback starts from context",
        ],
        callouts: [
          {
            kind: "note",
            body: "Calls handled by an agent appear in the communication logs with their transcript and extracted data, and leads produced by them appear under Lead Import › Aliice Calls.",
          },
        ],
      },
      {
        id: "dropped-calls",
        heading: "Dropped calls",
        intro:
          "Calls the agent could not complete are listed with the calling number, the matched patient where known, the reason, who it is assigned to and a status.",
        table: {
          columns: ["Status", "Meaning"],
          rows: [
            ["Pending", "Nobody has dealt with it yet — this is the queue."],
            ["Contacted", "Someone has reached the caller."],
            ["Resolved", "Dealt with; nothing further needed."],
            ["No answer", "Callback attempted, nobody answered."],
            ["Invalid", "Not a real enquiry — wrong number, silent call, spam."],
          ],
        },
        steps: [
          { title: "Filter to pending", body: "" },
          { title: "Open the linked patient if there is one", body: "You then know their history before calling." },
          { title: "Call back and set the status", body: "The queue only works if statuses are kept honest." },
        ],
      },
      {
        id: "assignment",
        heading: "Assigning follow-up",
        intro:
          "Follow-up can be assigned explicitly, or distributed around a rota so no single person absorbs every callback.",
        bullets: [
          "Round-robin distributes calls across the users you nominate",
          "The rota shows how many assignments each user has taken and when they last received one",
          "Unassigned calls are visible as such, so they are not silently ignored",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Round-robin only works if the rota reflects who is actually working. Review it when the team changes.",
          },
        ],
      },
      {
        id: "call-logs",
        heading: "Agent call logs",
        bullets: [
          "Every agent call is logged with its outcome",
          "Open a call to see the detail behind it",
          "Combine with the communication logs to read the full transcript",
          "Where the caller became a patient, the call is attached to their record",
        ],
      },
      {
        id: "good-practice",
        heading: "Using agents well",
        bullets: [
          "Treat the agent as a receptionist that never sleeps, not as a replacement for one",
          "Review transcripts weekly at first — the wording of the agent's instructions is what determines its quality",
          "Make sure dropped calls have an owner; an unattended queue is worse than no agent",
          "Tell callers they are speaking to an assistant, and let them ask for a human",
        ],
        callouts: [
          {
            kind: "important",
            body: "Calls may be recorded and transcribed. Follow the disclosure and consent requirements that apply to your clinic.",
          },
        ],
      },
    ],
    related: ["missed-calls", "communication-logs", "workflows", "lead-import"],
    keywords: ["ai agents", "voice", "retell", "calls", "dropped calls", "round robin", "callback", "booking"],
  },

  {
    slug: "aliice-assistant",
    title: "Aliice assistant & chat widget",
    tagline: "The AI assistant for staff, its knowledge base, and the chat widget for your website.",
    category: "automation-ai",
    icon: "sparkles",
    appPath: ["Menu", "Chat with Aliice"],
    audience: ["staff", "admin"],
    summary:
      "Aliice is the AI assistant. Staff use it in the platform to ask questions and draft text, with conversations that can be linked to a patient. The same assistant can be embedded on your website as a chat widget, where it answers enquiries and captures leads. Its answers are shaped by a knowledge base you maintain.",
    keyCapabilities: [
      "Ask the assistant questions inside the platform",
      "Name and keep conversations for later",
      "Link a conversation to a patient",
      "Maintain a knowledge base of topics and documents",
      "Embed the assistant as a chat widget on your website",
      "Offer the widget in more than one language",
      "Review every conversation in the logs",
    ],
    sections: [
      {
        id: "staff-chat",
        heading: "Using the assistant as staff",
        steps: [
          { title: "Open Chat with Aliice", body: "From the module menu." },
          { title: "Ask a question", body: "Drafting patient correspondence and summarising is what it is most useful for." },
          {
            title: "Link a patient if the conversation is about one",
            body: "The conversation then sits in the right context and can be found again.",
          },
          { title: "Name the conversation", body: "So it can be picked up later rather than started again." },
        ],
        callouts: [
          {
            kind: "important",
            body: "Treat the assistant as a drafting aid. Read anything it produces before it reaches a patient, and never rely on it for clinical decisions.",
          },
        ],
      },
      {
        id: "knowledge-base",
        heading: "The AI knowledge base",
        intro:
          "The knowledge base is how the assistant learns your clinic: your treatments, prices, policies and tone. It is organised as topics, each with its own conversation and attachments.",
        steps: [
          { title: "Create a topic", body: "One per subject — a treatment, a policy, a price list." },
          { title: "Add the content", body: "Write it, and attach the documents that go with it." },
          {
            title: "Keep it current",
            body: "An out-of-date price in the knowledge base becomes an out-of-date price quoted to a patient.",
          },
        ],
      },
      {
        id: "chat-widget",
        heading: "The website chat widget",
        intro:
          "The widget is a bubble in the corner of your site that opens the assistant. It is installed by pasting one snippet into your website.",
        steps: [
          { title: "Open the chat widget page", body: "It contains the ready-made snippets." },
          { title: "Choose the language version", body: "English and French snippets are provided." },
          { title: "Copy the snippet", body: "Use the copy button rather than selecting the text by hand." },
          {
            title: "Paste it into your website",
            body: "Before the closing body tag. The bubble appears bottom right, and opens the chat when clicked.",
          },
        ],
        bullets: [
          "The bubble is rendered natively on your page, so it does not carry an iframe's background problems",
          "Only the chat window itself is framed",
          "Closing the chat returns the bubble, so the widget never gets stuck open",
        ],
      },
      {
        id: "from-chat-to-lead",
        heading: "Turning conversations into patients",
        bullets: [
          "Widget conversations appear in the communication logs with their transcript",
          "Contact details the visitor gives are captured as visitor information",
          "Conversations with no contact details are labelled anonymous — there is nothing to follow up",
          "Filter the logs for conversations not linked to a patient to find enquiries nobody picked up",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Review the widget's transcripts in the first weeks. The questions visitors actually ask tell you what is missing from both your website and your knowledge base.",
          },
        ],
      },
    ],
    related: ["communication-logs", "knowledge-base", "ai-agents", "forms-and-embeds"],
    keywords: [
      "aliice",
      "ai assistant",
      "chat widget",
      "embed chat",
      "knowledge base",
      "chatbot",
      "website chat",
      "leads",
    ],
  },

  {
    slug: "controllers",
    title: "Staff availability controllers",
    tagline: "Per-user working days and hours that shape the calendar views.",
    category: "automation-ai",
    icon: "settings",
    appPath: ["Menu", "Controllers"],
    audience: ["admin"],
    summary:
      "Controllers hold each user's normal working pattern: which days they are available, and the start and end time for each of those days. The agenda uses it to filter calendar views by who is actually working, so a day view is not cluttered with columns for people who are not in.",
    keyCapabilities: [
      "Set availability per user, per weekday",
      "Set start and end time for each working day",
      "See a summary of working days, typical hours and location",
      "Filter calendar views by availability",
    ],
    sections: [
      {
        id: "setting-availability",
        heading: "Setting a user's availability",
        steps: [
          { title: "Open Controllers and select the user", body: "Each user is configured separately." },
          {
            title: "Mark each day available or not",
            body: "Weekends are shown as such, so an unusual Saturday pattern is obvious rather than accidental.",
          },
          { title: "Set the start and end time for available days", body: "" },
          {
            title: "Check the summary",
            body: "Working days, typical hours and location are summarised so mistakes stand out.",
          },
        ],
      },
      {
        id: "how-it-is-used",
        heading: "How it is used",
        bullets: [
          "Calendar views can be filtered by availability, which keeps a busy day readable",
          "It reflects the normal pattern — one-off absences belong in Settings › Doctor Days Off",
          "It is a planning aid, not a booking restriction: patient-facing availability comes from doctor scheduling",
        ],
        callouts: [
          {
            kind: "note",
            body: "Do not confuse the two. Controllers shape what staff see; Doctor Scheduling and Days Off decide what patients can book.",
          },
        ],
      },
    ],
    related: ["doctor-availability", "agenda", "user-management", "settings"],
    keywords: ["controllers", "availability", "working days", "hours", "rota", "calendar filter", "staff"],
  },

  {
    slug: "seo-content-hub",
    title: "SEO & AEO content hub",
    tagline: "Plan keywords and generate articles to bring patients in from search.",
    category: "automation-ai",
    icon: "search",
    appPath: ["Menu", "AEO"],
    audience: ["admin"],
    summary:
      "The content hub is for acquisition through search and AI answer engines. It holds keyword data — volume, competition, difficulty, trends and position — a content plan with priorities and status, and AI-generated articles with their title tags and meta descriptions, in more than one language.",
    keyCapabilities: [
      "Work from keyword data including volume, difficulty and competition",
      "Maintain a content plan with priority and status",
      "Generate articles with title tag and meta description",
      "Keep versions of an article per language",
      "Track word count and generation date",
      "Manage the media used in content",
    ],
    sections: [
      {
        id: "keywords",
        heading: "Keyword data",
        intro: "Each keyword carries the numbers you need to decide whether it is worth writing for.",
        bullets: [
          "Search volume — how many people look for it",
          "Competition and difficulty — how hard the ranking will be",
          "Cost per click — what the paid alternative costs",
          "Trends — whether interest is rising or falling",
          "Current position and traffic share, where you already rank",
        ],
      },
      {
        id: "content-plan",
        heading: "The content plan",
        table: {
          columns: ["Field", "Meaning"],
          rows: [
            ["Priority", "High, medium or low — where this sits against everything else."],
            ["Status", "Planned, writing, review or published."],
            ["Scheduled date", "When it is due."],
            ["Volume and difficulty", "Carried from the keyword data so decisions stay evidence-based."],
          ],
        },
        steps: [
          { title: "Pick keywords worth pursuing", body: "Realistic difficulty and genuine patient intent beat raw volume." },
          { title: "Add them to the plan with a priority and a date", body: "" },
          { title: "Generate a draft", body: "The article comes with a title tag, a meta description and a word count." },
          {
            title: "Edit before publishing",
            body: "Generated text is a starting point. Clinical claims and prices must be checked by a human.",
          },
          { title: "Move the status to published", body: "So the plan reflects reality." },
        ],
      },
      {
        id: "languages",
        heading: "Multiple languages",
        bullets: [
          "An article can hold a version per language, kept together under the same keyword",
          "Useful in Switzerland, where the same treatment is searched for in several languages",
          "Each version keeps its own title tag, meta description and word count",
        ],
        callouts: [
          {
            kind: "important",
            body: "Advertising medical treatment is regulated. Have clinical and compliance review on generated content before it is published.",
          },
        ],
      },
    ],
    related: ["marketing-campaigns", "lead-analytics", "aliice-assistant"],
    keywords: ["seo", "aeo", "keywords", "content", "articles", "search", "meta description", "ranking"],
  },
];
