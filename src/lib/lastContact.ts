/**
 * Shared utility to compute "who last contacted a lead/patient, and when"
 * by aggregating across the scattered contact-touchpoint tables:
 * patient_notes, tasks (completed call/email), call_logs, emails, whatsapp_queue.
 *
 * Batches lookups using chunked `.in()` queries to stay safe with PostgREST
 * URL length limits on large patient id lists.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactChannel = "note" | "email" | "task" | "call" | "whatsapp";

export type ContactDirection = "inbound" | "outbound" | null;

export interface LastContact {
  patientId: string;
  timestamp: string;
  channel: ContactChannel;
  direction: ContactDirection;
  actorName: string;
}

const IN_FILTER_CHUNK_SIZE = 200;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchChunked<T>(
  ids: string[],
  fn: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks = chunkArray(ids, IN_FILTER_CHUNK_SIZE);
  const results = await Promise.all(chunks.map(fn));
  return results.flat();
}

type RawEvent = {
  patientId: string;
  timestamp: string | null;
  channel: ContactChannel;
  direction: ContactDirection;
  actorId: string | null;
  actorName: string | null;
};

/**
 * Compute the most recent contact touchpoint for each given patient id.
 * Returns a Map keyed by patient_id for O(1) lookup.
 */
export async function getLastContactByPatientIds(
  supabase: SupabaseClient,
  patientIds: string[],
): Promise<Map<string, LastContact>> {
  const ids = [...new Set(patientIds)].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return new Map();

  const [notesRows, tasksRows, callRows, emailRows, waRows] = await Promise.all([
    fetchChunked(ids, async (chunk) => {
      const { data } = await supabase
        .from("patient_notes")
        .select("patient_id, author_name, created_at")
        .in("patient_id", chunk);
      return (data ?? []) as Array<{
        patient_id: string;
        author_name: string | null;
        created_at: string;
      }>;
    }),
    fetchChunked(ids, async (chunk) => {
      const { data } = await supabase
        .from("tasks")
        .select("patient_id, assigned_user_name, created_by_name, activity_date, created_at")
        .in("patient_id", chunk)
        .eq("status", "completed")
        .in("type", ["call", "email"]);
      return (data ?? []) as Array<{
        patient_id: string;
        assigned_user_name: string | null;
        created_by_name: string | null;
        activity_date: string | null;
        created_at: string;
      }>;
    }),
    fetchChunked(ids, async (chunk) => {
      const { data } = await supabase
        .from("call_logs")
        .select("patient_id, assigned_user_name, direction, started_at, created_at")
        .in("patient_id", chunk);
      return (data ?? []) as Array<{
        patient_id: string;
        assigned_user_name: string | null;
        direction: string | null;
        started_at: string | null;
        created_at: string;
      }>;
    }),
    fetchChunked(ids, async (chunk) => {
      const { data } = await supabase
        .from("emails")
        .select("patient_id, sent_by_user_id, direction, sent_at, created_at")
        .in("patient_id", chunk);
      return (data ?? []) as Array<{
        patient_id: string;
        sent_by_user_id: string | null;
        direction: string | null;
        sent_at: string | null;
        created_at: string;
      }>;
    }),
    fetchChunked(ids, async (chunk) => {
      const { data } = await supabase
        .from("whatsapp_queue")
        .select("patient_id, sender_user_id, status, sent_at, created_at")
        .in("patient_id", chunk)
        .eq("status", "sent");
      return (data ?? []) as Array<{
        patient_id: string;
        sender_user_id: string | null;
        sent_at: string | null;
        created_at: string;
      }>;
    }),
  ]);

  const events: RawEvent[] = [];

  for (const row of notesRows) {
    if (!row.patient_id || !row.created_at) continue;
    events.push({
      patientId: row.patient_id,
      timestamp: row.created_at,
      channel: "note",
      direction: null,
      actorId: null,
      actorName: row.author_name || "Unknown",
    });
  }

  for (const row of tasksRows) {
    if (!row.patient_id) continue;
    const ts = row.activity_date ?? row.created_at;
    if (!ts) continue;
    events.push({
      patientId: row.patient_id,
      timestamp: ts,
      channel: "task",
      direction: "outbound",
      actorId: null,
      actorName: row.assigned_user_name || row.created_by_name || "Unknown",
    });
  }

  for (const row of callRows) {
    if (!row.patient_id) continue;
    const ts = row.started_at ?? row.created_at;
    if (!ts) continue;
    const direction: ContactDirection = row.direction === "inbound" ? "inbound" : "outbound";
    events.push({
      patientId: row.patient_id,
      timestamp: ts,
      channel: "call",
      direction,
      actorId: null,
      actorName: row.assigned_user_name || "Aliice (AI)",
    });
  }

  // Batch-resolve staff names for emails/whatsapp, which only store a raw user id.
  const actorIds = new Set<string>();
  for (const row of emailRows) if (row.sent_by_user_id) actorIds.add(row.sent_by_user_id);
  for (const row of waRows) if (row.sender_user_id) actorIds.add(row.sender_user_id);

  let profileNameById = new Map<string, string>();
  if (actorIds.size > 0) {
    const profileRows = await fetchChunked([...actorIds], async (chunk) => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", chunk);
      return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>;
    });
    profileNameById = new Map(
      profileRows.map((p) => [p.id, p.full_name || p.email || "Unknown"]),
    );
  }

  for (const row of emailRows) {
    if (!row.patient_id) continue;
    const ts = row.sent_at ?? row.created_at;
    if (!ts) continue;
    const direction: ContactDirection = row.direction === "inbound" ? "inbound" : "outbound";
    const actorName =
      direction === "inbound"
        ? "Patient"
        : (row.sent_by_user_id && profileNameById.get(row.sent_by_user_id)) || "Unknown";
    events.push({
      patientId: row.patient_id,
      timestamp: ts,
      channel: "email",
      direction,
      actorId: row.sent_by_user_id ?? null,
      actorName,
    });
  }

  for (const row of waRows) {
    if (!row.patient_id) continue;
    const ts = row.sent_at ?? row.created_at;
    if (!ts) continue;
    const actorName =
      (row.sender_user_id && profileNameById.get(row.sender_user_id)) || "Unknown";
    events.push({
      patientId: row.patient_id,
      timestamp: ts,
      channel: "whatsapp",
      direction: "outbound",
      actorId: row.sender_user_id ?? null,
      actorName,
    });
  }

  const lastByPatient = new Map<string, LastContact>();
  for (const ev of events) {
    if (!ev.timestamp) continue;
    const t = new Date(ev.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    const existing = lastByPatient.get(ev.patientId);
    if (!existing || new Date(existing.timestamp).getTime() < t) {
      lastByPatient.set(ev.patientId, {
        patientId: ev.patientId,
        timestamp: ev.timestamp,
        channel: ev.channel,
        direction: ev.direction,
        actorName: ev.actorName || "Unknown",
      });
    }
  }

  return lastByPatient;
}

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  note: "Note",
  email: "Email",
  task: "Task",
  call: "Call",
  whatsapp: "WhatsApp",
};

export function contactChannelLabel(channel: ContactChannel): string {
  return CHANNEL_LABELS[channel];
}

/** Days between now and the given ISO timestamp (fractional). */
export function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

/** Compact "time ago" label, e.g. "3h ago", "2d ago", "just now". */
export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
