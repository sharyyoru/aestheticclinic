"use client";

/**
 * Marketing attribution capture.
 *
 * Collects campaign + ad click identifiers so leads can be tied back to the
 * exact ad/campaign that produced them. Works for both:
 *  - standalone pages (e.g. /book-appointment, /intake) where the ad params are
 *    on the page URL, and
 *  - embedded iframe forms (/embed/*) where the ad params live on the PARENT
 *    page URL. In an iframe `document.referrer` is the parent page URL, so we
 *    parse click ids/utms out of the referrer as a fallback.
 *
 * First-meaningful-touch is persisted to localStorage so multi-step flows
 * (e.g. the intake wizard) keep the original gclid/utm even after internal
 * navigation strips the query string.
 */

export interface Attribution {
  sourceUrl: string;
  referrer: string;
  landingPage: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  gclid: string; // Google Ads click id
  gbraid: string; // Google Ads (iOS app->web)
  wbraid: string; // Google Ads (web->app)
  fbclid: string; // Meta/Facebook click id
  msclkid: string; // Microsoft/Bing Ads click id
  ttclid: string; // TikTok click id
}

const STORAGE_KEY = "aliice_attribution_v1";

const EMPTY: Attribution = {
  sourceUrl: "",
  referrer: "",
  landingPage: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmTerm: "",
  utmContent: "",
  gclid: "",
  gbraid: "",
  wbraid: "",
  fbclid: "",
  msclkid: "",
  ttclid: "",
};

function firstNonEmpty(sources: URLSearchParams[], key: string): string {
  for (const s of sources) {
    const v = s.get(key);
    if (v) return v.trim();
  }
  return "";
}

/**
 * Capture attribution for the current page view, merging with any persisted
 * first-touch data. Safe to call on every form mount.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return { ...EMPTY };

  const urlParams = new URLSearchParams(window.location.search);
  let refParams = new URLSearchParams();
  let referrer = "";
  try {
    referrer = document.referrer || "";
    if (referrer) refParams = new URL(referrer).searchParams;
  } catch {
    // malformed referrer — ignore
  }

  const sources = [urlParams, refParams];
  const current: Attribution = {
    sourceUrl: window.location.href,
    referrer,
    landingPage: `${window.location.origin}${window.location.pathname}`,
    utmSource: firstNonEmpty(sources, "utm_source"),
    utmMedium: firstNonEmpty(sources, "utm_medium"),
    utmCampaign: firstNonEmpty(sources, "utm_campaign"),
    utmTerm: firstNonEmpty(sources, "utm_term"),
    utmContent: firstNonEmpty(sources, "utm_content"),
    gclid: firstNonEmpty(sources, "gclid"),
    gbraid: firstNonEmpty(sources, "gbraid"),
    wbraid: firstNonEmpty(sources, "wbraid"),
    fbclid: firstNonEmpty(sources, "fbclid"),
    msclkid: firstNonEmpty(sources, "msclkid"),
    ttclid: firstNonEmpty(sources, "ttclid"),
  };

  let stored: Partial<Attribution> | null = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    stored = null;
  }

  const hasNewSignal = Boolean(
    current.utmSource ||
      current.utmCampaign ||
      current.gclid ||
      current.gbraid ||
      current.wbraid ||
      current.fbclid ||
      current.msclkid ||
      current.ttclid,
  );

  if (hasNewSignal || !stored) {
    if (hasNewSignal) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {
        // storage unavailable (private mode) — ignore
      }
    }
    return current;
  }

  // No campaign data on this view: reuse stored attribution but keep the live
  // page url / referrer for this specific submission.
  return {
    ...EMPTY,
    ...stored,
    sourceUrl: current.sourceUrl,
    referrer: current.referrer || stored.referrer || "",
    landingPage: stored.landingPage || current.landingPage,
  };
}

/** Body fields expected by the /api/public/embed-lead endpoint. */
export function toLeadAttributionPayload(a: Attribution) {
  return {
    sourceUrl: a.sourceUrl,
    referrer: a.referrer,
    landingPage: a.landingPage,
    utmSource: a.utmSource,
    utmMedium: a.utmMedium,
    utmCampaign: a.utmCampaign,
    utmTerm: a.utmTerm,
    utmContent: a.utmContent,
    gclid: a.gclid,
    gbraid: a.gbraid,
    wbraid: a.wbraid,
    fbclid: a.fbclid,
    msclkid: a.msclkid,
    ttclid: a.ttclid,
  };
}

/** Flattened params for a GTM/dataLayer event (omits empty values). */
export function attributionEventParams(a: Attribution): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (k: string, v: string) => {
    if (v) out[k] = v;
  };
  add("utm_source", a.utmSource);
  add("utm_medium", a.utmMedium);
  add("utm_campaign", a.utmCampaign);
  add("utm_term", a.utmTerm);
  add("utm_content", a.utmContent);
  add("gclid", a.gclid);
  add("gbraid", a.gbraid);
  add("wbraid", a.wbraid);
  add("fbclid", a.fbclid);
  add("msclkid", a.msclkid);
  add("ttclid", a.ttclid);
  add("landing_page", a.landingPage);
  add("referrer", a.referrer);
  return out;
}

/**
 * Simplified GA4-style channel grouping from a lead's attribution fields.
 * Accepts snake_case DB rows or camelCase objects.
 */
export function deriveChannel(lead: {
  utm_source?: string | null;
  utm_medium?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  ttclid?: string | null;
  referrer?: string | null;
}): string {
  const source = (lead.utm_source || "").toLowerCase();
  const medium = (lead.utm_medium || "").toLowerCase();
  const isSocialSource = /facebook|instagram|meta|tiktok|fb|ig/.test(source);
  const paidMedium = /cpc|ppc|paid|cpm|paidsearch|paid_social/.test(medium);

  if (lead.fbclid || lead.ttclid || (isSocialSource && (paidMedium || lead.fbclid))) {
    return "Paid Social";
  }
  if (lead.gclid || lead.gbraid || lead.wbraid || lead.msclkid || paidMedium) {
    return "Paid Search";
  }
  if (isSocialSource) return "Organic Social";
  if (medium === "email" || source === "email" || source.includes("newsletter")) {
    return "Email";
  }
  if (medium === "organic" || /google|bing|yahoo|duckduckgo/.test(source)) {
    return "Organic Search";
  }
  if (lead.utm_source) return "Other Campaign";
  if (lead.referrer) return "Referral";
  return "Direct";
}
