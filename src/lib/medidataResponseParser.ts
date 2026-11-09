export type MediDataResponseType = "accepted" | "rejected" | "pending";

export type MediDataResponseError = {
  /** Insurer reject code, e.g. "000125", "406", "59109", "eK6.2.1". */
  code: string;
  /** Human-readable reason exactly as the insurer sent it. */
  text: string | null;
  /** Service-line reference, when the error is line-specific. */
  recordId: string | null;
};

export type ParsedMediDataResponse = {
  type: MediDataResponseType;
  statusIn: string;
  statusOut: string;
  explanation: string;
  /**
   * Every `<error>` element in the response, in document order.
   *
   * These were present in the stored XML all along but never parsed, which is
   * why rejected invoices sat "waiting to be corrected" with no visible
   * reason: the poller recorded `status_out`, which is the literal string
   * "unknown" in most insurer payloads.
   */
  errors: MediDataResponseError[];
  /**
   * The insurer's `allowModification` flag. Insurers overwhelmingly answer
   * false, i.e. they refuse in-place amendment — which is why correcting an
   * invoice they already hold requires a Storno rather than a resend.
   */
  allowModification: boolean | null;
};

function findOpeningTag(xml: string, tagName: string): string | null {
  const match = xml.match(new RegExp(`<[^>]*:?${tagName}\\b[^>]*>`, "i"));
  return match?.[0] ?? null;
}

function readAttribute(tag: string | null, name: string): string {
  if (!tag) return "";
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? "";
}

function readElementText(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<[^>]*:?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tagName}>`, "i"));
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
}

/** Decode the XML entities that appear in insurer message text. */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // Ampersand last, so "&amp;lt;" does not become "<".
    .replace(/&amp;/g, "&");
}

/**
 * Extract every `<error .../>` element, namespace-agnostically (insurers vary
 * between `invoice:error` and a bare `error`).
 */
export function parseResponseErrors(xml: string): MediDataResponseError[] {
  const errors: MediDataResponseError[] = [];
  if (!xml) return errors;

  for (const match of xml.matchAll(/<[\w.-]*:?error\b([^>]*?)\/?>/gi)) {
    const fragment = match[1] ?? "";
    const attrs: Record<string, string> = {};
    for (const a of fragment.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*["']([^"']*)["']/g)) {
      attrs[a[1].toLowerCase()] = a[2];
    }
    const code = (attrs.code ?? "").trim();
    if (!code) continue; // nothing actionable without a code
    errors.push({
      code,
      text: attrs.text ? decodeXmlEntities(attrs.text).trim() || null : null,
      recordId: attrs.record_id ? attrs.record_id.trim() : null,
    });
  }
  return errors;
}

/**
 * The single code that best represents the rejection. An invoice-level error
 * (no `record_id`) is preferred over line-level ones, because that is the one
 * that determines whether a Storno is required.
 */
export function primaryErrorCode(errors: MediDataResponseError[]): string | null {
  if (!errors.length) return null;
  const invoiceLevel = errors.find((e) => !e.recordId);
  return (invoiceLevel ?? errors[0]).code;
}

/** One-line, human-readable summary of the insurer's reasons. */
export function describeResponseErrors(errors: MediDataResponseError[]): string {
  return errors
    .map((e) => [e.code, e.text].filter(Boolean).join(" — ") + (e.recordId ? ` (line ${e.recordId})` : ""))
    .join(" | ");
}

export function parseResponseXml(xml: string): ParsedMediDataResponse {
  const acceptedTag = findOpeningTag(xml, "accepted");
  const rejectedTag = findOpeningTag(xml, "rejected");
  const pendingTag = findOpeningTag(xml, "pending");
  const responseTag = acceptedTag || rejectedTag || pendingTag;
  const type: MediDataResponseType = acceptedTag
    ? "accepted"
    : rejectedTag
      ? "rejected"
      : "pending";

  const statusIn = readAttribute(responseTag, "status_in");
  const statusOut = readAttribute(responseTag, "status_out");
  const block = type === "accepted"
    ? acceptedTag
    : type === "rejected"
      ? rejectedTag
      : pendingTag;
  const blockStart = block ? xml.indexOf(block) : -1;
  const blockXml = blockStart >= 0 ? xml.slice(blockStart) : xml;

  const errors = parseResponseErrors(xml);
  let explanation =
    readElementText(blockXml, "explanation") || readAttribute(responseTag, "explanation");

  // Most insurers send no <explanation> at all and put the reason in the
  // error elements. Without this fallback the invoice shows no reason.
  if (!explanation && errors.length) explanation = describeResponseErrors(errors);

  const allowMatch = xml.match(/allowModification\s*=\s*["']([^"']*)["']/i);

  return {
    type,
    statusIn,
    statusOut,
    explanation,
    errors,
    allowModification: allowMatch ? allowMatch[1] === "true" : null,
  };
}

export type MediDataSubmissionStatus =
  | "draft"
  | "pending"
  | "transmitted"
  | "delivered"
  | "accepted"
  | "rejected"
  | "cancelled";

export function mapUploadStatusToSubmissionStatus(
  status: unknown,
  currentStatus: string,
  created?: string | null,
): MediDataSubmissionStatus {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "DONE") return "transmitted";
  if (normalized === "DELIVERED") return "delivered";
  if (normalized === "ERROR") return "rejected";

  // TG invoices do not travel to an insurer. Once MediData has kept them in
  // PROCESSING for a while, treat them as transmitted rather than polling
  // them forever.
  if (normalized === "PROCESSING" && currentStatus === "pending" && created) {
    const createdAt = new Date(created).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt > 60_000) {
      return "transmitted";
    }
  }

  return (currentStatus as MediDataSubmissionStatus) || "pending";
}
