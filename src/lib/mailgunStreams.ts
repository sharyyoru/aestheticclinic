/**
 * Mailgun sending streams: transactional vs marketing.
 *
 * A Mailgun suppression list (bounces, complaints, unsubscribes) is scoped to
 * a *domain*, not to a message. While both streams share one domain, a
 * campaign sent to stale addresses hard-bounces, Mailgun permanently
 * suppresses those addresses, and the same patients' appointment
 * confirmations are then refused with
 *   "605 Not delivering to previously bounced address"
 * — silently, because Mailgun still answers the send itself with 2xx.
 *
 * Measured against production on 2026-11-07 over the preceding 30 days:
 * 63 of 199 delivery failures were code 605, and 467 patient records carry
 * email_undeliverable = true.
 *
 * Splitting the streams is the fix. Set MAILGUN_MARKETING_DOMAIN (plus
 * optionally MAILGUN_MARKETING_FROM_EMAIL / _FROM_NAME) and campaigns move to
 * their own domain and their own suppression list, where a bounce can no
 * longer reach a patient's appointment email.
 *
 * Until MAILGUN_MARKETING_DOMAIN is set, both streams resolve to
 * MAILGUN_DOMAIN exactly as before — deploying this on its own changes
 * nothing, which matters because the new domain needs DNS records verified in
 * Mailgun before it can send at all.
 */

export type MailgunStream = {
  /** Sending domain; also selects the suppression list that applies. */
  domain: string | undefined;
  apiKey: string | undefined;
  apiBaseUrl: string;
  fromEmail: string;
  fromName: string;
};

function apiBaseUrl(): string {
  return process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";
}

/**
 * Appointment confirmations, reminders, invoices, OTPs — anything a patient is
 * waiting for. This keeps the established, warmed-up domain.
 */
export function transactionalStream(): MailgunStream {
  return {
    domain: process.env.MAILGUN_DOMAIN,
    apiKey: process.env.MAILGUN_API_KEY,
    apiBaseUrl: apiBaseUrl(),
    fromEmail: process.env.MAILGUN_FROM_EMAIL || "info@aesthetics-ge.ch",
    fromName: process.env.MAILGUN_FROM_NAME || "Aesthetics Clinic",
  };
}

/**
 * Campaigns and newsletters. The from-address stays the clinic's branded one
 * so SPF/DKIM stay aligned and the brand is consistent; only the sending
 * domain — and therefore the suppression list — differs.
 */
export function marketingStream(): MailgunStream {
  return {
    domain: process.env.MAILGUN_MARKETING_DOMAIN || process.env.MAILGUN_DOMAIN,
    apiKey: process.env.MAILGUN_MARKETING_API_KEY || process.env.MAILGUN_API_KEY,
    apiBaseUrl: apiBaseUrl(),
    fromEmail:
      process.env.MAILGUN_MARKETING_FROM_EMAIL || "info@aesthetics-ge.ch",
    fromName: process.env.MAILGUN_MARKETING_FROM_NAME || "Aesthetics Clinic",
  };
}

/** True once campaigns can no longer poison transactional deliverability. */
export function streamsAreSplit(): boolean {
  const marketing = marketingStream().domain;
  const transactional = transactionalStream().domain;
  return !!marketing && !!transactional && marketing !== transactional;
}

/**
 * Every domain the app sends from, de-duplicated.
 *
 * The delivery-truth poller must read the event log of *all* of them: Mailgun
 * events are per-domain, so the moment marketing moves to its own domain a
 * poller that only knows MAILGUN_DOMAIN stops seeing campaign bounces — and
 * those bounces are exactly what flags a patient as unreachable.
 */
export function mailgunDomains(): string[] {
  const domains = [transactionalStream().domain, marketingStream().domain];
  return [...new Set(domains.filter((d): d is string => !!d))];
}
