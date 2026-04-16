import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const runtime = "nodejs";

/**
 * GET /api/retell/services?name={serviceName}
 * 
 * Returns service details including price in CHF.
 * This is designed for Retell AI to fetch service information during a conversation.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const category = searchParams.get("category");
    const all = searchParams.get("all") === "true";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If all=true, return all active services
    if (all) {
      const { data: services, error } = await supabase
        .from("services")
        .select("id, name, description, base_price, is_active, category:service_categories(name)")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("[Retell Services] Error fetching services:", error);
        return NextResponse.json(
          { error: "Failed to fetch services" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        services: (services || []).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price_chf: s.base_price,
          category: (s as any).category?.name || null,
        })),
        count: services?.length || 0,
      });
    }

    // If name provided, search for specific service
    if (name) {
      const { data: service, error } = await supabase
        .from("services")
        .select("id, name, description, base_price, is_active, category:service_categories(name)")
        .ilike("name", `%${name}%`)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error || !service) {
        // Try fuzzy search if exact match fails
        const { data: fuzzyServices } = await supabase
          .from("services")
          .select("id, name, description, base_price, is_active")
          .eq("is_active", true)
          .ilike("name", `%${name.split(" ")[0]}%`)
          .limit(5);

        return NextResponse.json({
          query: name,
          found: false,
          suggestions: (fuzzyServices || []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            price_chf: s.base_price,
          })),
        });
      }

      return NextResponse.json({
        query: name,
        found: true,
        service: {
          id: service.id,
          name: service.name,
          description: service.description,
          price_chf: service.base_price,
          category: (service as any).category?.name || null,
        },
      });
    }

    // If category provided, filter by category
    if (category) {
      const { data: services, error } = await supabase
        .from("services")
        .select("id, name, description, base_price, is_active, category:service_categories!inner(name)")
        .eq("is_active", true)
        .ilike("service_categories.name", `%${category}%`)
        .order("name");

      if (error) {
        console.error("[Retell Services] Error fetching services by category:", error);
        return NextResponse.json(
          { error: "Failed to fetch services" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        category,
        services: (services || []).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price_chf: s.base_price,
        })),
        count: services?.length || 0,
      });
    }

    // No parameters provided - return error with usage info
    return NextResponse.json(
      {
        error: "Missing required parameter",
        usage: {
          all_services: "/api/retell/services?all=true",
          search_by_name: "/api/retell/services?name=breast augmentation",
          filter_by_category: "/api/retell/services?category=Aesthetics",
        },
      },
      { status: 400 }
    );

  } catch (error) {
    console.error("[Retell Services] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
