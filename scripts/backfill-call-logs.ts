/**
 * Backfill historical Retell call transcripts (embedded in patients.notes by the
 * inbound agent webhook) into the new structured call_logs table.
 *
 * Idempotent: dedupes on call_id, so it is safe to run multiple times.
 * Historical calls get NO follow-up task (assigned_user_name stays null).
 *
 * Run: npx tsx scripts/backfill-call-logs.ts          (dry run, prints counts)
 *      npx tsx scripts/backfill-call-logs.ts --write   (actually inserts)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseTranscriptTurns } from "../src/lib/callLog";

for (const l of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const WRITE = process.argv.includes("--write");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type ParsedCall = {
  leadInfo: Record<string, unknown>;
  transcript: string;
};

/** Extract every "[Retell AI Call] {json}\n\nTranscript:\n..." block from notes. */
function parseCallBlocks(notes: string): ParsedCall[] {
  const blocks: ParsedCall[] = [];
  const marker = "[Retell AI Call]";
  let idx = notes.indexOf(marker);
  while (idx !== -1) {
    const braceStart = notes.indexOf("{", idx);
    if (braceStart === -1) break;
    // Balanced-brace scan to find the end of the JSON object.
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < notes.length; i++) {
      const ch = notes[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) break;
    const jsonStr = notes.slice(braceStart, end + 1);
    let leadInfo: Record<string, unknown> = {};
    try { leadInfo = JSON.parse(jsonStr); } catch { /* skip malformed */ }

    // Transcript runs from after this block until the next marker (or end).
    const nextIdx = notes.indexOf(marker, end + 1);
    const tail = notes.slice(end + 1, nextIdx === -1 ? undefined : nextIdx);
    const tIdx = tail.indexOf("Transcript:");
    const transcript = tIdx === -1 ? "" : tail.slice(tIdx + "Transcript:".length).trim();

    if (Object.keys(leadInfo).length > 0 || transcript) {
      blocks.push({ leadInfo, transcript });
    }
    idx = nextIdx;
  }
  return blocks;
}

async function main() {
  // Scan EVERY patient whose notes contain a Retell call block, regardless of
  // source. Outbound campaign calls live on patients sourced from Facebook,
  // intake forms, manual entry, etc. — not just "Retell AI Agent".
  const { data: patients, error } = await supabase
    .from("patients")
    .select("id, notes")
    .ilike("notes", "%[Retell AI Call]%")
    .limit(5000);
  if (error) { console.error("query error:", error.message); process.exit(1); }

  // Existing call_ids to dedupe.
  const { data: existing, error: existingErr } = await supabase.from("call_logs").select("call_id");
  if (existingErr) {
    console.error("\n[!] call_logs query failed — has the migration been applied?\n   ", existingErr.message, "\n");
    process.exit(1);
  }
  console.log(`call_logs already has ${existing?.length || 0} rows`);
  const known = new Set((existing || []).map((r) => r.call_id).filter(Boolean));

  let blocksFound = 0, toInsert = 0, inserted = 0, skippedNoId = 0, skippedDup = 0;
  const rows: Record<string, unknown>[] = [];

  for (const p of patients || []) {
    const blocks = parseCallBlocks((p.notes as string) || "");
    for (const b of blocks) {
      blocksFound++;
      const callId = (b.leadInfo.call_id as string) || null;
      if (!callId) { skippedNoId++; continue; }
      if (known.has(callId)) { skippedDup++; continue; }
      known.add(callId);
      const turns = parseTranscriptTurns({ transcript: b.transcript });
      rows.push({
        call_id: callId,
        patient_id: p.id,
        direction: (b.leadInfo.direction as string) || "inbound",
        agent_id: (b.leadInfo.agent_id as string) || null,
        from_number: (b.leadInfo.from_number as string) || null,
        to_number: (b.leadInfo.to_number as string) || null,
        disconnection_reason: (b.leadInfo.disconnection_reason as string) || null,
        duration_seconds: (b.leadInfo.duration_seconds as number) ?? null,
        transcript: b.transcript || null,
        transcript_turns: turns.length > 0 ? turns : null,
        service_interest: (b.leadInfo.service_interest as string) || null,
        source: "retell_backfill",
        started_at: (b.leadInfo.received_at as string) || null,
      });
      toInsert++;
    }
  }

  console.log(`patients scanned: ${patients?.length || 0}`);
  console.log(`call blocks found: ${blocksFound}`);
  console.log(`skipped (no call_id): ${skippedNoId}`);
  console.log(`skipped (already in call_logs): ${skippedDup}`);
  console.log(`to insert: ${toInsert}`);

  if (!WRITE) {
    console.log("\nDRY RUN — re-run with --write to insert. Sample:");
    console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error: insErr } = await supabase.from("call_logs").insert(chunk);
    if (insErr) console.error(`insert chunk ${i} error:`, insErr.message);
    else inserted += chunk.length;
  }
  console.log(`inserted: ${inserted}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
