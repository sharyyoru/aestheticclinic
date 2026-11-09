import { NextRequest, NextResponse } from "next/server";
import { requireStaff, requireRole, authErrorResponse } from "@/lib/serverAuth";

/**
 * Proxy API route for serving images from Supabase storage.
 * This bypasses CORS and bucket access issues by fetching server-side.
 *
 * This route is loaded as an <img src>, and an image subresource cannot carry
 * an Authorization header — installAuthFetch only patches window.fetch. So
 * guarding it with requireStaff made every document thumbnail and preview in
 * the patient File Storage tab answer 401 and render as a broken image.
 *
 * It cannot simply be made public either: it used to fetch *any* URL
 * server-side, which is an open SSRF proxy. Both problems are fixed together:
 *
 *   1. The target must be our own Supabase storage. That is what closes the
 *      SSRF hole, independently of who is calling.
 *   2. Within storage, a target that already proves its own authorisation is
 *      served without a session, because an <img> cannot present one:
 *        - /object/public/...  is world-readable at that exact URL already,
 *          so proxying it discloses nothing the direct URL does not.
 *        - /object/sign/...?token=...  carries a time-limited signature; the
 *          token IS the authorisation.
 *      Anything else under storage still requires a staff session.
 */
function storageTarget(raw: string): { ok: true; selfAuthorising: boolean } | { ok: false; reason: string } {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, reason: "Storage origin is not configured" };
  let target: URL;
  let allowed: URL;
  try {
    target = new URL(raw);
    allowed = new URL(base);
  } catch {
    return { ok: false, reason: "Invalid url parameter" };
  }
  if (target.origin !== allowed.origin) {
    return { ok: false, reason: "Only this project's Supabase storage may be proxied" };
  }
  if (!target.pathname.startsWith("/storage/v1/object/")) {
    return { ok: false, reason: "Only storage objects may be proxied" };
  }
  const isPublic = target.pathname.startsWith("/storage/v1/object/public/");
  const isSigned =
    target.pathname.startsWith("/storage/v1/object/sign/") && !!target.searchParams.get("token");
  return { ok: true, selfAuthorising: isPublic || isSigned };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const target = storageTarget(url);
  if (!target.ok) {
    return NextResponse.json({ error: target.reason }, { status: 400 });
  }
  if (!target.selfAuthorising) {
    try {
      await requireStaff(req);
    } catch (err) {
      return authErrorResponse(err);
    }
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
