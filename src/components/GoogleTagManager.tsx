"use client";

import Script from "next/script";
import { attributionEventParams, captureAttribution } from "@/lib/attribution";

const GTM_ID = "GTM-KP9GM9QG";

export function GoogleTagManager() {
  return (
    <>
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `,
        }}
      />
    </>
  );
}

export function GoogleTagManagerNoScript() {
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}

// Helper function to push events to dataLayer
export function pushToDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
    
    // If we're in an iframe, also send postMessage to parent window
    // This allows GTM on the parent page to track events from embedded forms
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          event,
          ...data
        }, "*");
      } catch (error) {
        console.error("Failed to send postMessage to parent:", error);
      }
    }
  }
}

// Estimated lead value (CHF) per form type — used as the conversion `value`
// for ad platform bidding. Tune these to your real average lead worth.
export const LEAD_VALUE_BY_TYPE: Record<string, number> = {
  booking: 150,
  contact: 50,
  intake: 100,
};

export interface LeadEventInput {
  /** 'booking' | 'contact' | 'intake' | ... */
  formType: string;
  value?: number;
  currency?: string;
  service?: string | null;
  location?: string | null;
  leadId?: string | null;
  isExistingPatient?: boolean;
  /** Pre-captured attribution params (utm/gclid/...). If omitted, captured automatically. */
  attribution?: Record<string, string>;
}

/**
 * Fires a rich conversion event to the dataLayer (and to the parent page when
 * embedded). Keeps the existing `aliice_form_submit` event so current GTM
 * triggers keep working, and also emits a GA4-standard `generate_lead` event.
 */
export function trackLeadConversion(input: LeadEventInput) {
  const value = input.value ?? LEAD_VALUE_BY_TYPE[input.formType] ?? 0;
  const currency = input.currency ?? "CHF";

  let attribution = input.attribution;
  if (!attribution) {
    try {
      attribution = attributionEventParams(captureAttribution());
    } catch {
      attribution = {};
    }
  }

  const payload: Record<string, unknown> = {
    form_type: input.formType,
    lead_type: input.formType,
    value,
    currency,
    ...(input.service ? { service: input.service } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.leadId ? { lead_id: input.leadId } : {}),
    ...(input.isExistingPatient !== undefined
      ? { is_existing_patient: input.isExistingPatient }
      : {}),
    ...(attribution ?? {}),
  };

  pushToDataLayer("aliice_form_submit", payload);
  pushToDataLayer("generate_lead", payload);
}

// Type declaration for window.dataLayer
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}
