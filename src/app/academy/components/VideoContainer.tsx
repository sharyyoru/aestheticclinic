"use client";

interface VideoContainerProps {
  videoUrl: string | null;
  title: string;
}

export default function VideoContainer({ videoUrl, title }: VideoContainerProps) {
  // Check if it's a YouTube URL
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  // Check if it's a Vimeo URL
  const getVimeoId = (url: string) => {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
  };

  if (videoUrl) {
    const youtubeId = getYouTubeId(videoUrl);
    const vimeoId = getVimeoId(videoUrl);

    if (youtubeId) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      );
    }

    if (vimeoId) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      );
    }

    // Direct video URL
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
        <video
          src={videoUrl}
          controls
          className="h-full w-full"
          poster="/video-poster.jpg"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Placeholder when no video
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center text-center p-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur">
        <svg className="h-10 w-10 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-medium text-white/80">Video Coming Soon</h3>
      <p className="mt-1 text-xs text-white/50">
        We&apos;re working on creating a video tutorial for this module.
      </p>
    </div>
  );
}
