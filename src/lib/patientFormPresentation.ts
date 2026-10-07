import type { FormDefinition, FormField } from "@/lib/formDefinitions";

const PLACEHOLDER_PATTERN = /(?:[._\u2026]{4,}|(?:â€¦){2,}|(?:Ã¢â‚¬Â¦){2,})/;
const PLACEHOLDER_ONLY_PATTERN = /^(?:[._\u2026\s]|â€¦|Ã¢â‚¬Â¦)+$/;

export function isConfirmationDocument(form: FormDefinition): boolean {
  return form.category === "consent" || form.category === "instructions";
}

/**
 * Identity fields, in the order a signed document should present them.
 *
 * These come from the patient record rather than from the patient: they are
 * rendered read-only above the signature, and only turn into an input when the
 * record has no value to show. They are kept out of the *response* set so the
 * two lists stay disjoint, but they are still validated and still printed.
 */
const IDENTITY_FIELD_ORDER = [
  "full_name",
  "patient_name",
  "first_name",
  "last_name",
  "date_of_birth",
  "signature_date",
];

const IDENTITY_FIELD_IDS = new Set(IDENTITY_FIELD_ORDER);

/**
 * The only checkbox the "I have read and agree" button legitimately replaces.
 *
 * Every other checkbox on a consent document is a distinct affirmation — the
 * individual risk acknowledgments on consentement-lift-reduction-en, for
 * instance — and collapsing those into one button loses consent the clinic is
 * meant to hold.
 */
const CONFIRMATION_CHECKBOX_FIELD_ID = "document_acknowledged";

export function getConfirmationIdentityFields(form: FormDefinition): FormField[] {
  if (!isConfirmationDocument(form)) return [];
  return form.sections
    .flatMap((section) => section.fields)
    .filter((field) => IDENTITY_FIELD_IDS.has(field.id))
    .sort((a, b) => IDENTITY_FIELD_ORDER.indexOf(a.id) - IDENTITY_FIELD_ORDER.indexOf(b.id));
}

export function getPatientResponseFields(form: FormDefinition): FormField[] {
  const fields = form.sections.flatMap((section) => section.fields);
  if (!isConfirmationDocument(form)) return fields;
  return fields.filter((field) => {
    // Rendered by the identity block instead, not re-asked of the patient.
    if (IDENTITY_FIELD_IDS.has(field.id)) return false;
    if (field.id === CONFIRMATION_CHECKBOX_FIELD_ID) return false;
    // Always collect the drawn signature. Every consent and instruction form
    // the clinic sends was signed before this policy existed, and the signed
    // copy is what they rely on. Excluding it on 2026-10-07 produced an HBOT
    // consent with nothing on file and the clinic had to ask the patient to
    // sign a second time.
    if (field.type === "signature") return true;
    // Everything else is a genuine patient response: risk acknowledgments,
    // photo authorization, procedure date, treatment description, ...
    return true;
  });
}

export function isDocumentPlaceholderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_ONLY_PATTERN.test(trimmed)) return true;
  if (!PLACEHOLDER_PATTERN.test(trimmed)) return false;

  const normalized = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    /^(nom|prenom|surname|first name|name|patient name|nom du patient)\s*:/.test(normalized) ||
    /^(date|date de naissance|date naissance|date of birth|ne\(e\) le|geneva, the|a \(lieu\))\s*:/.test(normalized) ||
    /signature/.test(normalized) ||
    PLACEHOLDER_PATTERN.test(trimmed)
  );
}

export function cleanDocumentText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isDocumentPlaceholderLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
