/**
 * Helpers for turning raw Retell call data into a clean, readable call log.
 *
 * Retell gives us either a structured `transcript_object` (array of
 * { role, content }) or a plain `transcript` string formatted like
 * "Agent: ...\nUser: ...". Both are normalised here into speaker-labelled
 * "turns" so the UI and follow-up tasks can show a real conversation instead
 * of raw code/JSON.
 */

export type CallTurn = {
  role: "agent" | "patient";
  content: string;
};

type RawTurn = { role?: string; content?: string };

// The three reps who share inbound call-back follow-ups (round-robin).
// Resolved by email at runtime so it keeps working if a user id changes.
export const CALL_FOLLOWUP_TEAM_EMAILS = [
  "audrey.cochois@aesthetics-ge.ch",
  "charline@aesthetics-ge.ch",
  "lily@aesthetics-ge.ch",
];

/** Normalise a Retell role to our two speakers. */
function normaliseRole(role: string | undefined): "agent" | "patient" {
  const r = (role || "").toLowerCase();
  if (r === "agent" || r === "assistant" || r === "bot" || r === "ai") return "agent";
  return "patient"; // user / customer / human / unknown
}

/**
 * Build normalised conversation turns from a Retell call object.
 * Prefers the structured transcript_object, falls back to parsing the
 * plain transcript string ("Agent: ...", "User: ...").
 */
export function parseTranscriptTurns(input: {
  transcript_object?: RawTurn[] | null;
  transcript?: string | null;
}): CallTurn[] {
  const obj = input.transcript_object;
  if (Array.isArray(obj) && obj.length > 0) {
    return obj
      .map((t) => ({ role: normaliseRole(t.role), content: (t.content || "").trim() }))
      .filter((t) => t.content.length > 0);
  }

  const text = (input.transcript || "").trim();
  if (!text) return [];

  // Parse lines like "Agent: hello" / "User: hi". Continuation lines (no
  // speaker prefix) are appended to the previous turn.
  const turns: CallTurn[] = [];
  const speakerRe = /^\s*(agent|assistant|ai|bot|user|customer|caller|patient|human)\s*:\s*(.*)$/i;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(speakerRe);
    if (m) {
      turns.push({ role: normaliseRole(m[1]), content: m[2].trim() });
    } else if (turns.length > 0) {
      turns[turns.length - 1].content += ` ${line}`;
    } else {
      turns.push({ role: "patient", content: line });
    }
  }
  return turns.filter((t) => t.content.length > 0);
}

/** Render turns as a readable conversation (no JSON/code). */
export function formatTranscriptReadable(turns: CallTurn[]): string {
  return turns
    .map((t) => `${t.role === "agent" ? "Agent" : "Patient"}: ${t.content}`)
    .join("\n");
}

/** Format a duration in seconds as "Xm Ys". */
export function formatCallDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Build the readable description placed on the follow-up task so the rep sees
 * the whole conversation as a call log, not code.
 */
export function buildCallTaskContent(opts: {
  patientName: string;
  direction?: string | null;
  when: Date;
  durationSeconds?: number | null;
  callStatus?: string | null;
  serviceInterest?: string | null;
  summary?: string | null;
  turns: CallTurn[];
}): string {
  const lines: string[] = [];
  const dirLabel =
    opts.direction === "outbound" ? "Outbound call" : opts.direction === "web" ? "Web call" : "Inbound call";
  lines.push(`Please call ${opts.patientName} back.`);
  lines.push("");
  lines.push(`${dirLabel} — ${opts.when.toLocaleString("fr-CH")}`);
  if (opts.callStatus) lines.push(`Status: ${opts.callStatus}`);
  lines.push(`Duration: ${formatCallDuration(opts.durationSeconds)}`);
  if (opts.serviceInterest) lines.push(`Service interest: ${opts.serviceInterest}`);

  if (opts.summary && opts.summary.trim()) {
    lines.push("", "── Summary ──", opts.summary.trim());
  }

  const transcript = formatTranscriptReadable(opts.turns);
  if (transcript) {
    lines.push("", "── Conversation ──", transcript);
  }

  return lines.join("\n");
}
