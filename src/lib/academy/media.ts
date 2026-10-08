import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Turns a stored Academy media reference into something the browser can load.
 *
 * Academy recordings are made against production and contain real patient
 * data, so they live in the PRIVATE `academy-media` bucket and
 * `academy_lessons.video_url` holds an object **path**, not a URL. This mints
 * a short-lived signed URL per render. The lesson page is `force-dynamic`, so
 * every visit gets a fresh one and a leaked link stops working within the
 * hour.
 *
 * Anything that already looks like a URL is passed through untouched, so
 * hand-set YouTube and Vimeo links — which VideoContainer still supports —
 * keep working.
 */

export const ACADEMY_MEDIA_BUCKET = "academy-media";

/** One hour: comfortably longer than any lesson, short enough to contain a leak. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isAbsoluteUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("data:");
}

export async function resolveAcademyMedia(
  reference: string | null | undefined,
): Promise<string | null> {
  if (!reference) return null;
  const trimmed = reference.trim();
  if (!trimmed) return null;
  if (isAbsoluteUrl(trimmed)) return trimmed;

  const { data, error } = await supabaseAdmin.storage
    .from(ACADEMY_MEDIA_BUCKET)
    .createSignedUrl(trimmed.replace(/^\/+/, ""), SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    // A missing object must not blank the whole lesson — the player falls back
    // to its "coming soon" state and the rest of the page still renders.
    console.error(`[academy/media] Could not sign "${trimmed}":`, error?.message);
    return null;
  }
  return data.signedUrl;
}

/** Convenience for the lesson page, which needs all three at once. */
export async function resolveLessonMedia(lesson: {
  video_url: string | null;
  poster_url: string | null;
  captions_url: string | null;
}): Promise<{ videoUrl: string | null; posterUrl: string | null; captionsUrl: string | null }> {
  const [videoUrl, posterUrl, captionsUrl] = await Promise.all([
    resolveAcademyMedia(lesson.video_url),
    resolveAcademyMedia(lesson.poster_url),
    resolveAcademyMedia(lesson.captions_url),
  ]);
  return { videoUrl, posterUrl, captionsUrl };
}
