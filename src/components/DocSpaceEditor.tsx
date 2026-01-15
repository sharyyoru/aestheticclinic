"use client";

import { useEffect, useRef, useState } from "react";

const DOCSPACE_URL = "https://docspace-hm9cxt.onlyoffice.com";

declare global {
  interface Window {
    DocSpace?: {
      SDK: {
        init: (config: DocSpaceConfig) => DocSpaceInstance;
        initFrame: (config: DocSpaceConfig) => DocSpaceInstance;
      };
    };
  }
}

interface DocSpaceConfig {
  src: string;
  mode: string;
  width: string;
  height: string;
  frameId: string;
  showHeader: boolean;
  showTitle: boolean;
  showMenu: boolean;
  showFilter: boolean;
  disableActionButton: boolean;
  init: boolean;
  viewTableColumns: string;
  filter: {
    count: number;
    page: number;
    sortorder: string;
    sortby: string;
    search: string;
    withSubfolders: boolean;
  };
  events?: {
    onAppReady?: () => void;
    onAppError?: (error: string) => void;
    onSelectCallback?: (event: { data: unknown }) => void;
  };
}

interface DocSpaceInstance {
  destroyFrame?: () => void;
}

export interface DocSpaceEditorProps {
  onClose?: () => void;
  onError?: (error: string) => void;
  onFileSelect?: (fileData: unknown) => void;
}

export default function DocSpaceEditor({
  onClose,
  onError,
  onFileSelect,
}: DocSpaceEditorProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const instanceRef = useRef<DocSpaceInstance | null>(null);
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const config: DocSpaceConfig = {
      src: DOCSPACE_URL,
      mode: "manager",
      width: "100%",
      height: "100%",
      frameId: "ds-frame",
      showHeader: true,
      showTitle: true,
      showMenu: true,
      showFilter: true,
      disableActionButton: false,
      init: true,
      viewTableColumns: "Index,Name,Size,Type,Tags",
      filter: {
        count: 100,
        page: 1,
        sortorder: "descending",
        sortby: "DateAndTime",
        search: "",
        withSubfolders: false,
      },
      events: {
        onAppReady: () => {
          console.log("DocSpace app ready");
          setStatus("ready");
        },
        onAppError: (error: string) => {
          console.error("DocSpace app error:", error);
          setErrorMsg(String(error));
          setStatus("error");
          onError?.(String(error));
        },
        onSelectCallback: (event: { data: unknown }) => {
          console.log("File selected:", event);
          onFileSelect?.(event.data);
        },
      },
    };

    const initDocSpace = () => {
      if (!window.DocSpace?.SDK) {
        console.error("DocSpace SDK not available");
        setErrorMsg("DocSpace SDK failed to load");
        setStatus("error");
        onError?.("DocSpace SDK failed to load");
        return;
      }

      try {
        console.log("Initializing DocSpace SDK with config:", config);
        instanceRef.current = window.DocSpace.SDK.init(config);
        console.log("DocSpace SDK initialized");
      } catch (err) {
        console.error("Error initializing DocSpace:", err);
        setErrorMsg(err instanceof Error ? err.message : "Failed to initialize DocSpace");
        setStatus("error");
        onError?.(err instanceof Error ? err.message : "Failed to initialize DocSpace");
      }
    };

    // Load SDK script version 2.1.0
    const script = document.createElement("script");
    script.setAttribute("src", `${DOCSPACE_URL}/static/scripts/sdk/2.1.0/api.js`);
    script.onload = () => {
      console.log("DocSpace SDK 2.1.0 script loaded");
      // Small delay to ensure SDK is fully initialized
      setTimeout(initDocSpace, 500);
    };
    script.onerror = () => {
      console.error("Failed to load DocSpace SDK script");
      setErrorMsg("Failed to load DocSpace SDK script");
      setStatus("error");
      onError?.("Failed to load DocSpace SDK script");
    };
    document.body.appendChild(script);

    return () => {
      if (instanceRef.current?.destroyFrame) {
        try {
          instanceRef.current.destroyFrame();
        } catch (e) {
          console.error("Error destroying DocSpace frame:", e);
        }
      }
    };
  }, [onError, onFileSelect]);

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mb-2 text-lg font-semibold text-red-800">DocSpace Error</h3>
          <p className="mb-4 text-sm text-red-600">{errorMsg}</p>
          <p className="text-xs text-slate-500">
            Make sure your domain is added in DocSpace → Developer Tools → JavaScript SDK
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
            <p className="text-sm text-slate-600">Loading DocSpace...</p>
          </div>
        </div>
      )}
      <div id="ds-frame" className="h-full w-full" style={{ minHeight: "calc(100vh - 60px)" }} />
    </div>
  );
}
