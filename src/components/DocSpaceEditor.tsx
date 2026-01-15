"use client";

import { useEffect, useRef, useState } from "react";

const DOCSPACE_URL = process.env.NEXT_PUBLIC_DOCSPACE_URL || "https://docspace-hm9cxt.onlyoffice.com";

declare global {
  interface Window {
    DocSpace?: {
      SDK: {
        initFrame: (config: Record<string, unknown>) => DocSpaceInstance;
        initManager: (config: Record<string, unknown>) => DocSpaceInstance;
        initEditor: (config: Record<string, unknown>) => DocSpaceInstance;
      };
    };
  }
}

interface DocSpaceInstance {
  destroyFrame: () => void;
}

interface DocSpaceEditorProps {
  onClose?: () => void;
  onError?: (error: string) => void;
}

export default function DocSpaceEditor({
  onClose,
  onError,
}: DocSpaceEditorProps) {
  const instanceRef = useRef<DocSpaceInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const initAttemptedRef = useRef(false);

  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const scriptId = "docspace-sdk-script";
    
    const initDocSpace = () => {
      console.log("Initializing DocSpace SDK...");
      
      if (!window.DocSpace?.SDK) {
        console.error("DocSpace SDK not found on window");
        setErrorMsg("DocSpace SDK failed to load");
        setStatus("error");
        onError?.("DocSpace SDK failed to load");
        return;
      }

      try {
        console.log("DocSpace SDK found, initializing frame...");
        
        // Use initFrame with manager mode to show file browser
        instanceRef.current = window.DocSpace.SDK.initFrame({
          frameId: "docspace-frame",
          width: "100%",
          height: "100%",
          mode: "manager",
          showHeader: true,
          showTitle: true,
          showMenu: true,
          showFilter: true,
          showSignOut: false,
          events: {
            onAppReady: () => {
              console.log("DocSpace app ready");
              setStatus("ready");
            },
            onAppError: (error: unknown) => {
              console.error("DocSpace app error:", error);
              setErrorMsg(String(error));
              setStatus("error");
              onError?.(String(error));
            },
          },
        });
        
        console.log("DocSpace frame initialized");
      } catch (err) {
        console.error("Error initializing DocSpace:", err);
        setErrorMsg(err instanceof Error ? err.message : "Failed to initialize");
        setStatus("error");
        onError?.(err instanceof Error ? err.message : "Failed to initialize");
      }
    };

    // Check if script already exists
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      // Script exists, check if SDK is ready
      if (window.DocSpace?.SDK) {
        initDocSpace();
      } else {
        // Wait for it
        const checkInterval = setInterval(() => {
          if (window.DocSpace?.SDK) {
            clearInterval(checkInterval);
            initDocSpace();
          }
        }, 100);
        setTimeout(() => clearInterval(checkInterval), 10000);
      }
      return;
    }

    // Load the SDK script
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${DOCSPACE_URL}/static/scripts/sdk/2.0.0/api.js`;
    script.async = true;
    
    script.onload = () => {
      console.log("DocSpace SDK script loaded");
      // Give it a moment to initialize
      setTimeout(() => {
        initDocSpace();
      }, 1000);
    };
    
    script.onerror = (e) => {
      console.error("Failed to load DocSpace SDK script:", e);
      setErrorMsg("Failed to load DocSpace SDK script");
      setStatus("error");
      onError?.("Failed to load DocSpace SDK script");
    };

    document.head.appendChild(script);

    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroyFrame();
        } catch (e) {
          console.error("Error destroying frame:", e);
        }
        instanceRef.current = null;
      }
    };
  }, [onError]);

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
        <button
          onClick={onClose}
          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
        >
          Close
        </button>
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
      <div id="docspace-frame" className="h-full w-full" style={{ minHeight: "600px" }} />
    </div>
  );
}
