export type MediDataResponseType = "accepted" | "rejected" | "pending";

export type ParsedMediDataResponse = {
  type: MediDataResponseType;
  statusIn: string;
  statusOut: string;
  explanation: string;
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

  return {
    type,
    statusIn,
    statusOut,
    explanation: readElementText(blockXml, "explanation") || readAttribute(responseTag, "explanation"),
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
