import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Get unique locations from appointments table
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("location")
      .not("location", "is", null)
      .not("location", "eq", "");
    
    if (error) throw new Error(error.message);
    
    // Extract unique locations and sort them
    const locations = [...new Set(data?.map(item => item.location) || [])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    
    return NextResponse.json({ locations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}