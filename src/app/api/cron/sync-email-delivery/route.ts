import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
// A campaign day produces thousands of delivery events, and paging them out of
// Mailgun is the slow part (~2s per 300). 60s was not enough headroom.
export const maxDuration = 300;

/**
 * Reconcile what Mailgun actually did with our outbound email.
 *
 * Mailgun accepts a message with 2xx and only *then* discovers it cannot be
 * delivered — a suppressed address is accepted and failed in the same second.
 * So the synchronous send path can never know, and the truth exists only in
 * Mailgun's event log. Without this job an appointment confirmation to a
 * hard-bounced address is recorded as 'sent' and the patient simply never
 * hears from the clinic.
 *
 * Polling the events API rather than consuming a Mailgun delivery webhook is
 * deliberate: it needs no configuration in the Mailgun dashboard, works with
 * the API key the app already has, and can be re-run over any past window to
 * backfill. Re-running is safe — every write is idempotent.
 *
 * GET /api/cron/sync-email-delivery?hours=6
 */

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl = process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

const MAX_PAGES = 40;
const PAGE_SIZE = 300;
/** Stop paging with time to spare so the run always gets to write its results. */
const DEADLINE_MS = 240_000;
/**
 * Default lookback. The cron runs every 15 minutes, so two hours gives eight
 * overlapping passes over every event — ample tolerance for Mailgun indexing
 * lag or a skipped run, without re-reading a whole day each time.
 */
const DEFAULT_HOURS = 2;

type MailgunEvent = {
  event?: string;
  timestamp?: number;
  recipient?: string;
  severity?: string;
  reason?: string;
  "delivery-status"?: { message?: string; description?: string };
  "user-variables"?: Record<string, string>;
};

function reasonOf(event: MailgunEvent): string {
  const status = event["delivery-status"];
  return (
    status?.message ||
    status?.description ||
    event.reason ||
    "Delivery failed (no reason given)"
  ).slice(0, 400);
}

async function fetchEvents(
  kind: "failed" | "delivered",
  sinceUnix: number,
  deadline: number,
): Promise<{ events: MailgunEvent[]; truncated: boolean }> {
  const auth = "Basic " + Buffer.from(`api:${mailgunApiKey}`).toString("base64");
  let url: string | undefined =
    `${mailgunApiBaseUrl}/v3/${mailgunDomain}/events` +
    `?event=${kind}&limit=${PAGE_SIZE}&begin=${sinceUnix}&ascending=yes`;
  const all: MailgunEvent[] = [];

  for (let page = 0; page < MAX_PAGES && url; page++) {
    if (Date.now() > deadline) return { events: all, truncated: true };
    const response = await fetch(url, { headers: { Authorization: auth } });
    if (!response.ok) {
      throw new Error(`Mailgun events ${kind}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    const body = (await response.json()) as { items?: MailgunEvent[]; paging?: { next?: string } };
    const items = body.items ?? [];
    all.push(...items);
    if (items.length < PAGE_SIZE) return { events: all, truncated: false };
    url = body.paging?.next;
  }
  return { events: all, truncated: !!url };
}

/**
 * True when the failure is only that migrations/20260930_email_delivery_truth.sql
 * has not been applied yet. Deploying ahead of the migration must not break the
 * job, so callers fall back to whatever columns already exist.
 */
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return !!error && (error.code === "PGRST204" || error.code === "42703");
}

function eventTime(event: MailgunEvent): string {
  return new Date((event.timestamp ?? Date.now() / 1000) * 1000).toISOString();
}

/** Keep each `in (...)` filter short enough for a URL-encoded PostgREST query. */
const CHUNK = 150;

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!mailgunApiKey || !mailgunDomain) {
    return NextResponse.json({ error: "Mailgun is not configured" }, { status: 500 });
  }

  const hours = Math.max(
    1,
    Math.min(Number(new URL(request.url).searchParams.get("hours")) || DEFAULT_HOURS, 24 * 30),
  );
  const sinceUnix = Math.floor((Date.now() - hours * 3600 * 1000) / 1000);
  const deadline = Date.now() + DEADLINE_MS;

  try {
    const [failedPage, deliveredPage] = await Promise.all([
      fetchEvents("failed", sinceUnix, deadline),
      fetchEvents("delivered", sinceUnix, deadline),
    ]);
    const failed = failedPage.events;
    const delivered = deliveredPage.events;
    // A truncated *delivered* list could make a recovered address look broken,
    // so flagging is skipped rather than risk marking a reachable patient.
    const deliveredIncomplete = deliveredPage.truncated;

    // ---- 1. Mark the individual email rows that failed -------------------
    // Grouped by our own email-id custom variable, which both send paths set.
    const failureByEmailId = new Map<string, MailgunEvent>();
    for (const event of failed) {
      const emailId = event["user-variables"]?.["email-id"];
      if (emailId) failureByEmailId.set(emailId, event);
    }

    // Batched by reason rather than one statement per row. A single campaign
    // can produce thousands of events, and a query per event overran the
    // function timeout long before it finished. `failed_at` is therefore the
    // latest event time within its batch, which is precise enough for an
    // informational column.
    const failureGroups = new Map<string, { emailIds: string[]; at: string }>();
    for (const [emailId, event] of failureByEmailId) {
      const reason = reasonOf(event);
      const group = failureGroups.get(reason) ?? { emailIds: [], at: eventTime(event) };
      group.emailIds.push(emailId);
      if (eventTime(event) > group.at) group.at = eventTime(event);
      failureGroups.set(reason, group);
    }

    let emailsMarkedFailed = 0;
    let emailColumnsMissing = false;
    for (const [reason, group] of failureGroups) {
      for (const chunk of chunked(group.emailIds, CHUNK)) {
        // 'read' means the tracking pixel fired, which is stronger evidence of
        // delivery than a failure event for a later retry of the same message.
        // Rows already 'failed' are excluded so re-runs report honestly.
        const { data: changed, error: updateError } = await supabaseAdmin
          .from("emails")
          .update({ status: "failed", error: reason, failed_at: group.at })
          .in("id", chunk)
          .neq("status", "read")
          .neq("status", "failed")
          .select("id");

        if (isMissingColumn(updateError)) {
          emailColumnsMissing = true;
          const { data: fallbackChanged } = await supabaseAdmin
            .from("emails")
            .update({ status: "failed" })
            .in("id", chunk)
            .neq("status", "read")
            .neq("status", "failed")
            .select("id");
          emailsMarkedFailed += fallbackChanged?.length ?? 0;
        } else if (updateError) {
          console.error("[cron/sync-email-delivery] emails update failed", updateError);
        } else {
          emailsMarkedFailed += changed?.length ?? 0;
        }
      }
    }

    // ---- 2. Flag patients the provider permanently refuses ---------------
    // Matched on the address rather than a patient-id variable, because one
    // address can sit on several patient records and every one of them is
    // equally unreachable. Marketing bounces count: that is precisely how
    // these patients get cut off from their appointment email.
    const permanentByAddress = new Map<string, MailgunEvent>();
    for (const event of failed) {
      const address = event.recipient?.trim().toLowerCase();
      if (!address) continue;
      if (event.severity !== "permanent") continue;
      permanentByAddress.set(address, event);
    }
    // An address that has since accepted mail is no longer broken.
    for (const event of delivered) {
      const address = event.recipient?.trim().toLowerCase();
      if (address) permanentByAddress.delete(address);
    }
    // Without the full delivered list we cannot prove an address is still
    // broken, and wrongly telling staff a reachable patient is unreachable
    // would cost real phone calls. Flagging waits for the next run.
    if (deliveredIncomplete) permanentByAddress.clear();

    // Resolve addresses to patient ids in bulk. `in (...)` would be
    // case-sensitive and silently miss a patient stored as "Name@Example.com",
    // so this uses ilike alternatives — in small chunks, because they all go
    // into one URL. An email address cannot contain a comma or parenthesis, so
    // the or() list needs no escaping.
    const addressToPatientIds = new Map<string, string[]>();
    let patientColumnsMissing = false;
    for (const chunk of chunked([...permanentByAddress.keys()], 50)) {
      const { data, error: lookupError } = await supabaseAdmin
        .from("patients")
        .select("id, email")
        .or(chunk.map(address => `email.ilike.${address}`).join(","));
      if (lookupError) {
        console.error("[cron/sync-email-delivery] patient lookup failed", lookupError);
        continue;
      }
      for (const row of data ?? []) {
        const key = (row.email as string | null)?.trim().toLowerCase();
        if (!key) continue;
        addressToPatientIds.set(key, [...(addressToPatientIds.get(key) ?? []), row.id as string]);
      }
    }

    // Grouped by reason so the whole run is a handful of statements.
    const flagGroups = new Map<string, { ids: string[]; at: string }>();
    for (const [address, event] of permanentByAddress) {
      const ids = addressToPatientIds.get(address);
      if (!ids?.length) continue; // not one of our patients (e.g. a staff address)
      const reason = reasonOf(event);
      const group = flagGroups.get(reason) ?? { ids: [], at: eventTime(event) };
      group.ids.push(...ids);
      if (eventTime(event) > group.at) group.at = eventTime(event);
      flagGroups.set(reason, group);
    }

    let patientsFlagged = 0;
    for (const [reason, group] of flagGroups) {
      for (const chunk of chunked(group.ids, CHUNK)) {
        const { data: flagged, error: flagError } = await supabaseAdmin
          .from("patients")
          .update({
            email_undeliverable: true,
            email_undeliverable_reason: reason,
            email_undeliverable_at: group.at,
          })
          .in("id", chunk)
          .eq("email_undeliverable", false)
          .select("id");

        if (isMissingColumn(flagError)) {
          patientColumnsMissing = true;
        } else if (flagError) {
          console.error("[cron/sync-email-delivery] patient flag failed", flagError);
        } else {
          patientsFlagged += flagged?.length ?? 0;
        }
      }
    }

    // ---- 3. Clear the flag for addresses that now deliver ----------------
    // Driven from the (small) set of currently-flagged patients rather than the
    // (large) set of delivered addresses, so this costs two queries whether ten
    // or ten thousand messages were delivered.
    const recovered = new Set(
      delivered.map(e => e.recipient?.trim().toLowerCase()).filter((a): a is string => !!a),
    );
    let patientsCleared = 0;
    const { data: currentlyFlagged, error: flaggedError } = await supabaseAdmin
      .from("patients")
      .select("id, email")
      .eq("email_undeliverable", true)
      .limit(20000);

    if (isMissingColumn(flaggedError)) {
      patientColumnsMissing = true;
    } else if (flaggedError) {
      console.error("[cron/sync-email-delivery] flagged lookup failed", flaggedError);
    } else {
      const recoveredIds = (currentlyFlagged ?? [])
        .filter(row => {
          const address = (row.email as string | null)?.trim().toLowerCase();
          return !!address && recovered.has(address);
        })
        .map(row => row.id as string);

      for (const chunk of chunked(recoveredIds, CHUNK)) {
        const { data: clearedRows, error: clearError } = await supabaseAdmin
          .from("patients")
          .update({ email_undeliverable: false, email_undeliverable_reason: null, email_undeliverable_at: null })
          .in("id", chunk)
          .select("id");
        if (clearError) {
          console.error("[cron/sync-email-delivery] patient clear failed", clearError);
        } else {
          patientsCleared += clearedRows?.length ?? 0;
        }
      }
    }

    const summary = {
      ok: true,
      windowHours: hours,
      failedEvents: failed.length,
      deliveredEvents: delivered.length,
      emailsMarkedFailed,
      permanentlyUndeliverableAddresses: permanentByAddress.size,
      patientsFlagged,
      patientsCleared,
      ...(failedPage.truncated || deliveredIncomplete
        ? {
            truncated: true,
            note: "Event list was cut short by the time budget; flagging was skipped this run. Narrow --hours or let the next run continue.",
          }
        : {}),
      ...(emailColumnsMissing || patientColumnsMissing
        ? { warning: "Run migrations/20260930_email_delivery_truth.sql — some columns are missing, so reasons and patient flags were skipped." }
        : {}),
    };
    console.log("[cron/sync-email-delivery]", summary);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery sync failed";
    console.error("[cron/sync-email-delivery]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = GET;
