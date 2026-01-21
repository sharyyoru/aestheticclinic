/**
 * Payrexx Payment Gateway Integration
 * https://developers.payrexx.com/reference/rest-api
 */

import * as crypto from "crypto";

// Payrexx configuration
const PAYREXX_INSTANCE = process.env.PAYREXX_INSTANCE || "aestheticsclinic";
const PAYREXX_API_SECRET = process.env.PAYREXX_API_SECRET || "";
const PAYREXX_BASE_URL = `https://api.payrexx.com/v1.0/`;

export type PayrexxGatewayResponse = {
  status: string;
  data: {
    id: number;
    hash: string;
    link: string;
    status: string;
    createdAt: number;
    invoices: Array<{
      paymentRequestId: number;
      referenceId: string;
      amount: number;
      currency: string;
    }>;
  }[];
};

export type PayrexxTransactionStatus = 
  | "waiting"
  | "confirmed"
  | "authorized"
  | "reserved"
  | "refunded"
  | "partially-refunded"
  | "cancelled"
  | "declined"
  | "error"
  | "uncaptured";

export type PayrexxWebhookPayload = {
  transaction: {
    id: number;
    uuid: string;
    status: PayrexxTransactionStatus;
    time: string;
    lang: string;
    pageUuid: string;
    payment: {
      brand: string;
      wallet: string | null;
      cardType: string;
    };
    psp: string;
    pspId: number;
    mode: string;
    referenceId: string;
    invoice: {
      number: string;
      products: Array<{
        name: string;
        description: string;
        quantity: number;
        amount: number;
        sku: string;
      }>;
      amount: number;
      currency: string;
      discount: {
        code: string;
        amount: number;
        percentage: number;
      };
      customFields: Record<string, string>;
      test: boolean;
      referenceId: string;
      paymentLink: {
        hash: string;
        referenceId: string;
        email: string | null;
        name: string;
        differentBillingAddress: boolean;
        expirationDate: string | null;
      };
      paymentRequestId: number;
      originalAmount: number;
    };
    contact: {
      id: number;
      uuid: string;
      title: string;
      firstname: string;
      lastname: string;
      company: string;
      street: string;
      zip: string;
      place: string;
      country: string;
      countryISO: string;
      phone: string;
      email: string;
      dateOfBirth: string | null;
      deliveryGender: string;
      deliveryTitle: string;
      deliveryFirstname: string;
      deliveryLastname: string;
      deliveryCompany: string;
      deliveryStreet: string;
      deliveryZip: string;
      deliveryPlace: string;
      deliveryCountry: string;
      deliveryCountryISO: string;
      deliveryPhone: string;
    };
    subscription: unknown;
    refundable: boolean;
    partiallyRefundable: boolean;
    metadata: Record<string, unknown>;
  };
};

export type CreateGatewayParams = {
  amount: number; // Amount in cents (e.g., 100.00 CHF = 10000)
  currency?: string;
  referenceId: string; // Invoice/consultation ID
  purpose?: string;
  successRedirectUrl?: string;
  failedRedirectUrl?: string;
  cancelRedirectUrl?: string;
  // Contact information
  forename?: string;
  surname?: string;
  email?: string;
  phone?: string;
  street?: string;
  postcode?: string;
  place?: string;
  country?: string;
};

/**
 * Create a Payrexx Gateway (payment link)
 * Uses X-API-KEY header authentication (as per official Payrexx PHP SDK)
 */
export async function createPayrexxGateway(
  params: CreateGatewayParams
): Promise<PayrexxGatewayResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app";
  
  // Build URL-encoded body manually for correct field array format
  const bodyParts: string[] = [];
  
  // Add required params
  bodyParts.push(`amount=${params.amount}`);
  bodyParts.push(`currency=${encodeURIComponent(params.currency || "CHF")}`);
  
  // Add optional params
  if (params.referenceId) {
    bodyParts.push(`referenceId=${encodeURIComponent(params.referenceId)}`);
  }
  if (params.purpose) {
    bodyParts.push(`purpose=${encodeURIComponent(params.purpose)}`);
  }
  
  // Add redirect URLs
  const successUrl = params.successRedirectUrl || `${baseUrl}/invoice/payment-success`;
  const failedUrl = params.failedRedirectUrl || `${baseUrl}/invoice/payment-failed`;
  const cancelUrl = params.cancelRedirectUrl || `${baseUrl}/invoice/payment-cancelled`;
  
  bodyParts.push(`successRedirectUrl=${encodeURIComponent(successUrl)}`);
  bodyParts.push(`failedRedirectUrl=${encodeURIComponent(failedUrl)}`);
  bodyParts.push(`cancelRedirectUrl=${encodeURIComponent(cancelUrl)}`);
  
  // Add contact fields using correct array format: fields[type][0][value]=xxx
  if (params.forename) {
    bodyParts.push(`fields[forename][0][value]=${encodeURIComponent(params.forename)}`);
  }
  if (params.surname) {
    bodyParts.push(`fields[surname][0][value]=${encodeURIComponent(params.surname)}`);
  }
  if (params.email) {
    bodyParts.push(`fields[email][0][value]=${encodeURIComponent(params.email)}`);
  }
  if (params.phone) {
    bodyParts.push(`fields[phone][0][value]=${encodeURIComponent(params.phone)}`);
  }
  if (params.street) {
    bodyParts.push(`fields[street][0][value]=${encodeURIComponent(params.street)}`);
  }
  if (params.postcode) {
    bodyParts.push(`fields[postcode][0][value]=${encodeURIComponent(params.postcode)}`);
  }
  if (params.place) {
    bodyParts.push(`fields[place][0][value]=${encodeURIComponent(params.place)}`);
  }
  if (params.country) {
    bodyParts.push(`fields[country][0][value]=${encodeURIComponent(params.country)}`);
  }
  
  const url = new URL("Gateway/", PAYREXX_BASE_URL);
  url.searchParams.set("instance", PAYREXX_INSTANCE);
  
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-KEY": PAYREXX_API_SECRET,
    },
    body: bodyParts.join("&"),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Payrexx API error:", errorText);
    throw new Error(`Payrexx API error: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<PayrexxGatewayResponse>;
}

/**
 * Retrieve a Payrexx Gateway by ID
 */
export async function getPayrexxGateway(gatewayId: number): Promise<PayrexxGatewayResponse> {
  const url = new URL(`Gateway/${gatewayId}/`, PAYREXX_BASE_URL);
  url.searchParams.set("instance", PAYREXX_INSTANCE);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-KEY": PAYREXX_API_SECRET,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Payrexx API error: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<PayrexxGatewayResponse>;
}

/**
 * Delete a Payrexx Gateway
 */
export async function deletePayrexxGateway(gatewayId: number): Promise<void> {
  const url = new URL(`Gateway/${gatewayId}/`, PAYREXX_BASE_URL);
  url.searchParams.set("instance", PAYREXX_INSTANCE);

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-KEY": PAYREXX_API_SECRET,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Payrexx API error: ${response.status} ${errorText}`);
  }
}

/**
 * Verify webhook signature from Payrexx
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const hmac = crypto.createHmac("sha256", PAYREXX_API_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Map Payrexx transaction status to our invoice paid status
 */
export function isTransactionPaid(status: PayrexxTransactionStatus): boolean {
  return status === "confirmed";
}

/**
 * Generate QR code data URL for a payment link
 */
export async function generatePaymentQRCode(paymentLink: string): Promise<string> {
  // We'll use the qrcode library which is already installed
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(paymentLink, {
    width: 200,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}
