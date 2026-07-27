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

export function isPatientFormFieldRequired(
  field: FormField,
  submissionData: PatientFormData
): boolean {
  if (field.requiredWhen) {
    return submissionData[field.requiredWhen.fieldId] === field.requiredWhen.equals;
  }

  // Requiredness must be intentional. Medical forms contain many fields where
  // an empty value itself means "not applicable" (previous operations, optional
  // history details, checklist items, etc.), so an omitted `required` flag must
  // never turn into a blanket requirement.
  return field.required === true;
}

export function getUnansweredPatientFormFields(
  form: FormDefinition,
  submissionData: PatientFormData
): FormField[] {
  return form.sections
    .flatMap((section) => section.fields)
    .filter(
      (field) =>
        isPatientFormFieldRequired(field, submissionData) &&
        !isFieldAnswered(field, submissionData[field.id])
    );
}
