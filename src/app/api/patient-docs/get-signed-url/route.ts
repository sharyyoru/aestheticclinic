import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET_NAME = "patient-docs";

/**
 * API to generate fresh signed URLs for patient-docs files on-demand.
 * This solves the JWT expiration issue by generating URLs when needed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath } = body;

    if (!filePath) {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 });
    }

    // Generate a fresh signed URL (valid for 24 hours)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 86400);

    if (error || !data?.signedUrl) {
      console.error("Error creating signed URL:", error);
      return NextResponse.json({ error: "Failed to create signed URL" }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error: any) {
    console.error("Error in get-signed-url:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * GET endpoint for direct file serving with fresh signed URL redirect
 */
export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "path parameter is required" }, { status: 400 });
  }

  try {
    // Generate a fresh signed URL
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 86400);

    if (error || !data?.signedUrl) {
      console.error("Error creating signed URL:", error);
      return NextResponse.json({ error: "Failed to create signed URL" }, { status: 500 });
    }

    // Fetch the file using the fresh signed URL
    const response = await fetch(data.signedUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.statusText}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes only
      },
    });
  } catch (error: any) {
    console.error("Error in get-signed-url GET:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
