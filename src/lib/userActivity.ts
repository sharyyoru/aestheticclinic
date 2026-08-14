import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type UserActivityRow = {
  id: string;
  type: "stage_change" | "appointment" | "note" | "task" | "email";
  timestamp: string;
  patientId: string | null;
  patientName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  description: string;
};

export type UserActivityResponse = {
  totals: {
    distinctDeals: number;
    distinctPatients: number;
    byType: {
      stage_change: number;
      appointment: number;
      note: number;
      task: number;
      email: number;
    };
  };
  rows: UserActivityRow[];
};

export function dateRangeToIso(from: string, to: string): { fromIso: string; toIso: string } {
  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
  return { fromIso, toIso };
}

/**
 * Aggregate everything a given staff member did in a date range across the
 * scattered activity tables (deal stage changes, appointment scheduling,
 * notes, tasks, emails) into one unified, sorted activity feed.
 *
 * NOTE: deal-stage-change attribution (`deal_notifications.changed_by_user_id`)
 * was only wired up going forward (see src/app/deals/page.tsx handleDropOnStage
 * and src/app/api/workflows/deal-stage-changed/route.ts) — historical stage
 * changes made before that fix will not appear here.
 */
export async function computeUserActivity(
  userId: string,
  from: string,
  to: string,
): Promise<UserActivityResponse> {
  const { fromIso, toIso } = dateRangeToIso(from, to);

  const [stageChangesRes, appointmentsRes, notesRes, tasksRes, emailsRes] = await Promise.all([
    supabaseAdmin
      .from("deal_notifications")
      .select("id, created_at, deal_id, patient_id, notification_type, old_stage_name, new_stage_name")
      .eq("changed_by_user_id", userId)
      .in("notification_type", ["stage_changed", "deal_created"])
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("appointment_history")
      .select("id, changed_at, change_type, appointment_id, original_patient_id, new_start_time")
      .eq("changed_by_user_id", userId)
      .gte("changed_at", fromIso)
      .lte("changed_at", toIso)
      .order("changed_at", { ascending: false }),
    supabaseAdmin
      .from("patient_notes")
      .select("id, created_at, patient_id, body")
      .eq("author_user_id", userId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("tasks")
      .select("id, created_at, patient_id, name, created_by_user_id, assigned_user_id")
      .or(`created_by_user_id.eq.${userId},assigned_user_id.eq.${userId}`)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("emails")
      .select("id, created_at, sent_at, patient_id, deal_id, subject")
      .eq("sent_by_user_id", userId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false }),
  ]);

  const patientIds = new Set<string>();

  type StageChangeRow = {
    id: string;
    created_at: string;
    deal_id: string;
    patient_id: string;
    notification_type: string;
    old_stage_name: string | null;
    new_stage_name: string | null;
  };
  const stageChanges = (stageChangesRes.data ?? []) as unknown as StageChangeRow[];
  for (const r of stageChanges) {
    if (r.patient_id) patientIds.add(r.patient_id);
  }

  type AppointmentHistoryRow = {
    id: string;
    changed_at: string;
    change_type: string;
    appointment_id: string | null;
    original_patient_id: string | null;
    new_start_time: string | null;
  };
  const appointmentChanges = (appointmentsRes.data ?? []) as unknown as AppointmentHistoryRow[];

  // Rows with a live appointment_id but no denormalized original_patient_id
  // (i.e. not a deletion) need a separate lookup to resolve patient_id.
  const apptIdsNeedingLookup = appointmentChanges
    .filter((r) => !r.original_patient_id && r.appointment_id)
    .map((r) => r.appointment_id as string);
  const apptPatientIdByApptId = new Map<string, string>();
  if (apptIdsNeedingLookup.length > 0) {
    const { data: apptRows } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_id")
      .in("id", apptIdsNeedingLookup);
    for (const a of apptRows ?? []) apptPatientIdByApptId.set(a.id, a.patient_id);
  }
  const resolveApptPatientId = (r: AppointmentHistoryRow): string | null => {
    if (r.original_patient_id) return r.original_patient_id;
    if (r.appointment_id) return apptPatientIdByApptId.get(r.appointment_id) ?? null;
    return null;
  };
  for (const r of appointmentChanges) {
    const pid = resolveApptPatientId(r);
    if (pid) patientIds.add(pid);
  }

  type NoteRow = { id: string; created_at: string; patient_id: string; body: string };
  const notes = (notesRes.data ?? []) as unknown as NoteRow[];
  for (const r of notes) if (r.patient_id) patientIds.add(r.patient_id);

  type TaskRow = {
    id: string;
    created_at: string;
    patient_id: string | null;
    name: string | null;
    created_by_user_id: string | null;
    assigned_user_id: string | null;
  };
  const tasks = (tasksRes.data ?? []) as unknown as TaskRow[];
  for (const r of tasks) if (r.patient_id) patientIds.add(r.patient_id);

  type EmailRow = {
    id: string;
    created_at: string;
    sent_at: string | null;
    patient_id: string | null;
    deal_id: string | null;
    subject: string;
  };
  const emails = (emailsRes.data ?? []) as unknown as EmailRow[];
  for (const r of emails) {
    if (r.patient_id) patientIds.add(r.patient_id);
  }

  // Resolve patient names + deal titles for display, and to backfill deal_id
  // for activity types that only have a patient_id (appointments, notes,
  // tasks) via each patient's most recent deal.
  const patientIdList = [...patientIds];
  const [patientsRes, dealsRes] = await Promise.all([
    patientIdList.length > 0
      ? supabaseAdmin.from("patients").select("id, first_name, last_name").in("id", patientIdList)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
    patientIdList.length > 0
      ? supabaseAdmin
          .from("deals")
          .select("id, title, patient_id")
          .in("patient_id", patientIdList)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; title: string | null; patient_id: string }[] }),
  ]);

  const patientNameById = new Map(
    (patientsRes.data ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed"]),
  );
  const dealByPatientId = new Map<string, { id: string; title: string | null }>();
  for (const d of dealsRes.data ?? []) {
    if (!dealByPatientId.has(d.patient_id)) {
      dealByPatientId.set(d.patient_id, { id: d.id, title: d.title });
    }
  }
  const dealTitleById = new Map<string, string | null>();
  for (const d of dealsRes.data ?? []) dealTitleById.set(d.id, d.title);

  const rows: UserActivityRow[] = [];

  for (const r of stageChanges) {
    const dealTitle = dealTitleById.get(r.deal_id) ?? null;
    const description =
      r.notification_type === "deal_created"
        ? `Deal created in stage "${r.new_stage_name || "Unknown"}"`
        : `Stage changed: ${r.old_stage_name || "Unknown"} → ${r.new_stage_name || "Unknown"}`;
    rows.push({
      id: `sc-${r.id}`,
      type: "stage_change",
      timestamp: r.created_at,
      patientId: r.patient_id,
      patientName: patientNameById.get(r.patient_id) ?? null,
      dealId: r.deal_id,
      dealTitle,
      description,
    });
  }

  for (const r of appointmentChanges) {
    const pid = resolveApptPatientId(r);
    const deal = pid ? dealByPatientId.get(pid) : undefined;
    rows.push({
      id: `ah-${r.id}`,
      type: "appointment",
      timestamp: r.changed_at,
      patientId: pid,
      patientName: pid ? patientNameById.get(pid) ?? null : null,
      dealId: deal?.id ?? null,
      dealTitle: deal?.title ?? null,
      description: `Appointment ${r.change_type}`,
    });
  }

  for (const r of notes) {
    const deal = dealByPatientId.get(r.patient_id);
    rows.push({
      id: `note-${r.id}`,
      type: "note",
      timestamp: r.created_at,
      patientId: r.patient_id,
      patientName: patientNameById.get(r.patient_id) ?? null,
      dealId: deal?.id ?? null,
      dealTitle: deal?.title ?? null,
      description: r.body.length > 140 ? `${r.body.slice(0, 140)}…` : r.body,
    });
  }

  for (const r of tasks) {
    const deal = r.patient_id ? dealByPatientId.get(r.patient_id) : undefined;
    rows.push({
      id: `task-${r.id}`,
      type: "task",
      timestamp: r.created_at,
      patientId: r.patient_id,
      patientName: r.patient_id ? patientNameById.get(r.patient_id) ?? null : null,
      dealId: deal?.id ?? null,
      dealTitle: deal?.title ?? null,
      description: r.name || "Task",
    });
  }

  for (const r of emails) {
    const deal = r.deal_id
      ? { id: r.deal_id, title: dealTitleById.get(r.deal_id) ?? null }
      : r.patient_id
        ? dealByPatientId.get(r.patient_id)
        : undefined;
    rows.push({
      id: `email-${r.id}`,
      type: "email",
      timestamp: r.sent_at || r.created_at,
      patientId: r.patient_id,
      patientName: r.patient_id ? patientNameById.get(r.patient_id) ?? null : null,
      dealId: deal?.id ?? null,
      dealTitle: deal?.title ?? null,
      description: `Email: ${r.subject}`,
    });
  }

  rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const distinctDeals = new Set(rows.map((r) => r.dealId).filter(Boolean)).size;
  const distinctPatients = new Set(rows.map((r) => r.patientId).filter(Boolean)).size;

  return {
    totals: {
      distinctDeals,
      distinctPatients,
      byType: {
        stage_change: stageChanges.length,
        appointment: appointmentChanges.length,
        note: notes.length,
        task: tasks.length,
        email: emails.length,
      },
    },
    rows,
  };
}

export const ACTIVITY_TYPE_LABELS: Record<UserActivityRow["type"], string> = {
  stage_change: "Stage Change",
  appointment: "Appointment",
  note: "Note",
  task: "Task",
  email: "Email",
};
