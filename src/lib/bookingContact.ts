/**
 * Contact-detail rules for every booking path.
 *
 * Why this exists: the clinic needs a reachable phone number plus a date of
 * birth and a postal address on file, so a missed first appointment can actually
 * be billed. Four separate code paths create bookings (public doctor pages, the
 * website embed, the patient app, and the AI phone agent), so the rules live
 * here rather than being re-implemented — and re-diverging — in each one.
 */

export type ContactField = "phone" | "dob" | "streetAddress" | "postalCode" | "town";

export type BookingContactInput = {
  phone?: string | null;
  dob?: string | null;
  streetAddress?: string | null;
  postalCode?: string | null;
  town?: string | null;
};

/** A patient row, in the database's snake_case or this module's camelCase. */
export type PatientContactRecord = {
  phone?: string | null;
  dob?: string | null;
  street_address?: string | null;
  postal_code?: string | null;
  town?: string | null;
  country?: string | null;
};

export const REQUIRED_CONTACT_FIELDS: ContactField[] = [
  "phone",
  "dob",
  "streetAddress",
  "postalCode",
  "town",
];

/** Maps a contact field to its `patients` column. */
export const CONTACT_FIELD_COLUMN: Record<ContactField, string> = {
  phone: "phone",
  dob: "dob",
  streetAddress: "street_address",
  postalCode: "postal_code",
  town: "town",
};

/** Human labels for staff-facing surfaces (agenda badge, missing-details list). */
export const CONTACT_FIELD_LABEL: Record<ContactField, string> = {
  phone: "phone",
  dob: "date of birth",
  streetAddress: "street",
  postalCode: "postal code",
  town: "town",
};

function blank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function recordValue(record: PatientContactRecord | null, field: ContactField): string | null {
  if (!record) return null;
  switch (field) {
    case "phone":
      return record.phone ?? null;
    case "dob":
      return record.dob ?? null;
    case "streetAddress":
      return record.street_address ?? null;
    case "postalCode":
      return record.postal_code ?? null;
    case "town":
      return record.town ?? null;
  }
}

/**
 * Normalises a Swiss or international number to E.164.
 *
 * Deliberately NOT `normalizePhone` from ./retell: that helper turns a bare
 * `79 123 45 67` into `+79123456 7` — a Russian/Kazakh number — and that is
 * exactly the format the booking forms suggest via their placeholder. It is left
 * untouched because live call paths depend on it.
 */
export function normalizeBookingPhone(raw: string | null | undefined): string {
  if (blank(raw)) return "";
  const trimmed = String(raw).trim();

  // Keep a leading +, drop every other non-digit.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (hasPlus) return `+${digits}`;
  // 0041 79 ... → +4179...
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  // 079 ... → +4179...
  if (digits.startsWith("0")) return `+41${digits.slice(1)}`;
  // Already a country code we recognise as Swiss.
  if (digits.startsWith("41") && digits.length >= 11) return `+${digits}`;
  // A bare Swiss national number: 9 digits, e.g. 79 123 45 67 or 22 555 01 00.
  if (digits.length === 9) return `+41${digits}`;

  return `+${digits}`;
}

export function validatePhone(value: string | null | undefined): boolean {
  const normalised = normalizeBookingPhone(value);
  // E.164 allows up to 15 digits; require at least 8 to reject obvious junk.
  return /^\+\d{8,15}$/.test(normalised);
}

export type DobValidation = { ok: true; iso: string } | { ok: false; reason: string };

const MIN_AGE_YEARS = 16;
const MAX_AGE_YEARS = 120;

/** Accepts `YYYY-MM-DD`. Rejects impossible dates, future dates and implausible ages. */
export function validateDob(value: string | null | undefined): DobValidation {
  if (blank(value)) return { ok: false, reason: "Date of birth is required" };

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { ok: false, reason: "Use the format YYYY-MM-DD" };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Round-trip through UTC to reject 31 February and similar.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, reason: "That date does not exist" };
  }

  const now = new Date();
  if (date.getTime() > now.getTime()) {
    return { ok: false, reason: "Date of birth cannot be in the future" };
  }

  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() < month - 1 ||
    (now.getUTCMonth() === month - 1 && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;

  if (age < MIN_AGE_YEARS) {
    return { ok: false, reason: `Patients must be at least ${MIN_AGE_YEARS} years old` };
  }
  if (age > MAX_AGE_YEARS) {
    return { ok: false, reason: "Please check the year of birth" };
  }

  return { ok: true, iso: `${match[1]}-${match[2]}-${match[3]}` };
}

/** Builds `YYYY-MM-DD` from separate day/month/year inputs, or "" if incomplete. */
export function composeDob(day: string, month: string, year: string): string {
  if (blank(day) || blank(month) || blank(year)) return "";
  return `${year.trim().padStart(4, "0")}-${month.trim().padStart(2, "0")}-${day
    .trim()
    .padStart(2, "0")}`;
}

/** Splits `YYYY-MM-DD` back into day/month/year for prefilling a form. */
export function splitDob(iso: string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  if (blank(iso)) return { day: "", month: "", year: "" };
  const parts = String(iso).trim().split("-");
  if (parts.length !== 3) return { day: "", month: "", year: "" };
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/** Swiss postal codes are four digits; anything else gets a looser check. */
export function validatePostalCode(value: string | null | undefined, country = "CH"): boolean {
  if (blank(value)) return false;
  const trimmed = String(value).trim();
  if ((country || "CH").toUpperCase() === "CH") return /^\d{4}$/.test(trimmed);
  return /^[A-Za-z0-9][A-Za-z0-9\s-]{1,9}$/.test(trimmed);
}

/** A street must plausibly identify a building, not just be a single letter. */
export function validateStreetAddress(value: string | null | undefined): boolean {
  if (blank(value)) return false;
  const trimmed = String(value).trim();
  if (trimmed.length < 3) return false;
  return /\d/.test(trimmed) || trimmed.length >= 5;
}

export function validateTown(value: string | null | undefined): boolean {
  return !blank(value) && String(value).trim().length >= 2;
}

/**
 * Which required details we would still not have after applying this submission.
 *
 * A field counts as satisfied when the stored record already has it — a booking
 * is never an opportunity to re-interrogate a patient we already know.
 */
export function missingContactFields(
  record: PatientContactRecord | null,
  input: BookingContactInput
): ContactField[] {
  return REQUIRED_CONTACT_FIELDS.filter((field) => {
    if (!blank(recordValue(record, field))) return false;
    return blank(input[field]);
  });
}

/**
 * Validation errors for values the patient actually submitted. Separate from
 * `missingContactFields`: absent is "we still need this", invalid is "what you
 * typed will not do".
 */
export function invalidContactFields(input: BookingContactInput): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};

  if (!blank(input.phone) && !validatePhone(input.phone)) {
    errors.phone = "Enter a valid phone number";
  }
  if (!blank(input.dob)) {
    const dob = validateDob(input.dob);
    if (!dob.ok) errors.dob = dob.reason;
  }
  if (!blank(input.streetAddress) && !validateStreetAddress(input.streetAddress)) {
    errors.streetAddress = "Enter the street and building number";
  }
  if (!blank(input.postalCode) && !validatePostalCode(input.postalCode)) {
    errors.postalCode = "Enter a valid postal code";
  }
  if (!blank(input.town) && !validateTown(input.town)) {
    errors.town = "Enter the town";
  }

  return errors;
}

/**
 * The patient columns to write: only those currently empty on the record.
 *
 * This is the fix for bookings losing the phone number a patient typed. The
 * route previously matched an existing patient and then wrote back nothing but
 * the language preference, so the submitted phone was silently dropped. Filling
 * only blanks means a booking can complete a record but can never overwrite a
 * number staff have already corrected.
 */
export function fillOnlyEmpty(
  record: PatientContactRecord | null,
  input: BookingContactInput
): Record<string, string> {
  const updates: Record<string, string> = {};

  for (const field of REQUIRED_CONTACT_FIELDS) {
    if (!blank(recordValue(record, field))) continue;
    const submitted = input[field];
    if (blank(submitted)) continue;

    const column = CONTACT_FIELD_COLUMN[field];
    if (field === "phone") {
      updates[column] = normalizeBookingPhone(submitted);
    } else if (field === "dob") {
      const dob = validateDob(submitted);
      if (dob.ok) updates[column] = dob.iso;
    } else {
      updates[column] = String(submitted).trim();
    }
  }

  return updates;
}

/**
 * Which required details a stored patient is still missing. Drives the agenda
 * warning badge and the missing-details list; nothing is written.
 */
export function patientDetailsGaps(record: PatientContactRecord | null): ContactField[] {
  return REQUIRED_CONTACT_FIELDS.filter((field) => blank(recordValue(record, field)));
}

/** "phone, date of birth and town" — for a badge tooltip or a list cell. */
export function describeGaps(gaps: ContactField[]): string {
  const labels = gaps.map((field) => CONTACT_FIELD_LABEL[field]);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
