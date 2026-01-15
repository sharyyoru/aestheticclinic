"use client";

import { useState } from "react";

const DOCSPACE_URL = process.env.NEXT_PUBLIC_DOCSPACE_URL || "https://docspace-hm9cxt.onlyoffice.com";

export interface DocSpaceEditorProps {
  onClose?: () => void;
  onError?: (error: string) => void;
}

export default function DocSpaceEditor({
  onClose,
}: DocSpaceEditorProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="h-full w-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
            <p className="text-sm text-slate-600">Loading DocSpace...</p>
            <p className="text-xs text-slate-400 mt-2">If this takes too long, you may need to log in to DocSpace first</p>
          </div>
        </div>
      )}
      <iframe
        src={DOCSPACE_URL}
        className="h-full w-full border-0"
        style={{ minHeight: "calc(100vh - 60px)" }}
        onLoad={() => setIsLoading(false)}
        allow="clipboard-read; clipboard-write"
        title="DocSpace Editor"
      />
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white"
          title="Close"
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
