"use client";

import { useEffect, useState } from "react";
import { FileText, Folder, Download, Eye, Trash2, Upload, RefreshCw } from "lucide-react";

const DOCSPACE_URL = process.env.NEXT_PUBLIC_DOCSPACE_URL || "https://docspace-hm9cxt.onlyoffice.com";

interface DocSpaceFile {
  id: string;
  title: string;
  fileType: string;
  contentLength: number;
  created: string;
  updated: string;
  createdBy: { displayName: string };
  webUrl: string;
}

interface DocSpaceFolder {
  id: string;
  title: string;
  filesCount: number;
  foldersCount: number;
  created: string;
  parentId: string;
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
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DocSpaceFile[]>([]);
  const [folders, setFolders] = useState<DocSpaceFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const authenticate = async () => {
    try {
      const response = await fetch("/api/docspace/auth", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to authenticate");
      }
      const data = await response.json();
      if (data.token) {
        setToken(data.token);
        return data.token;
      }
      throw new Error("No token received");
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  };

  const fetchFiles = async (folderId: string | null = null, authToken?: string) => {
    try {
      const tokenToUse = authToken || token;
      if (!tokenToUse) throw new Error("No authentication token");

      const endpoint = folderId
        ? `${DOCSPACE_URL}/api/2.0/files/${folderId}`
        : `${DOCSPACE_URL}/api/2.0/files/@my`;

      const response = await fetch(endpoint, {
        headers: {
          "Authorization": `Bearer ${tokenToUse}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch files");

      const data = await response.json();
      const filesList = data.response?.files || [];
      const foldersList = data.response?.folders || [];

      setFiles(filesList);
      setFolders(foldersList);
      setStatus("ready");
    } catch (error) {
      console.error("Error fetching files:", error);
      setErrorMsg(error instanceof Error ? error.message : "Failed to load files");
      setStatus("error");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFiles(currentFolderId);
    setIsRefreshing(false);
  };

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
    fetchFiles(folderId);
  };

  const handleBackClick = () => {
    setCurrentFolderId(null);
    fetchFiles(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const init = async () => {
      try {
        console.log("🔐 Authenticating with DocSpace...");
        const authToken = await authenticate();
        console.log("✅ Authentication successful");
        console.log("📁 Fetching files...");
        await fetchFiles(null, authToken);
      } catch (error) {
        console.error("❌ Initialization failed:", error);
        setErrorMsg("Failed to initialize DocSpace. Please check credentials.");
        setStatus("error");
        onError?.("Failed to initialize DocSpace");
      }
    };
    init();
  }, []);

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

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm text-slate-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
        <div className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-lg bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={"h-4 w-4 " + (isRefreshing ? "animate-spin" : "")} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {currentFolderId && (
            <button
              onClick={handleBackClick}
              className="mb-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              ← Back to parent folder
            </button>
          )}

          {folders.length === 0 && files.length === 0 && (
            <div className="flex h-full items-center justify-center text-slate-500">
              <p>No documents found</p>
            </div>
          )}

          <div className="space-y-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder.id)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{folder.title}</p>
                    <p className="text-xs text-slate-500">
                      {folder.filesCount} files, {folder.foldersCount} folders
                    </p>
                  </div>
                </div>
              </button>
            ))}

            {files.map((file) => (
              <div
                key={file.id}
                className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{file.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatFileSize(file.contentLength)} • Modified {formatDate(file.updated)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Created by {file.createdBy.displayName}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a
                      href={file.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}
