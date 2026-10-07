import type { FormDefinition, FormField } from "@/lib/formDefinitions";

const PLACEHOLDER_PATTERN = /(?:[._\u2026]{4,}|(?:â€¦){2,}|(?:Ã¢â‚¬Â¦){2,})/;
const PLACEHOLDER_ONLY_PATTERN = /^(?:[._\u2026\s]|â€¦|Ã¢â‚¬Â¦)+$/;

export function isConfirmationDocument(form: FormDefinition): boolean {
  return form.category === "consent" || form.category === "instructions";
}

const AUTOFILLED_OR_CONFIRMED_FIELD_IDS = new Set([
  "full_name",
  "first_name",
  "last_name",
  "patient_name",
  "date_of_birth",
  "signature",
  "signature_date",
  "document_acknowledged",
]);

export function getPatientResponseFields(form: FormDefinition): FormField[] {
  const fields = form.sections.flatMap((section) => section.fields);
  if (!isConfirmationDocument(form)) return fields;
  return fields.filter((field) => {
    if (AUTOFILLED_OR_CONFIRMED_FIELD_IDS.has(field.id)) return false;
    if (field.type === "radio" || field.type === "select") return true;
    // Checkboxes on consent documents are covered by the single confirmation.
    if (field.type === "checkbox" || field.type === "signature") return false;
    // Keep genuine patient responses that are not prefilled (procedure date,
    // treatment description, emergency contact, ...).
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
