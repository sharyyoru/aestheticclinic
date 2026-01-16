"use client";

import { useEffect, useRef, useState } from "react";

const DOCSPACE_URL = "https://docspace-hm9cxt.onlyoffice.com";

declare global {
  interface Window {
    DocSpace?: {
      SDK: {
        initManager: (config: DocSpaceConfig) => DocSpaceInstance;
        initFrame: (config: DocSpaceConfig) => DocSpaceInstance;
        frames: Record<string, DocSpaceInstance>;
      };
    };
  }
}

interface HashSettings {
  size: number;
  iterations: number;
  salt: string;
}

interface DocSpaceConfig {
  frameId: string;
  src: string;
  width?: string;
  height?: string;
  showHeader?: boolean;
  showTitle?: boolean;
  showMenu?: boolean;
  showFilter?: boolean;
  viewTableColumns?: string;
  filter?: {
    count?: string;
    sortBy?: string;
    sortOrder?: string;
    search?: string;
    withSubfolders?: boolean;
  };
  events?: {
    onAppReady?: () => void;
    onAppError?: (error: string) => void;
    onSelectCallback?: (event: { data: unknown }) => void;
    onContentReady?: () => void;
  };
}

interface DocSpaceInstance {
  destroyFrame?: () => void;
  config?: DocSpaceConfig;
  getUserInfo?: () => Promise<{ id: string; email: string; displayName: string } | null>;
  getHashSettings?: () => Promise<HashSettings>;
  createHash?: (password: string, hashSettings: HashSettings) => Promise<{ hash: string }>;
  login?: (email: string, passwordHash: string, password?: string, session?: boolean) => Promise<{ success: boolean; user?: unknown }>;
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
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "auth_required">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const instanceRef = useRef<DocSpaceInstance | null>(null);
  const initAttemptedRef = useRef(false);
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loginAttemptedRef = useRef(false);

  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const config: DocSpaceConfig = {
      frameId: "ds-frame",
      src: DOCSPACE_URL,
      width: "100%",
      height: "100%",
      showHeader: true,
      showTitle: true,
      showMenu: true,
      showFilter: true,
      viewTableColumns: "Name,Size,Type,Modified,Author",
      filter: {
        count: "100",
        sortBy: "DateAndTime",
        sortOrder: "descending",
        search: "",
        withSubfolders: false,
      },
      events: {
        onAppReady: () => {
          console.log("DocSpace app ready");
          if (authCheckTimeoutRef.current) {
            clearTimeout(authCheckTimeoutRef.current);
          }
          setStatus("ready");
        },
        onAppError: (error: string) => {
          console.error("DocSpace app error:", error);
          setErrorMsg(String(error));
          setStatus("error");
          onError?.(String(error));
        },
        onContentReady: () => {
          console.log("DocSpace content ready - waiting for authentication check");
        },
        onSelectCallback: (event: { data: unknown }) => {
          console.log("File selected:", event);
          onFileSelect?.(event.data);
        },
      },
    };

    const initDocSpace = () => {
      console.log("=== DocSpace Init Debug ===");
      console.log("Current URL:", window.location.href);
      console.log("DocSpace URL:", DOCSPACE_URL);
      console.log("Window.DocSpace exists:", !!window.DocSpace);
      console.log("Window.DocSpace.SDK exists:", !!window.DocSpace?.SDK);
      
      if (!window.DocSpace?.SDK) {
        const msg = "DocSpace SDK not available on window object. Check if domain is whitelisted in DocSpace settings.";
        console.error(msg);
        setErrorMsg(msg);
        setStatus("error");
        onError?.(msg);
        return;
      }

      try {
        console.log("Initializing DocSpace SDK with config:", config);
        instanceRef.current = window.DocSpace.SDK.initManager(config);
        console.log("✅ DocSpace SDK initialized successfully");
        
        const attemptLogin = async () => {
          if (loginAttemptedRef.current) return;
          loginAttemptedRef.current = true;
          
          console.log("🔐 Starting authentication check...");
          
          try {
            console.log("Checking if user is already authenticated...");
            const userInfo = await instanceRef.current?.getUserInfo?.();
            if (userInfo && userInfo.id) {
              console.log("✅ User already authenticated:", userInfo);
              setStatus("ready");
              return;
            }
          } catch (e) {
            console.log("User not authenticated, proceeding with login...");
          }
          
          try {
            console.log("📡 Fetching login credentials from API...");
            const loginResponse = await fetch("/api/docspace/login", {
              method: "POST",
            });
            
            if (!loginResponse.ok) {
              const errorData = await loginResponse.json();
              console.error("❌ Failed to get credentials:", errorData);
              throw new Error(errorData.error || "Failed to get login credentials");
            }
            
            const loginData = await loginResponse.json();
            console.log("✅ Credentials received, attempting SDK login...");
            
            if (!loginData.success) {
              throw new Error(loginData.error || "Invalid credentials response");
            }
            
            if (!instanceRef.current?.login) {
              console.error("❌ SDK login method not available");
              console.log("Available methods:", Object.keys(instanceRef.current || {}));
              throw new Error("SDK login method not available");
            }
            
            console.log("🔑 Calling SDK.login() with email:", loginData.email);
            const result = await instanceRef.current.login(
              loginData.email,
              loginData.passwordHash,
              undefined,
              true
            );
            
            console.log("Login result:", result);
            
            if (result && result.success) {
              console.log("✅ Login successful!");
              setStatus("ready");
            } else {
              throw new Error("Login returned unsuccessful result");
            }
          } catch (error) {
            console.error("❌ Authentication failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            setStatus("auth_required");
            setErrorMsg("Authentication failed: " + errorMessage);
          }
        };
        
        authCheckTimeoutRef.current = setTimeout(attemptLogin, 3000);
      } catch (err) {
        console.error("❌ Error initializing DocSpace:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error details:", errorMessage);
        setErrorMsg("Failed to initialize: " + errorMessage);
        setStatus("error");
        onError?.(errorMessage);
      }
    };

    // Check if script already exists
    const existingScript = document.querySelector("script[src='" + DOCSPACE_URL + "/static/scripts/sdk/2.0.0/api.js']");
    if (existingScript) {
      console.log("DocSpace SDK script already exists, checking if loaded...");
      if (window.DocSpace?.SDK) {
        console.log("SDK already loaded, initializing...");
        initDocSpace();
      } else {
        console.log("Script exists but SDK not ready, waiting...");
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          console.log("Checking for SDK... attempt " + attempts);
          if (window.DocSpace?.SDK) {
            console.log("SDK now available!");
            clearInterval(checkInterval);
            initDocSpace();
          } else if (attempts >= 20) {
            clearInterval(checkInterval);
            const msg = "SDK script loaded but window.DocSpace not created. Domain may not be whitelisted.";
            console.error(msg);
            setErrorMsg(msg);
            setStatus("error");
            onError?.(msg);
          }
        }, 250);
      }
      return;
    }

    // Load SDK script version 2.0.0
    const script = document.createElement("script");
    script.setAttribute("src", DOCSPACE_URL + "/static/scripts/sdk/2.0.0/api.js");
    
    script.onload = () => {
      console.log("DocSpace SDK 2.0.0 script loaded successfully");
      // Wait for SDK to initialize on window object
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        console.log("Waiting for window.DocSpace... attempt " + attempts);
        if (window.DocSpace?.SDK) {
          console.log("window.DocSpace.SDK is now available!");
          clearInterval(checkInterval);
          initDocSpace();
        } else if (attempts >= 20) {
          clearInterval(checkInterval);
          const msg = "SDK script loaded but window.DocSpace not created. Your domain (http://localhost:3002) must be whitelisted in DocSpace → Settings → Developer Tools → JavaScript SDK";
          console.error(msg);
          setErrorMsg(msg);
          setStatus("error");
          onError?.(msg);
        }
      }, 250);
    };
    
    script.onerror = (e) => {
      console.error("Failed to load DocSpace SDK script:", e);
      setErrorMsg("Failed to load DocSpace SDK script from server");
      setStatus("error");
      onError?.("Failed to load DocSpace SDK script");
    };
    
    document.body.appendChild(script);
    console.log("DocSpace SDK script tag added to document");

    return () => {
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      if (instanceRef.current?.destroyFrame) {
        try {
          instanceRef.current.destroyFrame();
        } catch (e) {
          console.error("Error destroying DocSpace frame:", e);
        }
      }
    };
  }, [onError, onFileSelect]);

  if (status === "auth_required") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-2">DocSpace Authentication Failed</h3>
              <p className="text-sm text-red-700 mb-3">{errorMsg}</p>
              
              <div className="bg-white/70 rounded p-4 text-xs space-y-3 mb-4">
                <div>
                  <p className="font-semibold text-red-900 mb-1">⚙️ Configuration Required:</p>
                  <p className="text-red-800">Add your DocSpace credentials to the environment variables:</p>
                  <pre className="bg-red-100 p-2 rounded mt-2 text-red-900">
DOCSPACE_EMAIL=your-email@example.com{"\n"}DOCSPACE_PASSWORD=your-password
                  </pre>
                </div>
                
                <div className="border-t border-red-200 pt-2">
                  <p className="font-semibold text-red-900 mb-1">📍 Where to Add:</p>
                  <ul className="list-disc list-inside space-y-1 text-red-800 ml-2">
                    <li>Local: Add to <code className="bg-red-100 px-1 rounded">.env.local</code> file</li>
                    <li>Vercel: Add in Project Settings → Environment Variables</li>
                  </ul>
                </div>
                
                <div className="border-t border-red-200 pt-2">
                  <p className="font-semibold text-red-900 mb-1">🔄 After Adding:</p>
                  <p className="text-red-800">Restart your development server or redeploy to Vercel</p>
                </div>
              </div>
            </div>
          </div>
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

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 mb-2">DocSpace SDK Failed to Load</h3>
              <p className="text-sm text-red-700 mb-3">{errorMsg}</p>
              <div className="bg-white/50 rounded p-3 text-xs space-y-2">
                <p className="font-semibold text-red-800">Domain Whitelist Issue:</p>
                <p className="text-red-700 mb-2">The DocSpace SDK script loads but <code className="bg-red-100 px-1">window.DocSpace</code> is not being created. This happens when your domain is not whitelisted.</p>
                <ol className="list-decimal list-inside space-y-1 text-red-700">
                  <li>Open DocSpace: <a href="https://docspace-hm9cxt.onlyoffice.com" target="_blank" className="underline font-semibold">https://docspace-hm9cxt.onlyoffice.com</a></li>
                  <li>Go to: <strong>Settings → Developer Tools → JavaScript SDK</strong></li>
                  <li>In the "Add the allowed domains" field, add: <code className="bg-red-100 px-1 rounded font-semibold">http://localhost:3002</code></li>
                  <li>Click the <strong>+</strong> button to add it</li>
                  <li>Verify <code className="bg-red-100 px-1 rounded">https://aestheticclinic.vercel.app</code> is also listed</li>
                  <li><strong>Important:</strong> Make sure there are NO extra characters (no trailing slashes, no paths)</li>
                  <li>Click Save</li>
                  <li>Come back here and refresh the page (Ctrl+R or Cmd+R)</li>
                </ol>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                  <p className="text-yellow-800 font-semibold">⚠️ Common Issues:</p>
                  <ul className="list-disc list-inside text-yellow-700 text-xs mt-1">
                    <li>Domain must be <strong>exact</strong>: <code>http://localhost:3002</code> (not 3000, not with /)</li>
                    <li>No trailing slash at the end</li>
                    <li>Include the protocol (http:// or https://)</li>
                    <li>After adding, wait 10-15 seconds before refreshing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
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
