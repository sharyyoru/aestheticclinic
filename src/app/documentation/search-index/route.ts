import { NextResponse } from "next/server";
import { buildSearchEntries } from "../content";

// Static JSON so the search index is fetched only when the reader opens search,
// instead of shipping with every documentation page.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ entries: buildSearchEntries() });
}
