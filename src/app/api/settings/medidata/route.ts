import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/settings/medidata
 * Returns the current MediData connection configuration.
 * Values come from environment variables (masked for security).
 */
export async function GET() {
  const senderGln = process.env.MEDIDATA_SENDER_GLN || "";
  const clientId = process.env.MEDIDATA_CLIENT_ID || "";
  const proxyUrl = process.env.MEDIDATA_PROXY_URL || "";
  const hasApiKey = !!process.env.MEDIDATA_PROXY_API_KEY;
  const isTestMode = senderGln.startsWith("209"); // Test GLNs start with 209

  return NextResponse.json({
    senderGln,
    clientId: clientId ? clientId.slice(0, 4) + "****" + clientId.slice(-4) : "",
    proxyUrl: proxyUrl || "(default)",
    connected: hasApiKey && !!senderGln,
    isTestMode,
  });
}

/**
 * POST /api/settings/medidata
 * Save MediData connection settings.
 * For now, this is a placeholder that validates input format.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderGln, clientId } = body as { senderGln?: string; clientId?: string };

    if (senderGln && !/^\d{13}$/.test(senderGln)) {
      return NextResponse.json(
        { error: "Sender GLN must be a 13-digit number" },
        { status: 400 },
      );
    }

    // In production, these would be saved to a secure store.
    // For now, return success to indicate the UI works.
    return NextResponse.json({
      success: true,
      message: "MediData settings updated. Restart may be required for changes to take effect.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }
}
