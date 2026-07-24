import type { FormDefinition, FormField } from "@/lib/formDefinitions";

type SubmissionValue = string | boolean | string[] | null | undefined;
export type PatientFormData = Record<string, SubmissionValue>;

function isFieldAnswered(field: FormField, value: SubmissionValue): boolean {
  if (field.type === "checkbox") {
    // Optional medical-history checkboxes are answered by either state. Required
    // acknowledgement/consent checkboxes must be explicitly accepted.
    return field.required ? value === true : true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return typeof value === "string" && value.trim().length > 0;
}

export function getUnansweredPatientFormFields(
  form: FormDefinition,
  submissionData: PatientFormData
): FormField[] {
  return form.sections
    .flatMap((section) => section.fields)
    .filter((field) => !isFieldAnswered(field, submissionData[field.id]));
}
