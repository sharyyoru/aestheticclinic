import { NextResponse } from "next/server";
import { runInvoiceXmlSelfTest } from "@/lib/invoiceXmlSelfTest";

export const runtime = "nodejs";

/**
 * GET /api/medidata/schema-check
 *
 * Public on purpose, and safe to be: it builds a synthetic invoice with no
 * real patient, validates it against the official generalInvoiceRequest 5.0
 * schema, and returns only whether that worked. It proves the deployed XML
 * generator and the XSD gate in send-invoice are both functional.
 */
export async function GET() {
  const started = Date.now();
  try {
    const result = await runInvoiceXmlSelfTest();
    return NextResponse.json({ ...result, ms: Date.now() - started }, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[schema-check] validator unavailable:", err);
    return NextResponse.json({ ok: false, validatorUnavailable: true, ms: Date.now() - started }, { status: 500 });
  }
}
