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

/**
 * Build the API signature for Payrexx requests
 */
function buildSignature(params: Record<string, string | number | boolean | undefined>): string {
  // Filter out undefined values and build query string
  const filteredParams = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>);

  const queryString = new URLSearchParams(filteredParams).toString();
  
  // Calculate HMAC-SHA256 signature
  const hmac = crypto.createHmac("sha256", PAYREXX_API_SECRET);
  hmac.update(queryString);
  return hmac.digest("base64");
}

/**
 * Make a request to the Payrexx API
 */
async function payrexxRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const signature = buildSignature(params);
  
  const url = new URL(endpoint, PAYREXX_BASE_URL);
  url.searchParams.set("instance", PAYREXX_INSTANCE);
  
  const body = new URLSearchParams();
  body.set("ApiSignature", signature);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      body.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method !== "GET" ? body.toString() : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Payrexx API error:", errorText);
    throw new Error(`Payrexx API error: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<T>;
}

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
 */
export async function createPayrexxGateway(
  params: CreateGatewayParams
): Promise<PayrexxGatewayResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  const gatewayParams: Record<string, string | number | boolean | undefined> = {
    amount: params.amount,
    currency: params.currency || "CHF",
    referenceId: params.referenceId,
    purpose: params.purpose || `Invoice ${params.referenceId}`,
    successRedirectUrl: params.successRedirectUrl || `${baseUrl}/invoice/payment-success`,
    failedRedirectUrl: params.failedRedirectUrl || `${baseUrl}/invoice/payment-failed`,
    cancelRedirectUrl: params.cancelRedirectUrl || `${baseUrl}/invoice/payment-cancelled`,
    // Pre-fill contact information if available
    "fields[forename]": params.forename,
    "fields[surname]": params.surname,
    "fields[email]": params.email,
    "fields[phone]": params.phone,
    "fields[street]": params.street,
    "fields[postcode]": params.postcode,
    "fields[place]": params.place,
    "fields[country]": params.country || "CH",
  };

  return payrexxRequest<PayrexxGatewayResponse>("Gateway/", "POST", gatewayParams);
}

/**
 * Retrieve a Payrexx Gateway by ID
 */
export async function getPayrexxGateway(gatewayId: number): Promise<PayrexxGatewayResponse> {
  const params = { id: gatewayId };
  const signature = buildSignature(params);
  
  const url = new URL(`Gateway/${gatewayId}/`, PAYREXX_BASE_URL);
  url.searchParams.set("instance", PAYREXX_INSTANCE);
  url.searchParams.set("ApiSignature", signature);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
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
  const params = { id: gatewayId };
  await payrexxRequest(`Gateway/${gatewayId}/`, "DELETE", params);
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
