import { NextRequest, NextResponse } from "next/server";
import { computeUserActivity } from "@/lib/userActivity";
import { requireStaff, requireRole, authErrorResponse } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
      await requireStaff(req);
    } catch (err) {
      return authErrorResponse(err);
    }
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!userId || !from || !to) {
      return NextResponse.json(
        { error: "Missing required params: userId, from, to" },
        { status: 400 },
      );
    }

    const response = await computeUserActivity(userId, from, to);
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
