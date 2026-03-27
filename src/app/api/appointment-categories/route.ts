import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointment_categories")
      .select("id, name, color, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching appointment categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Error in GET /api/appointment-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, color } = body;

    if (!id || !color) {
      return NextResponse.json(
        { error: "Missing id or color" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("appointment_categories")
      .update({ color, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, color")
      .single();

    if (error) {
      console.error("Error updating category color:", error);
      return NextResponse.json(
        { error: "Failed to update category color" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in PATCH /api/appointment-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing category name" },
        { status: 400 }
      );
    }

    // Get max sort_order
    const { data: maxData } = await supabaseAdmin
      .from("appointment_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxData?.sort_order ?? 0) + 1;

    const { data, error } = await supabaseAdmin
      .from("appointment_categories")
      .insert({
        name,
        color: color ?? "bg-slate-300/70",
        sort_order: nextSortOrder,
      })
      .select("id, name, color, sort_order")
      .single();

    if (error) {
      console.error("Error creating category:", error);
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in POST /api/appointment-categories:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
