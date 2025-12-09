import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to list users" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      data.map((user) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error listing users" },
      { status: 500 },
    );
  }
}
