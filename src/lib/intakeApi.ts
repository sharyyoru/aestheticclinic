// Server-mediated access for public intake flows. Direct table access from the
// browser is not available (RLS denies the anon role), so these call
// /api/public/intake which performs the queries with the service role.

async function intakeApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/public/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Intake request failed (${res.status})`);
  }
  return json as T;
}

export type PatientLookup = { id: string; first_name: string | null; last_name: string | null; email: string | null };

export const intakeApiClient = {
  lookupPatient: (email: string) =>
    intakeApi<{ patient: PatientLookup | null }>("lookup_patient", { email }),
  lookupPatientByPhone: (phoneKey: string) =>
    intakeApi<{ candidates: { id: string; phone: string | null }[] }>("lookup_patient_by_phone", { phone_key: phoneKey }),
  createPatient: (data: Record<string, unknown>) =>
    intakeApi<{ id: string }>("create_patient", { data }),
  getPatient: (id: string | null) =>
    intakeApi<{ patient: any }>("get_patient", { id }),
  getPatientContact: (id: string | null) =>
    intakeApi<{ patient: any }>("get_patient_contact", { id }),
  updatePatient: (id: string | null, data: Record<string, unknown>) =>
    intakeApi<{ ok: true }>("update_patient", { id, data }),
  createSubmission: (data: Record<string, unknown>) =>
    intakeApi<{ id: string }>("create_submission", { data }),
  updateSubmission: (id: string | null, data: Record<string, unknown>) =>
    intakeApi<{ ok: true }>("update_submission", { id, data }),
  getRecord: (table: string, filter: { patient_id?: string; submission_id?: string }) =>
    intakeApi<{ record: any }>("get_record", { table, ...filter }),
  getRecords: (table: string, patientId: string) =>
    intakeApi<{ records: any[] }>("get_records", { table, patient_id: patientId }),
  upsertRecord: (table: string, data: Record<string, unknown>, id?: string | null) =>
    intakeApi<{ ok: true }>("upsert_record", { table, data, ...(id ? { id } : {}) }),
  upsertConsultationData: (data: Record<string, unknown>) =>
    intakeApi<{ ok: true }>("upsert_consultation_data", { data }),
};
