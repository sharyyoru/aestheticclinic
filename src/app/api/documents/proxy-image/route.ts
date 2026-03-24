import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy API route for serving images from Supabase storage.
 * This bypasses CORS and bucket access issues by fetching server-side.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Fetch the image from the provided URL
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.statusText}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Determine content type from URL extension or response headers
    let contentType = response.headers.get("content-type") || "application/octet-stream";
    
    // If content-type is generic, try to determine from URL extension
    if (contentType === "application/octet-stream" || contentType === "binary/octet-stream") {
      const urlLower = url.toLowerCase();
      if (urlLower.includes(".jpg") || urlLower.includes(".jpeg") || urlLower.includes(".jfif")) {
        contentType = "image/jpeg";
      } else if (urlLower.includes(".png")) {
        contentType = "image/png";
      } else if (urlLower.includes(".gif")) {
        contentType = "image/gif";
      } else if (urlLower.includes(".webp")) {
        contentType = "image/webp";
      } else if (urlLower.includes(".svg")) {
        contentType = "image/svg+xml";
      } else if (urlLower.includes(".bmp")) {
        contentType = "image/bmp";
      }
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch image";
    console.error("Image proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
