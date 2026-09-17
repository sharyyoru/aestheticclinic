import type { DocModule } from "./types";

export const schedulingModules: DocModule[] = [
  {
    slug: "agenda",
    title: "Agenda",
    tagline: "The clinic calendar: book, move and document appointments across doctors and rooms.",
    category: "scheduling",
    icon: "calendar",
    appPath: ["Menu", "Agenda"],
    audience: ["staff", "admin", "doctor"],
    summary:
      "The agenda is the busiest screen in the platform. It shows one day, a range of days or a whole month, with a column per doctor calendar, colour-coded appointment categories, and drag-to-create booking. Appointments carry a booking status that drives whether the patient gets reminders.",
    keyCapabilities: [
      "Switch between day, multi-day range and month views",
      "See a column per doctor, plus internal calendars such as the operation room",
      "Create an appointment by dragging across the time you need",
      "Move appointments and notify the patient automatically",
      "Colour-code appointments by category and edit those colours",
      "Mark appointments done, moved, cancelled or no-show",
      "Review cancelled appointments separately",
    ],
    sections: [
      {
        id: "views",
        heading: "The three views",
        table: {
          columns: ["View", "What it shows", "Best for"],
          rows: [
            ["Day", "A single date with a column per doctor calendar and a time grid.", "Running the day at reception."],
            [
              "Range",
              "Several consecutive days side by side, chosen by dragging across the date strip.",
              "Planning a week, or finding the next free slot.",
            ],
            ["Month", "A month grid with appointment counts and previews.", "Seeing how full the coming weeks are."],
          ],
        },
        steps: [
          { title: "Open the view menu", body: "Beside the date at the top of the agenda." },
          { title: "Pick day, range or month", body: "The arrows either side of the date then move by day, week or month to match." },
          { title: "Return to a single day", body: "Selecting a date in the month view drops you into the day view for that date." },
        ],
      },
      {
        id: "booking-an-appointment",
        heading: "Booking an appointment",
        steps: [
          { title: "Go to the right day and doctor", body: "In day or range view, find the doctor's column." },
          {
            title: "Drag across the time you need",
            body: "Press at the start time and drag to the end time. The duration of the appointment is set by how far you drag, so there is no need to type times.",
            note: "This works with touch as well, so it can be done on a tablet at the desk.",
          },
          {
            title: "Choose the patient",
            body: "Search for an existing patient, or create one if this is a first contact.",
          },
          {
            title: "Set the category",
            body: "Search the category list — for example an injection, a consultation or an operation. The category determines the colour on the calendar.",
          },
          {
            title: "Add the reason and location",
            body: "The reason is what appears on the appointment block, so keep it short and recognisable.",
          },
          { title: "Save", body: "The patient receives a booking confirmation automatically, and a reminder the day before." },
        ],
      },
      {
        id: "categories-and-colours",
        heading: "Categories and colours",
        intro:
          "Colour is how a full agenda becomes readable at a glance. Each appointment category has a colour, and you can change it.",
        bullets: [
          "Categories are searchable when booking, so long lists stay usable",
          "Each category has its own colour on the calendar",
          "The colour can be changed from the agenda using the colour picker on the category",
          "Categories are also embedded in the appointment so reporting can group by them",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Agree colours once, as a clinic: for instance warm colours for revenue-generating treatment, cool colours for consultations and follow-up. Everyone then reads the day the same way.",
          },
        ],
      },
      {
        id: "moving-and-statuses",
        heading: "Moving, cancelling and marking appointments",
        intro:
          "Appointments carry a booking status shown on the block. The status is what stops a patient being reminded about a slot they are no longer attending.",
        table: {
          columns: ["Status", "Meaning", "Effect on patient messages"],
          rows: [
            ["(none)", "Booked and expected.", "Confirmation and day-before reminder are sent."],
            ["Déplacé — moved", "The appointment was moved to another slot; this row is the old one.", "No reminder is sent for this slot."],
            ["Annulé — cancelled", "Cancelled from the agenda.", "No reminder is sent."],
            ["Fait — done", "The appointment took place.", "Nothing further is sent."],
          ],
        },
        steps: [
          {
            title: "To reschedule, create the new slot and mark the old one moved",
            body: "The clinic workflow keeps the original row for the audit trail and tags it as moved, rather than editing the time in place.",
          },
          {
            title: "To cancel, set the status to cancelled",
            body: "Cancelled appointments are also listed on their own page so they can be reviewed and followed up.",
          },
          {
            title: "To close off the day, mark attended appointments done",
            body: "This keeps tomorrow's list clean and makes activity reporting meaningful.",
          },
        ],
        callouts: [
          {
            kind: "warning",
            body: "Marking the status matters more than it looks. An appointment left as booked after being moved will send the patient a reminder for a slot that no longer exists.",
          },
        ],
      },
      {
        id: "operation-room",
        heading: "Internal calendars",
        intro:
          "Not every column is a doctor. The operation room is an internal planning calendar rather than a patient-facing one.",
        bullets: [
          "Operation room entries do not send patient confirmations or reminders",
          "Moving an operation room entry does not notify anybody outside the clinic",
          "Use it to reserve theatre capacity alongside the doctor who will operate",
        ],
      },
      {
        id: "cancelled-appointments",
        heading: "Cancelled appointments",
        intro:
          "A dedicated page lists cancellations so they are worked rather than forgotten.",
        bullets: [
          "See who cancelled and when",
          "Follow up to rebook, or convert the slot into a deal task",
          "Use it to spot patterns — a doctor, a treatment or a weekday with unusual cancellation rates",
        ],
      },
    ],
    faqs: [
      {
        question: "Why did a patient get a reminder for an appointment we moved?",
        answer:
          "The original appointment was probably left without a moved status. Reminders are suppressed based on that status, so the old row must be marked Déplacé when the new slot is created.",
      },
      {
        question: "Can I book without choosing a patient first?",
        answer:
          "No — appointments belong to a patient record so the visit, its notes and its invoice stay connected. Create the patient during booking if they are new.",
      },
    ],
    related: ["doctor-availability", "online-bookings", "appointment-reminders", "patient-record"],
    keywords: [
      "agenda",
      "calendar",
      "appointments",
      "booking",
      "reschedule",
      "cancel",
      "no show",
      "day view",
      "month view",
      "operation room",
    ],
  },

  {
    slug: "doctor-availability",
    title: "Doctor availability",
    tagline: "Working hours, days off and blocked dates that decide what can be booked.",
    category: "scheduling",
    icon: "clipboard",
    appPath: ["Menu", "Settings", "Doctor Scheduling"],
    audience: ["admin"],
    summary:
      "Availability is configured once in Settings and then constrains both the internal agenda and the public booking pages. Three separate screens cover it: regular working hours, individual days off, and dates blocked for the whole clinic.",
    keyCapabilities: [
      "Set each doctor's working hours",
      "Choose appointment slot and buffer durations",
      "Record individual doctors' days off",
      "Block dates for the entire clinic",
      "Keep online booking in step with reality automatically",
    ],
    sections: [
      {
        id: "working-hours",
        heading: "Working hours",
        steps: [
          { title: "Open Settings › Doctor Scheduling", body: "Administrators only." },
          { title: "Select the doctor", body: "Each doctor is configured independently." },
          {
            title: "Set the hours they work",
            body: "These hours define where appointments may be placed and which slots the public booking page offers.",
          },
          {
            title: "Choose slot durations",
            body: "Slot lengths can be set in steps from 5 minutes up to 2 hours, so a consultation and an injection can be offered at their real durations.",
          },
        ],
      },
      {
        id: "days-off",
        heading: "Doctor days off",
        intro: "Individual absences — holiday, conference, training — are entered per doctor.",
        steps: [
          { title: "Open Settings › Doctor Days Off", body: "" },
          { title: "Select the doctor and the dates", body: "" },
          {
            title: "Save",
            body: "Those dates stop being offered online, and the agenda shows the doctor as unavailable.",
          },
        ],
        callouts: [
          {
            kind: "tip",
            body: "Enter holidays as soon as they are approved. Every day of delay is a day patients can book a slot you will have to cancel.",
          },
        ],
      },
      {
        id: "blocked-dates",
        heading: "Blocked dates for the whole clinic",
        intro:
          "Use blocked dates for public holidays, clinic closures, renovation or a team event — anything that applies to everyone.",
        bullets: [
          "Blocked dates apply across all doctors at once",
          "Online booking will not offer a blocked date",
          "Existing appointments on a newly blocked date are not removed automatically — check the agenda and contact affected patients",
        ],
        callouts: [
          {
            kind: "warning",
            body: "Blocking a date does not cancel what is already booked on it. Review the agenda for that date afterwards.",
          },
        ],
      },
      {
        id: "how-this-affects-booking",
        heading: "How availability reaches patients",
        intro: "The public side reads the same configuration, so there is only ever one truth.",
        bullets: [
          "The public booking page offers only slots inside working hours",
          "Days off and blocked dates are removed from the offered slots",
          "Slots already taken in the agenda disappear from the public page",
          "Each doctor has their own booking page once they are bookable",
        ],
      },
    ],
    related: ["agenda", "online-bookings", "settings", "appointment-reminders"],
    keywords: [
      "availability",
      "working hours",
      "days off",
      "holiday",
      "blocked dates",
      "slots",
      "doctor scheduling",
      "closure",
    ],
  },

  {
    slug: "online-bookings",
    title: "Online booking",
    tagline: "Let patients book themselves, and manage what arrives.",
    category: "scheduling",
    icon: "bookings",
    appPath: ["Menu", "Bookings"],
    audience: ["staff", "admin", "patient"],
    summary:
      "Patients can book without calling, either from a public booking page, from a specific doctor's page, or from a booking form embedded in your own website. Everything that arrives lands in Online Bookings, where it can be reviewed against the agenda.",
    keyCapabilities: [
      "Publish a public booking page for the clinic",
      "Publish a page per doctor",
      "Embed a booking form in your own website",
      "Review incoming bookings with status counts",
      "Filter bookings by date range and status",
      "Have patient records created automatically from bookings",
    ],
    sections: [
      {
        id: "the-public-page",
        heading: "The public booking page",
        intro:
          "The booking flow is deliberately short, because every extra step loses bookings. The patient chooses what they need, picks a location, chooses a doctor and a free slot, and confirms with their contact details.",
        bullets: [
          "Free consultations are presented as such, which is what most first-time enquiries are looking for",
          "Locations are selectable when the clinic operates from more than one site",
          "Only genuinely free slots are shown, taken from doctor availability and the live agenda",
          "The patient sees an immediate confirmation on screen after booking",
        ],
      },
      {
        id: "doctor-pages",
        heading: "Per-doctor booking pages",
        intro:
          "Each bookable doctor has their own page, which is useful for a doctor's personal profile, a referral link or a targeted campaign.",
        steps: [
          { title: "Make sure the doctor is configured", body: "Working hours must exist in Settings › Doctor Scheduling." },
          {
            title: "Share the doctor's booking link",
            body: "Use it in email signatures, on the doctor's own profile page or in campaign material.",
          },
          {
            title: "Bookings arrive in the same place",
            body: "They appear in Online Bookings and in the agenda like any other booking.",
          },
        ],
      },
      {
        id: "embedding",
        heading: "Embedding booking in your website",
        intro:
          "A booking form and a contact form can be embedded as an iframe in your own site, with a snippet that resizes the frame to fit its content.",
        steps: [
          { title: "Open Lead Import › Embed Forms", body: "The embed addresses for the contact form and the booking form are listed there." },
          { title: "Copy the snippet", body: "It includes the small script that adjusts the iframe height as the form grows." },
          { title: "Paste it into your page", body: "Anywhere in the body where the form should appear." },
        ],
        callouts: [
          {
            kind: "note",
            body: "Embedded pages are restricted to approved website domains for security. Ask your administrator to add a new domain before embedding on it.",
          },
        ],
      },
      {
        id: "managing-bookings",
        heading: "Managing what arrives",
        intro:
          "The Online Bookings screen counts bookings by status and lets you narrow the list down.",
        table: {
          columns: ["Status", "Meaning"],
          rows: [
            ["Scheduled", "Booked by the patient and awaiting the appointment."],
            ["Confirmed", "Confirmed by the clinic."],
            ["Completed", "The appointment took place."],
            ["Cancelled", "Cancelled by the patient or the clinic."],
          ],
        },
        bullets: [
          "Totals for each status are shown at the top of the page",
          "Filter by date range, including today and all time",
          "Filter by a single status to work through a queue",
          "Each row shows the patient's name, email and phone plus the requested time and location",
        ],
      },
      {
        id: "after-a-booking",
        heading: "What happens after a patient books",
        bullets: [
          "A patient record is created if the person is new, or matched if they already exist",
          "The appointment appears in the agenda for the chosen doctor",
          "A booking confirmation is sent to the patient",
          "A reminder is scheduled for the day before",
        ],
        callouts: [
          {
            kind: "tip",
            body: "Check Online Bookings at the start of the day. Self-booked patients sometimes choose a slot that is technically free but clinically wrong, and it is easier to move it early.",
          },
        ],
      },
    ],
    related: ["agenda", "doctor-availability", "appointment-reminders", "forms-and-embeds"],
    keywords: [
      "online booking",
      "self booking",
      "booking page",
      "embed",
      "iframe",
      "appointments",
      "bookings",
      "doctor page",
    ],
  },

  {
    slug: "appointment-reminders",
    title: "Appointment reminders",
    tagline: "Automatic confirmations and day-before reminders on WhatsApp and email.",
    category: "scheduling",
    icon: "phone",
    appPath: ["Automatic"],
    audience: ["staff", "admin"],
    summary:
      "Reminders run by themselves. Every new appointment produces a confirmation shortly after booking, and every upcoming appointment produces a reminder the day before. Both go out on WhatsApp where possible and by email as well, and both are suppressed for appointments that have been moved or cancelled.",
    keyCapabilities: [
      "Booking confirmation about an hour after the appointment is created",
      "Reminder the day before the appointment",
      "WhatsApp first, with email in parallel",
      "Automatic suppression for moved and cancelled appointments",
      "No patient messages for internal calendars such as the operation room",
      "Every send recorded against the patient",
    ],
    sections: [
      {
        id: "what-goes-out-when",
        heading: "What goes out, and when",
        table: {
          columns: ["Message", "Timing", "Channels"],
          rows: [
            ["Booking confirmation", "Around an hour after the appointment is created.", "WhatsApp and email"],
            ["Appointment reminder", "The day before the appointment.", "WhatsApp and email"],
          ],
        },
        bullets: [
          "The schedule is checked every 15 minutes, so messages go out promptly without being instant",
          "Dates and times are formatted for Switzerland, including the weekday",
          "Replies come back to the clinic's own address, so a patient answering the reminder reaches a human",
        ],
      },
      {
        id: "when-nothing-is-sent",
        heading: "When nothing is sent",
        intro:
          "Suppression is deliberate and centralised, so every send path agrees. Nothing goes out when:",
        bullets: [
          "The appointment is tagged as moved (Déplacé) — the patient will be reminded about the new slot instead",
          "The appointment is tagged as cancelled (Annulé)",
          "The entry belongs to an internal calendar such as the operation room",
          "The patient has no reachable phone number or email address",
        ],
        callouts: [
          {
            kind: "important",
            body: "This is why agenda statuses matter. Rescheduling by creating a new appointment and tagging the old one as moved is what keeps reminders correct.",
          },
        ],
      },
      {
        id: "channels",
        heading: "How the channels are chosen",
        steps: [
          {
            title: "WhatsApp is attempted first",
            body: "It has the highest read rate, and the message is queued rather than sent blindly so delivery can be retried.",
          },
          {
            title: "Email is sent as well",
            body: "The email uses the clinic's appointment template with the date, time, weekday and location.",
          },
          {
            title: "Both are logged",
            body: "The send is recorded against the patient, so anyone opening the file can see the patient was reminded.",
          },
        ],
        callouts: [
          {
            kind: "note",
            body: "WhatsApp requires the clinic's WhatsApp connection to be active. If it drops, reminders still go out by email.",
          },
        ],
      },
      {
        id: "reducing-no-shows",
        heading: "Using reminders to reduce no-shows",
        bullets: [
          "Keep patient phone numbers in international format so WhatsApp can reach them — imported numbers are normalised for Switzerland automatically",
          "Mark no-shows honestly in the agenda so the pattern is visible in reporting",
          "Use a workflow to create a follow-up task when an appointment is cancelled, so the slot gets refilled",
          "Check the Missed Calls page — a patient trying to reach you to move an appointment often shows up there first",
        ],
      },
    ],
    faqs: [
      {
        question: "Can we change the wording or the timing?",
        answer:
          "The templates and the schedule are configured by your administrator during onboarding. WhatsApp message templates in particular are maintained under Settings › WhatsApp Templates.",
      },
      {
        question: "A patient says they never got a reminder.",
        answer:
          "Open the patient file and check the communication history for that appointment. The most common causes are a mistyped mobile number, an appointment tagged as moved or cancelled, or an entry on an internal calendar.",
      },
    ],
    related: ["agenda", "whatsapp", "email", "workflows"],
    keywords: [
      "reminders",
      "confirmation",
      "no show",
      "whatsapp reminder",
      "email reminder",
      "automatic",
      "day before",
    ],
  },
];
