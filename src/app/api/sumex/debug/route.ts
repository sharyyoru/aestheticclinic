import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    SUMEX_INVOICE_REQUEST_URL: process.env.SUMEX_INVOICE_REQUEST_URL,
    SUMEX_INVOICE_RESPONSE_URL: process.env.SUMEX_INVOICE_RESPONSE_URL,
    SUMEX_ACF_URL: process.env.SUMEX_ACF_URL,
    SUMEX_ACF_BASE_URL: process.env.SUMEX_ACF_BASE_URL,
    SUMEX_TARDOC_URL: process.env.SUMEX_TARDOC_URL,
  });
}
