"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    DocSpace?: {
      SDK: {
        initFrame: (config: DocSpaceConfig) => DocSpaceInstance;
        initEditor: (config: DocSpaceConfig) => DocSpaceInstance;
        initManager: (config: DocSpaceConfig) => DocSpaceInstance;
      };
    };
  }
}

interface DocSpaceInstance {
  destroyFrame: () => void;
  setConfig: (config: Partial<DocSpaceConfig>) => void;
}

interface DocSpaceConfig {
  frameId: string;
  src?: string;
  mode?: "manager" | "editor" | "viewer" | "room-selector" | "file-selector";
  width?: string;
  height?: string;
  name?: string;
  type?: string;
  id?: string | number;
  requestToken?: string;
  withSubfolders?: boolean;
  rootPath?: string;
  editorType?: "desktop" | "embedded";
  editorGoBack?: boolean;
  showHeader?: boolean;
  showTitle?: boolean;
  showMenu?: boolean;
  showFilter?: boolean;
  showSelectorCancel?: boolean;
  showSelectorHeader?: boolean;
  showSignOut?: boolean;
  destroyText?: string;
  viewAs?: "row" | "table" | "tile";
  filter?: {
    count?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: "ascending" | "descending";
    filterType?: string;
    search?: string;
    withSubfolders?: boolean;
  };
  events?: {
    onAppReady?: () => void;
    onAppError?: (error: string) => void;
    onCloseCallback?: () => void;
    onDownload?: (file: unknown) => void;
    onEditorCloseCallback?: () => void;
    onSelectCallback?: (data: unknown) => void;
    onAuthSuccess?: () => void;
  };
}

interface DocSpaceEditorProps {
  docSpaceUrl: string;
  fileId?: string | number;
  mode?: "editor" | "viewer" | "manager";
  onClose?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export default function DocSpaceEditor({
  docSpaceUrl,
  fileId,
  mode = "editor",
  onClose,
  onError,
  onReady,
}: DocSpaceEditorProps) {
  const instanceRef = useRef<DocSpaceInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.DocSpace?.SDK) {
          resolve();
          return;
        }

        if (scriptLoadedRef.current) {
          const checkInterval = setInterval(() => {
            if (window.DocSpace?.SDK) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error("Timeout waiting for DocSpace SDK"));
          }, 10000);
          return;
        }

        scriptLoadedRef.current = true;
        const script = document.createElement("script");
        script.src = `${docSpaceUrl}/static/scripts/sdk/2.0.0/api.js`;
        script.async = true;
        script.onload = () => {
          // Wait a bit for SDK to initialize
          setTimeout(() => {
            if (window.DocSpace?.SDK) {
              resolve();
            } else {
              reject(new Error("DocSpace SDK not initialized after load"));
            }
          }, 500);
        };
        script.onerror = () => reject(new Error("Failed to load DocSpace SDK"));
        document.head.appendChild(script);
      });
    };

    const initDocSpace = async () => {
      try {
        await loadScript();
        setIsLoading(false);

        if (!window.DocSpace?.SDK) {
          throw new Error("DocSpace SDK not available");
        }

        const config: DocSpaceConfig = {
          frameId: "docspace-frame",
          width: "100%",
          height: "100%",
          showHeader: true,
          showTitle: true,
          showMenu: mode === "manager",
          showFilter: mode === "manager",
          events: {
            onAppReady: () => {
              console.log("DocSpace ready");
              onReady?.();
            },
            onAppError: (err) => {
              console.error("DocSpace error:", err);
              setError(String(err));
              onError?.(String(err));
            },
            onEditorCloseCallback: () => {
              onClose?.();
            },
            onCloseCallback: () => {
              onClose?.();
            },
          },
        };

        // Initialize based on mode
        if (mode === "editor" && fileId) {
          config.id = fileId;
          config.editorType = "desktop";
          config.editorGoBack = false;
          instanceRef.current = window.DocSpace.SDK.initEditor(config);
        } else if (mode === "viewer" && fileId) {
          config.id = fileId;
          config.mode = "viewer";
          instanceRef.current = window.DocSpace.SDK.initEditor(config);
        } else {
          // Manager mode - shows file browser
          config.mode = "manager";
          instanceRef.current = window.DocSpace.SDK.initManager(config);
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize DocSpace";
        setError(errorMessage);
        setIsLoading(false);
        onError?.(errorMessage);
      }
    };

    initDocSpace();

    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroyFrame();
        } catch (e) {
          console.error("Error destroying DocSpace frame:", e);
        }
        instanceRef.current = null;
      }
    };
  }, [docSpaceUrl, fileId, mode, onClose, onError, onReady]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <svg className="mx-auto mb-4 h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mb-2 text-lg font-semibold text-red-800">DocSpace Connection Error</h3>
          <p className="mb-4 text-sm text-red-600">{error}</p>
          <div className="text-left text-xs text-slate-600">
            <p className="mb-2 font-medium">Setup Instructions:</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>Go to your DocSpace settings</li>
              <li>Navigate to <strong>Developer Tools</strong> → <strong>JavaScript SDK</strong></li>
              <li>Add your app URL: <code className="rounded bg-slate-100 px-1 py-0.5">{typeof window !== 'undefined' ? window.location.origin : 'your-app-url'}</code></li>
              <li>Save and refresh this page</li>
            </ol>
          </div>
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
          <p className="text-sm text-slate-600">Loading DocSpace Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div id="docspace-frame" className="h-full w-full" />
    </div>
  );
}
