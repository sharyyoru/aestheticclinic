import { normalizePhone } from "@/lib/retell";

type RetellCall = {
  call_type?: string;
  from_number?: string;
  to_number?: string;
  direction?: "inbound" | "outbound" | string;
  call_id?: string;
  agent_id?: string;
  call_status?: string;
  metadata?: Record<string, unknown>;
  retell_llm_dynamic_variables?: Record<string, unknown>;
  start_timestamp?: number;
  end_timestamp?: number;
  disconnection_reason?: string;
  transcript?: string;
  transcript_object?: Array<{
    role: string;
    content: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, unknown>;
    [key: string]: unknown;
  };
  opt_out_sensitive_data_storage?: boolean;
};

type CustomerInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  serviceInterest: string;
  location: string;
};

export type HubspotService = {
  id: string;
  name: string;
};

/**
 * Extract customer info from transcript or dynamic variables.
 */
export function extractCustomerInfo(call: RetellCall): CustomerInfo {
  const vars = call.retell_llm_dynamic_variables || {};
  const metadata = call.metadata || {};
  const analysis = (call.call_analysis?.custom_analysis_data || {}) as Record<string, unknown>;

  // Try to parse lead_info JSON if present (single-field extraction)
  let parsedLeadInfo: Record<string, string> = {};
  if (analysis.lead_info) {
    try {
      parsedLeadInfo =
        typeof analysis.lead_info === "string"
          ? JSON.parse(analysis.lead_info)
          : (analysis.lead_info as Record<string, string>);
    } catch {
      /* ignore parse errors */
    }
  }

  // Try to get name from various sources
  let firstName =
    (vars.first_name as string) ||
    (analysis.first_name as string) ||
    parsedLeadInfo.first_name ||
    "";
  let lastName =
    (vars.last_name as string) ||
    (analysis.last_name as string) ||
    parsedLeadInfo.last_name ||
    "";

  // If we have customer_name but not first/last, split it
  if (!firstName && vars.customer_name) {
    const nameParts = (vars.customer_name as string).trim().split(/\s+/);
    firstName = nameParts[0] || "";
    lastName = nameParts.slice(1).join(" ") || "";
  }

  // Check metadata as fallback
  if (!firstName && metadata.first_name) {
    firstName = metadata.first_name as string;
  }
  if (!lastName && metadata.last_name) {
    lastName = metadata.last_name as string;
  }

  // Phone from caller ID or variables or analysis. The patient's own number is
  // the OTHER party: for inbound that's from_number, for outbound it's
  // to_number (from_number is then the clinic's caller-ID).
  const recipientNumber =
    call.direction === "outbound" ? call.to_number : call.from_number;
  const rawPhone =
    (vars.phone as string) ||
    (vars.customer_phone as string) ||
    (analysis.phone as string) ||
    parsedLeadInfo.phone ||
    recipientNumber ||
    "";
  // Skip Retell placeholder numbers (web calls have no real caller ID)
  let phone = rawPhone && !rawPhone.startsWith("+1000") ? normalizePhone(rawPhone) : "";

  // Email from variables, metadata, or analysis
  let email =
    (vars.email as string) ||
    (metadata.email as string) ||
    (analysis.email as string) ||
    parsedLeadInfo.email ||
    "";

  // Service interest
  let serviceInterest =
    (vars.service_interest as string) ||
    (metadata.service_interest as string) ||
    (analysis.service_interest as string) ||
    parsedLeadInfo.service_interest ||
    "";

  // Location
  let location =
    (vars.location as string) ||
    (analysis.location as string) ||
    parsedLeadInfo.location ||
    "";

  return { firstName, lastName, phone, email, serviceInterest, location };
}

const SERVICE_KEYWORDS: { keywords: string[]; serviceNames: string[] }[] = [
  { keywords: ["breast", "augment", "implant", "mammoplasty"], serviceNames: ["breast augmentation", "breast"] },
  { keywords: ["face", "filler", "facial filler"], serviceNames: ["face filler", "facial filler", "filler"] },
  { keywords: ["wrinkle", "ride", "rides", "anti-age", "antiage"], serviceNames: ["wrinkle", "anti-aging", "rides"] },
  { keywords: ["blepharo", "eyelid", "paupière"], serviceNames: ["blepharoplasty", "eyelid"] },
  { keywords: ["lipo", "liposuc"], serviceNames: ["liposuction", "lipo"] },
  { keywords: ["iv", "therapy", "infusion", "drip"], serviceNames: ["iv therapy", "infusion"] },
  { keywords: ["rhino", "nose", "nez"], serviceNames: ["rhinoplasty", "nose"] },
  { keywords: ["facelift", "lifting", "face lift"], serviceNames: ["facelift", "face lift"] },
  { keywords: ["botox", "toxin"], serviceNames: ["botox", "botulinum"] },
  { keywords: ["lip", "lèvre"], serviceNames: ["lip filler", "lip"] },
  { keywords: ["tummy", "tuck", "abdominoplast"], serviceNames: ["tummy tuck", "abdominoplasty"] },
  { keywords: ["breast", "lift", "mastopexy"], serviceNames: ["breast lift", "mastopexy"] },
  { keywords: ["hyperbaric", "oxygen", "hbot"], serviceNames: ["hyperbaric", "hbot", "oxygen"] },
  { keywords: ["consultation", "consult", "rendez-vous"], serviceNames: ["consultation", "consult"] },
];

/**
 * Match a service interest string to the closest service in the catalog.
 */
export function matchServiceToHubspot(
  serviceInterest: string,
  hubspotServices: HubspotService[]
): HubspotService | null {
  if (!serviceInterest || hubspotServices.length === 0) return null;

  const normalizedInterest = serviceInterest.toLowerCase().trim();

  // Direct match first
  const directMatch = hubspotServices.find(
    (s) => s.name.toLowerCase() === normalizedInterest
  );
  if (directMatch) return directMatch;

  // Try keyword matching
  for (const { keywords, serviceNames } of SERVICE_KEYWORDS) {
    const hasKeyword = keywords.some((k) => normalizedInterest.includes(k));
    if (hasKeyword) {
      for (const serviceName of serviceNames) {
        const match = hubspotServices.find((s) =>
          s.name.toLowerCase().includes(serviceName)
        );
        if (match) return match;
      }
    }
  }

  // Partial match
  const interestWords = normalizedInterest.split(/\s+/).filter((w) => w.length > 3);
  for (const word of interestWords) {
    const partialMatch = hubspotServices.find((s) =>
      s.name.toLowerCase().includes(word)
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}
