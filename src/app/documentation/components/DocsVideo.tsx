import { Clock, PlayCircle } from "lucide-react";
import type { DocVideo } from "../content/types";

/**
 * Server component — native controls only, so the video costs no client JS.
 * `preload="metadata"` keeps the page light: the 16:9 frame and duration are
 * fetched, the video itself only downloads once the reader presses play.
 */
export default function DocsVideo({ video }: { video: DocVideo }) {
  return (
    <figure className="mt-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <PlayCircle className="h-4 w-4 text-sky-500" aria-hidden="true" />
        <span>Watch first</span>
        {video.duration && (
          <>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {video.duration}
            </span>
          </>
        )}
      </div>

      <div className="mt-2.5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
        <video
          className="aspect-video w-full"
          controls
          preload="metadata"
          playsInline
          poster={video.poster}
          title={video.title}
        >
          <source src={video.src} type="video/mp4" />
          Your browser cannot play this video.{" "}
          <a href={video.src} className="underline">
            Download it instead
          </a>
          .
        </video>
      </div>

      {video.caption && (
        <figcaption className="mt-2 text-xs leading-relaxed text-slate-400">{video.caption}</figcaption>
      )}
    </figure>
  );
}
