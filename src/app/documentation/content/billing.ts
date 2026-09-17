import type { DocModule } from "./types";

export const billingModules: DocModule[] = [
  {
    slug: "invoices",
    title: "Invoices",
    tagline: "Issue, track and chase invoices for self-pay and insured treatment.",
    category: "billing",
    icon: "receipt",
    appPath: ["Menu", "Invoices"],
    audience: ["staff", "admin"],
    summary:
      "Every invoice carries the patient, the treating doctor, the billing provider, the payment method, the amounts and a status. The list is built for chasing money: filter by status, by payment method, by Swiss billing type, or by where an insurance submission has got to, then act on what comes back.",
    keyCapabilities: [
      "Create invoices from the treatment delivered",
      "Track paid, partially paid, unpaid, overpaid and cancelled amounts",
      "Mark invoices as complimentary without distorting revenue",
      "Distinguish Tiers Garant from Tiers Payant billing",
      "Follow the insurance submission status per invoice",
      "Handle instalments as sub-invoices of a parent",
      "Send a payment link or a Swiss QR bill",
      "Archive invoices out of the working list",
    ],
    sections: [
      {
        id: "invoice-statuses",
        heading: "Invoice statuses",
        intro: "The status describes the money, not the insurer. It is derived from what has been paid against the total.",
        table: {
          columns: ["Status", "Meaning"],
          rows: [
            ["Open", "Issued, nothing paid yet."],
            ["Paid", "Settled in full."],
            ["Partial", "Part of the amount has been received."],
            ["Partial loss", "Part will not be recovered and has been written down."],
            ["Overpaid", "More was received than invoiced — usually a duplicate payment to refund."],
            ["Cancelled", "Withdrawn. Kept for the audit trail rather than deleted."],
            ["Complimentary", "Deliberately not charged. Excluded from billed revenue so it does not flatter the figures."],
          ],
        },
      },
      {
        id: "billing-type",
        heading: "Tiers Garant and Tiers Payant",
        intro:
          "Swiss billing has two routes, and the invoice records which one applies. Getting this wrong is the most common cause of an unpaid invoice.",
        table: {
          columns: ["Type", "Who receives the invoice", "Who chases whom"],
          rows: [
            [
              "TG — Tiers Garant",
              "The patient receives the invoice and pays the clinic, then claims reimbursement from their insurer.",
              "The clinic chases the patient.",
            ],
            [
              "TP — Tiers Payant",
              "The insurer is billed directly and pays the clinic.",
              "The clinic chases the insurer through MediData.",
            ],
          ],
        },
        bullets: [
          "The billing type is a filter on the invoice list, so each route can be worked separately",
          "The applicable health insurance law is recorded on the invoice as well",
          "Purely aesthetic treatment is self-pay and belongs on neither insurance route",
        ],
      },
      {
        id: "creating-an-invoice",
        heading: "Creating an invoice",
        steps: [
          {
            title: "Start from the patient or from the invoices list",
            body: "Working from the patient file keeps the treatment context in front of you.",
          },
          {
            title: "Add the services delivered",
            body: "Lines are priced from the service catalogue, so the price is right unless you deliberately change it.",
          },
          {
            title: "Set the treating doctor and the billing provider",
            body: "Both appear on the invoice and both matter for insurance submission and reporting.",
          },
          {
            title: "Choose the payment method",
            body: "Card, cash, bank transfer or insurance. Choosing insurance is what puts the invoice into the submission workflow.",
          },
          {
            title: "Add TarDoc codes if the treatment is medically indicated",
            body: "Required for anything you intend to bill to an insurer.",
          },
          { title: "Issue it", body: "A PDF is produced, and the invoice appears on the patient file and in the list." },
        ],
      },
      {
        id: "getting-paid",
        heading: "Getting paid",
        features: [
          {
            name: "Payment link",
            description:
              "A secure, tokenised link the patient opens to pay by card. Success, failure and cancellation each land on their own page, and the invoice is updated automatically.",
          },
          {
            name: "Swiss QR bill",
            description:
              "A QR bill for bank payment, generated to the Swiss Payment Standards, with the clinic as creditor and the patient as debtor.",
          },
          {
            name: "Instalments",
            description:
              "Larger treatments can be split. Instalments are created as sub-invoices of a parent, and are excluded from totals so the amount is never counted twice.",
          },
          {
            name: "Bank reconciliation",
            description:
              "Incoming bank payments can be imported from your bank's payment file and matched to invoices.",
          },
        ],
      },
      {
        id: "filters",
        heading: "Working the list",
        intro: "Filters combine, so you can narrow to exactly one problem at a time.",
        bullets: [
          "Status — for example everything still open",
          "Payment method — separate card, cash, bank transfer and insurance",
          "Billing type — TG or TP",
          "Insurance submission — where the submission has reached, including nothing submitted yet",
          "Date range and patient name",
          "Free-text search across the list",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Two saved routines cover most debtor work: open invoices with payment method card or cash older than 30 days, and insured invoices with nothing submitted yet.",
          },
        ],
      },
      {
        id: "reminders-and-archiving",
        heading: "Reminders, cancellation and archiving",
        bullets: [
          "Insurance submissions track up to three reminders and then collection, each visible as a status on the invoice",
          "Cancelling keeps the invoice for the audit trail; a cancelled insurance submission is a storno",
          "Archiving removes an invoice from the working list without deleting it — the list shows unarchived invoices by default",
        ],
        callouts: [
          {
            kind: "warning",
            body: "Never delete an issued invoice to correct a mistake. Cancel it and issue a corrected one, so the numbering and the audit trail stay intact.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Why is a complimentary treatment shown at full value on the invoice?",
        answer:
          "So the value of what you gave away is visible. Complimentary amounts are reported separately and excluded from billed revenue, rather than being invisible.",
      },
      {
        question: "An insurer says they never received the invoice.",
        answer:
          "Open the MediData page and check the submission for that invoice. The submission status tells you whether it was transmitted, delivered, accepted or rejected, and the insurer response can be opened in full.",
      },
    ],
    related: ["financials", "medidata-insurance", "tardoc", "payments", "services"],
    keywords: [
      "invoices",
      "billing",
      "tiers garant",
      "tiers payant",
      "unpaid",
      "debtors",
      "qr bill",
      "instalments",
      "complimentary",
    ],
  },

  {
    slug: "financials",
    title: "Financial overview",
    tagline: "Billed, paid and outstanding revenue for any period, with comparisons.",
    category: "billing",
    icon: "piggy",
    appPath: ["Menu", "Financials"],
    audience: ["admin", "staff"],
    summary:
      "The financial overview aggregates invoices and payments into the four numbers management asks for — total billed, total paid, outstanding and complimentary — and lets you compare a period against the previous period or the same period last year. It breaks revenue down by service using actual invoice lines rather than estimates.",
    keyCapabilities: [
      "See total billed, paid, outstanding and complimentary for a period",
      "Compare against the previous period or the same period last year",
      "Filter by patient, owner, doctor, service and item type",
      "Choose whether dates mean invoice date or payment date",
      "Show only unpaid items",
      "Break revenue down by service from real invoice lines",
    ],
    sections: [
      {
        id: "the-four-numbers",
        heading: "The four headline numbers",
        table: {
          columns: ["Figure", "What it means"],
          rows: [
            ["Total billed", "Everything invoiced in the period, excluding complimentary treatment."],
            ["Total paid", "What was actually received."],
            ["Outstanding", "Billed but not yet received — your debtor position."],
            ["Complimentary", "Treatment given without charge, shown separately so it neither inflates nor hides."],
          ],
        },
      },
      {
        id: "choosing-a-period",
        heading: "Choosing the period",
        steps: [
          {
            title: "Pick a preset or a custom range",
            body: "Presets cover the usual reporting periods; custom lets you set any two dates.",
          },
          {
            title: "Decide what the dates mean",
            body: "Filter by invoice date to measure what you billed, or by payment date to measure what you collected. These give different answers and both are legitimate — be clear which you are quoting.",
          },
          {
            title: "Add a comparison",
            body: "Compare with the previous period of the same length, or with the same period last year. Seasonality in aesthetic medicine makes the year-on-year comparison the more meaningful one.",
          },
        ],
      },
      {
        id: "filters",
        heading: "Filters",
        features: [
          { name: "Patient", description: "Everything for one patient." },
          { name: "Owner", description: "Revenue attributable to one advisor." },
          { name: "Doctor", description: "Revenue by treating doctor." },
          { name: "Service", description: "One or several treatments." },
          { name: "Item type", description: "Narrows the revenue breakdown to a type of invoice line." },
          { name: "Only unpaid", description: "Turns the page into a debtor report." },
        ],
      },
      {
        id: "by-service",
        heading: "Revenue by service",
        intro:
          "The service breakdown is computed from the actual line items on the filtered invoices, and from the comparison period when one is selected.",
        bullets: [
          "See which treatments generate the revenue, not just which are popular",
          "Compare a service against last year to see whether a price change worked",
          "Cross-check against the invoiced services report in Statistics to find treatment that was delivered but never billed",
        ],
        callouts: [
          {
            kind: "important",
            body: "Outstanding is only meaningful if invoices are kept up to date. An invoice that was paid in cash but never marked paid appears here as debt.",
          },
        ],
      },
    ],
    related: ["invoices", "statistics", "payments", "services"],
    keywords: [
      "financials",
      "revenue",
      "outstanding",
      "debtors",
      "paid",
      "comparison",
      "year on year",
      "reporting",
    ],
  },

  {
    slug: "tardoc",
    title: "TarDoc coding",
    tagline: "Look up Swiss tariff positions, tax points and medicines when billing medical treatment.",
    category: "billing",
    icon: "file",
    appPath: ["Menu", "TarDoc"],
    audience: ["doctor", "admin"],
    summary:
      "TarDoc is the Swiss outpatient tariff. This module holds the tariff catalogue and the medicines list, together with the tax point value and neutrality factor your clinic bills at, and a calculator to turn tax points into francs.",
    keyCapabilities: [
      "Search tariff positions by text or browse by chapter",
      "See tax points and the associated duration per position",
      "Search the medicines list",
      "See the current tax point value and neutrality factor",
      "Calculate a franc amount from tax points",
      "Apply codes to invoices intended for an insurer",
    ],
    sections: [
      {
        id: "what-is-here",
        heading: "What the page shows",
        features: [
          {
            name: "Tax point value",
            description: "The franc value of one tax point as billed by your clinic. It is what converts a tariff position into money.",
          },
          {
            name: "Neutrality factor",
            description: "The factor applied alongside the tax point value in the calculation.",
          },
          { name: "Active tariffs", description: "How many tariff positions are currently available to bill." },
          { name: "Active medicines", description: "How many medicines are available in the list." },
        ],
      },
      {
        id: "finding-a-position",
        heading: "Finding a tariff position",
        steps: [
          { title: "Search by text", body: "Type part of the description or the code." },
          { title: "Or filter by chapter", body: "Choose a chapter to browse a discipline rather than search blind." },
          {
            title: "Read the result",
            body: "Each position lists its description, its tax points and the duration attached to it.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "Duration matters: several positions are time-based, so the duration recorded has to match what actually happened in the room.",
          },
        ],
      },
      {
        id: "calculator",
        heading: "The tax point calculator",
        steps: [
          { title: "Enter the tax points", body: "From the position or the sum of positions you intend to bill." },
          {
            title: "Read the amount",
            body: "The calculator applies your tax point value and neutrality factor and gives the franc figure.",
          },
        ],
      },
      {
        id: "billing-with-tardoc",
        heading: "Using TarDoc on an invoice",
        bullets: [
          "Only medically indicated treatment is billed on TarDoc; purely aesthetic treatment is self-pay",
          "Codes on the invoice are what the insurance submission is built from",
          "A submission with missing or wrong coding is the most common reason for rejection",
          "Rejections and their explanations are readable in full on the MediData page",
        ],
        callouts: [
          {
            kind: "important",
            body: "Coding is a clinical and legal responsibility. The catalogue helps you find the right position; it does not decide whether a treatment is medically indicated.",
          },
        ],
      },
    ],
    related: ["invoices", "medidata-insurance", "medical-records", "financials"],
    keywords: ["tardoc", "tariff", "tax points", "coding", "swiss", "medical billing", "medicines", "chapters"],
  },

  {
    slug: "medidata-insurance",
    title: "Insurance & MediData",
    tagline: "Submit invoices to Swiss insurers electronically and track every response.",
    category: "billing",
    icon: "provider",
    appPath: ["Menu", "MediData"],
    audience: ["admin", "staff"],
    summary:
      "Insured invoices are submitted electronically through MediData and tracked from transmission to payment. The dashboard has four views — submissions, responses, participants and notifications — and insurer responses can be opened in full, including the reason for a rejection.",
    keyCapabilities: [
      "Submit invoices to insurers electronically",
      "Track submissions from transmitted through to paid",
      "Separate normal submissions from storno cancellations",
      "Read insurer responses in full, as PDF or printable page",
      "Look up participants and their identifiers",
      "See notifications from the network",
      "Track reminders and escalation to collection",
      "Maintain a directory of Swiss insurers",
    ],
    sections: [
      {
        id: "the-four-tabs",
        heading: "The four views",
        table: {
          columns: ["View", "What it is for"],
          rows: [
            ["Submissions", "Everything you have sent, with its current status. A sub-view separates normal submissions from storno cancellations."],
            ["Responses", "What insurers sent back. Each response can be opened in full."],
            ["Participants", "Insurers and providers on the network, with their identifiers."],
            ["Notifications", "Network-level messages that need attention."],
          ],
        },
      },
      {
        id: "submission-statuses",
        heading: "Submission statuses",
        intro:
          "The status on an invoice tells you exactly where the money is. They appear both here and as a filter on the invoice list.",
        table: {
          columns: ["Status", "Meaning"],
          rows: [
            ["Not submitted", "Nothing has been sent for this invoice yet."],
            ["Draft", "Prepared but not transmitted."],
            ["Pending", "Queued — waiting on the network or the insurer."],
            ["Transmitted", "Delivered to MediData, awaiting the insurer."],
            ["Delivered", "Delivered to the insurer, awaiting a decision."],
            ["Accepted", "The insurer accepted the submission."],
            ["Paid", "The insurer reported it as paid."],
            ["Partial", "A partial payment was recorded."],
            ["Rejected", "Formally rejected. The explanation is in the insurer response."],
            ["Disputed", "Under dispute."],
            ["Reminder 1, 2, 3", "Successive reminders have been sent."],
            ["Collection", "Escalated to collection."],
            ["Cancelled", "Withdrawn — a storno."],
          ],
        },
        callouts: [
          {
            kind: "warning",
            body: "A rejected status is the insurer's formal answer through the network. It does not always match what has actually arrived in the bank — always read the response and check the payment.",
          },
        ],
      },
      {
        id: "submitting",
        heading: "Submitting an invoice",
        steps: [
          {
            title: "Make sure the invoice is complete",
            body: "Patient identity and insurance details, treating doctor, billing provider, TarDoc coding and the correct billing type.",
          },
          {
            title: "Check the insurer",
            body: "The insurer must be identified by its network identifier. The Swiss insurers directory lets you search by name or identifier.",
          },
          { title: "Submit", body: "The submission is built and transmitted, and the invoice picks up a submission status." },
          {
            title: "Watch for the response",
            body: "Statuses advance by themselves as the network reports back; submissions are polled regularly rather than needing to be refreshed by hand.",
          },
        ],
      },
      {
        id: "reading-a-response",
        heading: "Reading an insurer response",
        intro:
          "Responses can be opened as a document, either rendered as PDF or as a printable page. They are structured, so a rejection can actually be diagnosed.",
        bullets: [
          "Parties — biller, provider, insurance and patient, each with their identifiers and address",
          "Balance — the amount, the amount due and the amount paid",
          "Accepted, rejected or pending detail, with the status codes the insurer returned",
          "Metadata — sender identifier, correlation reference and the timestamps, which is what you quote when querying a case",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Print or save the response before telephoning an insurer. The correlation reference is what lets their agent find the same case in seconds.",
          },
        ],
      },
      {
        id: "storno",
        heading: "Storno — cancelling a submission",
        bullets: [
          "A storno withdraws a submission that was sent in error",
          "Stornos are listed separately from normal submissions so the two are never confused",
          "Correct the invoice and submit again rather than sending a second submission alongside the first",
        ],
      },
      {
        id: "insurers-directory",
        heading: "The Swiss insurers directory",
        bullets: [
          "Search insurers by name or by network identifier",
          "Used when setting the insurer on a patient's cover or on an invoice",
          "Keeps identifiers consistent, which is what makes electronic submission work at all",
        ],
      },
    ],
    faqs: [
      {
        question: "How long should a submission take?",
        answer:
          "Transmission is quick; the insurer's decision is not. Statuses move on their own as responses arrive, so work by status rather than by date — anything sitting at transmitted or delivered for an unusually long time is worth querying.",
      },
      {
        question: "The submission was rejected but we were paid. What now?",
        answer:
          "That happens, and it is why the payment and the submission status are tracked separately. Reconcile against the bank, record the payment on the invoice, and keep the response for the file.",
      },
    ],
    related: ["invoices", "tardoc", "payments", "settings"],
    keywords: [
      "medidata",
      "insurance",
      "sumex",
      "submission",
      "insurer",
      "rejection",
      "storno",
      "swiss insurers",
      "reimbursement",
    ],
  },

  {
    slug: "payments",
    title: "Payments & reconciliation",
    tagline: "Card payment links, Swiss QR bills, bank file import and invoice linking.",
    category: "billing",
    icon: "card",
    appPath: ["Invoice", "Payment"],
    audience: ["staff", "admin"],
    summary:
      "Four routes bring money in and match it to invoices: a card payment link the patient opens, a Swiss QR bill for bank transfer, an import of your bank's payment file, and the invoice linker for invoices that arrived without a consultation attached.",
    keyCapabilities: [
      "Send a secure card payment link per invoice",
      "Offer instalment payment on larger treatments",
      "Generate a Swiss QR bill",
      "Have paid invoices updated automatically",
      "Import a bank payment file and reconcile",
      "Link invoices to the consultation they belong to",
    ],
    sections: [
      {
        id: "payment-links",
        heading: "Card payment links",
        steps: [
          { title: "Open the invoice", body: "From the invoices list or the patient file." },
          {
            title: "Create the payment link",
            body: "A secure tokenised link is produced for that invoice only.",
          },
          {
            title: "Send it to the patient",
            body: "By email or WhatsApp. The patient does not need an account to pay.",
          },
          {
            title: "Let the status update itself",
            body: "The payment provider reports back and the invoice is updated. Payment status can also be re-synchronised if a result is delayed.",
          },
        ],
        bullets: [
          "A link that has already been paid says so rather than charging twice",
          "An invalid or expired link shows a clear error page",
          "Successful, failed and cancelled payments each land on their own page, so the patient knows what happened",
        ],
      },
      {
        id: "instalments",
        heading: "Instalments",
        intro:
          "Larger treatments can be paid in instalments, each of which is a sub-invoice of the parent invoice with its own payment link.",
        bullets: [
          "The parent invoice keeps the full amount",
          "Instalments are excluded from totals so the revenue is not double counted",
          "Each instalment can be paid independently",
        ],
      },
      {
        id: "qr-bill",
        heading: "Swiss QR bill",
        intro:
          "For patients who pay by bank transfer, invoices can carry a Swiss QR bill built to the Swiss Payment Standards.",
        bullets: [
          "The clinic appears as creditor with a structured address and IBAN",
          "The patient appears as debtor when their address is known",
          "Amounts can be fixed, or left open where the patient chooses what to pay",
          "CHF and EUR are supported",
        ],
        callouts: [
          {
            kind: "note",
            body: "The clinic's IBAN and address are configured once by an administrator. An incomplete creditor address is the usual reason a QR bill will not generate.",
          },
        ],
      },
      {
        id: "bank-reconciliation",
        heading: "Reconciling bank payments",
        steps: [
          { title: "Export the payment file from your bank", body: "The standard payment reporting file." },
          { title: "Import it", body: "The file is processed and the payments it contains are read." },
          {
            title: "Review the matches",
            body: "Payments are matched to invoices, and what cannot be matched is left visible rather than silently dropped.",
          },
          { title: "Resolve the rest by hand", body: "Usually a reference the patient did not quote correctly." },
        ],
      },
      {
        id: "invoice-linker",
        heading: "The invoice linker",
        intro:
          "Some invoices arrive without being attached to the consultation they belong to — typically after an import or a manual entry. The linker cleans that up.",
        steps: [
          { title: "Open Invoice Linker", body: "It lists unlinked invoices." },
          { title: "Pick an invoice", body: "The patient's consultations are shown alongside it." },
          { title: "Link it to the right consultation", body: "Reporting that joins treatment to revenue then works correctly." },
        ],
        callouts: [
          {
            kind: "tip",
            body: "Clear the linker monthly. Unlinked invoices are the main reason the consultations and services reports disagree with the financial overview.",
          },
        ],
      },
    ],
    related: ["invoices", "financials", "medidata-insurance", "patient-app"],
    keywords: [
      "payments",
      "payrexx",
      "payment link",
      "qr bill",
      "instalments",
      "reconciliation",
      "bank",
      "invoice linker",
      "card",
    ],
  },
];
