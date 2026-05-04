/**
 * Retell AI integration helpers.
 * All calls to Retell use the service-role context (server-side only).
 */

export const RETELL_API_BASE = "https://api.retellai.com";
export const RETELL_API_KEY = process.env.RETELL_API_KEY ?? "";
export const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID ?? "";
export const RETELL_FROM_NUMBER = process.env.RETELL_FROM_NUMBER ?? "";

export type RetellCallPayload = {
  from_number: string;
  to_number: string;
  agent_id: string;
  retell_llm_dynamic_variables: {
    user_name: string;       // patient first name – used in Valerie's prompt as {{user_name}}
    service_name: string;    // deal service – used in Valerie's prompt as {{service_name}}
  };
  metadata?: Record<string, string>;
};

export type RetellCallResponse = {
  call_id: string;
  call_status: string;
  [key: string]: unknown;
};

/**
 * Create an outbound phone call via Retell AI.
 * Returns the Retell call_id on success.
 */
export async function createRetellCall(
  payload: RetellCallPayload,
): Promise<RetellCallResponse> {
  const res = await fetch(`${RETELL_API_BASE}/v2/create-phone-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Retell API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<RetellCallResponse>;
}

/**
 * Normalize a Swiss/international phone number to E.164.
 * Strips all non-digit characters, then prepends + if missing.
 * Swiss local numbers starting with 0 become +41.
 */
export function normalizePhone(raw: string): string {
  // Remove all whitespace, dashes, dots, parens
  let digits = raw.replace(/[\s\-().]/g, "");

  if (digits.startsWith("+")) {
    return digits; // already E.164
  }

  // Swiss local format: 07x, 06x, 03x, 02x, 04x — starts with 0
  if (digits.startsWith("00")) {
    return `+${digits.slice(2)}`; // 0041... → +41...
  }

  if (digits.startsWith("0")) {
    return `+41${digits.slice(1)}`; // 079... → +41 79...
  }

  return `+${digits}`;
}
