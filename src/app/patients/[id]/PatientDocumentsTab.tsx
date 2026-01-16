"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import BeforeAfterEditorModal from "./BeforeAfterEditorModal";
import PdfAnnotationEditor from "@/components/PdfAnnotationEditor";
import DocumentTemplatesPanel from "@/components/DocumentTemplatesPanel";
import dynamic from 'next/dynamic';

// Dynamic import for docx-preview (client-side only)
const DocxPreview = dynamic(() => import('@/components/DocxPreview'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div></div>
});

interface PatientDocumentsTabProps {
  patientId: string;
  patientName?: string;
}

const BUCKET_NAME = "patient-documents";

interface StorageItem {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
    [key: string]: any;
  } | null;
}

interface ListedItem extends StorageItem {
  kind: "file" | "folder";
  path: string;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function getExtension(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

function formatUploadDate(dateString: string | undefined | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMimeType(name: string, metadata?: { mimetype?: string } | null): string {
  if (metadata?.mimetype) return metadata.mimetype;
  const ext = getExtension(name);
  if (ext === "pdf") return "application/pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return `image/${ext === "jpg" ? "jpeg" : ext}`;
  }
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return `video/${ext}`;
  return "";
}

export default function PatientDocumentsTab({
  patientId,
  patientName = "Patient",
}: PatientDocumentsTabProps) {
  const [items, setItems] = useState<ListedItem[]>([]);
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<ListedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showBeforeAfterEditor, setShowBeforeAfterEditor] = useState(false);
  const [showPdfEditor, setShowPdfEditor] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [renamingFile, setRenamingFile] = useState<ListedItem | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; size: number }[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"uploading" | "success" | "error">("uploading");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);

  // New state for Documents features
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ url: string; name: string; mimeType: string; uploadedAt: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setError(null);

      const folderPath = [patientId, currentPrefix]
        .filter(Boolean)
        .join("/");

      const listPath = folderPath === "" ? undefined : folderPath;

      const { data, error: listError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .list(listPath, {
          limit: 200,
          offset: 0,
          sortBy: { column: "name", order: "asc" },
        });

      if (cancelled) return;

      if (listError) {
        setError(listError.message ?? "Failed to load documents.");
        setItems([]);
        setSelectedFile(null);
        setLoading(false);
        return;
      }

      const folders: Record<string, ListedItem> = {};
      const files: ListedItem[] = [];

      for (const raw of data ?? []) {
        const base: StorageItem = {
          name: raw.name,
          id: (raw as any).id,
          updated_at: (raw as any).updated_at,
          created_at: (raw as any).created_at,
          metadata: (raw as any).metadata ?? null,
        };

        if (raw.name === ".keep") {
          continue;
        }

        if (raw.name.includes("/")) {
          const [folderName] = raw.name.split("/");

          if (!folderName) continue;

          const folderPathRelative = `${currentPrefix}${folderName}/`;

          if (!folders[folderName]) {
            folders[folderName] = {
              ...base,
              name: folderName,
              kind: "folder",
              path: folderPathRelative,
            };
          }

          continue;
        }

        files.push({
          ...base,
          kind: "file",
          path: `${currentPrefix}${raw.name}`,
        });
      }

      const combined: ListedItem[] = [
        ...Object.values(folders).sort((a, b) => a.name.localeCompare(b.name)),
        ...files,
      ];

      // Sort files based on sortBy and sortOrder
      combined.sort((a, b) => {
        // Folders always come first
        if (a.kind === "folder" && b.kind !== "folder") return -1;
        if (a.kind !== "folder" && b.kind === "folder") return 1;
        if (a.kind === "folder" && b.kind === "folder") {
          return a.name.localeCompare(b.name);
        }
        // Sort files
        if (sortBy === "date") {
          const aDate = a.updated_at || a.created_at || "";
          const bDate = b.updated_at || b.created_at || "";
          const comparison = aDate.localeCompare(bDate);
          return sortOrder === "desc" ? -comparison : comparison;
        }
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === "desc" ? -comparison : comparison;
      });

      setItems(combined);

      if (!selectedFile) {
        const firstFile = combined.find((item) => item.kind === "file") ?? null;
        setSelectedFile(firstFile ?? null);
      }

      setLoading(false);
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [patientId, currentPrefix, selectedFile, refreshKey]);

  const breadcrumbSegments = useMemo(() => {
    const segments = currentPrefix.split("/").filter(Boolean);
    const result: { label: string; path: string }[] = [];

    let accumulated = "";
    for (const segment of segments) {
      accumulated = `${accumulated}${segment}/`;
      result.push({ label: segment, path: accumulated });
    }

    return result;
  }, [currentPrefix]);

  // Filtered and searched items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Type filter (only for files)
      if (filterType !== "all" && item.kind === "file") {
        const ext = getExtension(item.name);
        if (filterType === "images") {
          if (!["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
            return false;
          }
        } else if (filterType === "documents") {
          if (!["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) {
            return false;
          }
        } else if (filterType === "videos") {
          if (!["mp4", "webm", "ogg", "mov", "avi"].includes(ext)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [items, searchQuery, filterType]);

  // Paginated items
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage, ITEMS_PER_PAGE]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, sortBy, sortOrder]);

  // Get unique file types for filter dropdown
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    items.forEach((item) => {
      if (item.kind === "file") {
        const ext = getExtension(item.name);
        if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
          types.add("images");
        } else if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) {
          types.add("documents");
        } else if (["mp4", "webm", "ogg", "mov", "avi"].includes(ext)) {
          types.add("videos");
        }
      }
    });
    return Array.from(types);
  }, [items]);

  const beforeAfterImages = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.kind === "file" &&
            ["jpg", "jpeg", "png", "gif", "webp"].includes(
              getExtension(item.name),
            ),
        )
        .map((item) => {
          const fullPath = [patientId, item.path].filter(Boolean).join("/");
          const { data } = supabaseClient.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fullPath);
          const url = data.publicUrl ?? null;
          return url
            ? {
                url,
                name: item.name,
                created_at: item.created_at || item.updated_at || undefined,
              }
            : null;
        })
        .filter(
          (image): image is { url: string; name: string; created_at: string | undefined } => image !== null,
        ),
    [items, patientId],
  );

  const selectedFilePreviewUrl = useMemo(() => {
    if (!selectedFile || selectedFile.kind !== "file") return null;

    const fullPath = [patientId, selectedFile.path]
      .filter(Boolean)
      .join("/");

    const { data } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fullPath);

    return data.publicUrl ?? null;
  }, [patientId, selectedFile]);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Initialize upload modal
    setUploadingFiles(fileArray.map(f => ({ name: f.name, size: f.size })));
    setUploadProgress(0);
    setUploadStatus("uploading");
    setUploadError(null);
    setCurrentUploadIndex(0);
    setUploadModalOpen(true);
    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setCurrentUploadIndex(i);
        
        // Simulate progress for current file
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const baseProgress = (i / fileArray.length) * 100;
            const fileProgress = ((prev - baseProgress) < 85) ? prev + Math.random() * 15 : prev;
            return Math.min(fileProgress, baseProgress + 85);
          });
        }, 200);

        const storagePath = [
          patientId,
          currentPrefix ? `${currentPrefix}${file.name}` : file.name,
        ]
          .filter(Boolean)
          .join("/");

        const { error: uploadErr } = await supabaseClient.storage
          .from(BUCKET_NAME)
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        clearInterval(progressInterval);

        if (uploadErr) {
          throw uploadErr;
        }

        // Set progress for completed file
        setUploadProgress(((i + 1) / fileArray.length) * 100);
      }
      
      // Success state
      setUploadProgress(100);
      setUploadStatus("success");
    } catch (err: any) {
      setUploadStatus("error");
      setUploadError(err?.message ?? "Failed to upload file(s).");
      setError(err?.message ?? "Failed to upload file(s).");
    } finally {
      setUploading(false);
      event.target.value = "";
      setSelectedFile(null);
      setRefreshKey((prev) => prev + 1);
    }
  }

  function handleCloseUploadModal() {
    setUploadModalOpen(false);
    setUploadingFiles([]);
    setUploadProgress(0);
    setUploadStatus("uploading");
    setUploadError(null);
    setCurrentUploadIndex(0);
  }

  async function handleCreateFolder(event: React.FormEvent) {
    event.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    setError(null);

    try {
      const safeName = newFolderName.trim().replace(/\/+/, "-");
      const folderPath = `${currentPrefix}${safeName}`;
      const fullPath = [patientId, folderPath, ".keep"].join("/");

      const { error: uploadError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(fullPath, new Blob([""], { type: "text/plain" }), {
          cacheControl: "3600",
          upsert: false,
          contentType: "text/plain",
        });

      if (
        uploadError &&
        uploadError.message &&
        !uploadError.message.includes("The resource already exists")
      ) {
        throw uploadError;
      }

      setNewFolderName("");
      setCreatingFolder(false);
      setSelectedFile(null);
      setCurrentPrefix((prev) => prev);
      setRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create folder.");
      setCreatingFolder(false);
    }
  }

  function handleOpenFolder(item: ListedItem) {
    if (item.kind !== "folder") return;
    setCurrentPrefix(item.path);
    setSelectedFile(null);
  }

  function handleSelectFile(item: ListedItem) {
    if (item.kind !== "file") return;
    setSelectedFile(item);
  }

  function handleStartRename(item: ListedItem) {
    setRenamingFile(item);
    setNewFileName(item.name);
  }

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    if (!renamingFile || !newFileName.trim() || renaming) return;

    const trimmedName = newFileName.trim();
    if (trimmedName === renamingFile.name) {
      setRenamingFile(null);
      return;
    }

    try {
      setRenaming(true);
      setError(null);

      const oldPath = [patientId, renamingFile.path].filter(Boolean).join("/");
      const newPath = [patientId, currentPrefix, trimmedName].filter(Boolean).join("/");

      // Download the file
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .download(oldPath);

      if (downloadError) throw downloadError;

      // Upload with new name
      const { error: uploadError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(newPath, fileData, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Delete old file
      const { error: deleteError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .remove([oldPath]);

      if (deleteError) {
        console.error("Failed to delete old file:", deleteError);
      }

      setRenamingFile(null);
      setNewFileName("");
      setSelectedFile(null);
      setRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      setError(err?.message ?? "Failed to rename file.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteFile(item: ListedItem) {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      setError(null);
      const fullPath = [patientId, item.path].filter(Boolean).join("/");

      const { error: deleteError } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .remove([fullPath]);

      if (deleteError) throw deleteError;

      if (selectedFile?.path === item.path) {
        setSelectedFile(null);
      }
      setRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete file.");
    }
  }

  const selectedMimeType = (() => {
    if (!selectedFile || selectedFile.kind !== "file") return "";
    const fromMeta = selectedFile.metadata?.mimetype;
    if (fromMeta) return fromMeta;
    const ext = getExtension(selectedFile.name);
    if (ext === "pdf") return "application/pdf";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return `image/${ext === "jpg" ? "jpeg" : ext}`;
    }
    if (["mp4", "webm", "ogg"].includes(ext)) return `video/${ext}`;
    return "";
  })();

  const isImage = selectedMimeType.startsWith("image/");
  const isPdf = selectedMimeType === "application/pdf";
  const isVideo = selectedMimeType.startsWith("video/");

  return (
    <>
      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        {/* File Storage Only - No Tabs */}
        {/* Files View Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">File Storage</h3>
            <p className="mt-1 text-xs text-slate-500">
              Store, organise, and preview files for this patient.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={handleCreateFolder} className="flex items-center gap-1 text-xs">
              <input
                type="text"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="New folder"
                className="h-7 rounded-full border border-slate-200 px-2 text-[11px] focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
              <button
                type="submit"
                className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={creatingFolder || !newFolderName.trim()}
              >
                New folder
              </button>
            </form>
            <label className="inline-flex h-8 cursor-pointer items-center rounded-full border border-sky-500 bg-sky-500 px-3 text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)] hover:bg-sky-600">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              {uploading ? "Uploading…" : "Upload"}
            </label>
            <button
              type="button"
              onClick={() => setShowBeforeAfterEditor(true)}
              className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Before / After
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="inline-flex h-8 items-center rounded-full border border-emerald-500 bg-emerald-500 px-3 text-[11px] font-semibold text-white hover:bg-emerald-600"
            >
              Create from Template
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-1 text-[11px] text-slate-500">
          <button
            type="button"
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              breadcrumbSegments.length === 0
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "hover:bg-slate-100 border border-transparent"
            }`}
            onClick={() => {
              setCurrentPrefix("");
              setSelectedFile(null);
            }}
          >
            Root
          </button>
          {breadcrumbSegments.map((segment, index) => (
            <div key={segment.path} className="flex items-center gap-1">
              <span className="text-slate-400">/</span>
              <button
                type="button"
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  index === breadcrumbSegments.length - 1
                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                    : "hover:bg-slate-100 border border-transparent"
                }`}
                onClick={() => {
                  setCurrentPrefix(segment.path);
                  setSelectedFile(null);
                }}
              >
                {segment.label}
              </button>
            </div>
          ))}
        </div>

        {error ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {error}
          </div>
        ) : null}

        {/* Search, Sort, and Filter Controls */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* Text Search */}
          <div className="relative flex-1 min-w-[150px] max-w-[250px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="h-7 w-full rounded-full border border-slate-200 pl-8 pr-3 text-[11px] focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
            <svg
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-500">Sort:</span>
            <button
              type="button"
              onClick={() => setSortBy("name")}
              className={`rounded-full px-2 py-0.5 ${
                sortBy === "name"
                  ? "bg-sky-100 text-sky-700 border border-sky-200"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Name
            </button>
            <button
              type="button"
              onClick={() => setSortBy("date")}
              className={`rounded-full px-2 py-0.5 ${
                sortBy === "date"
                  ? "bg-sky-100 text-sky-700 border border-sky-200"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Date
            </button>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-100"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>

          {/* Filter by Type */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-500">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-7 rounded-full border border-slate-200 px-2 text-[11px] focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              <option value="all">All</option>
              <option value="images">Images</option>
              <option value="documents">Documents</option>
              <option value="videos">Videos</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Items ({filteredItems.length}){totalPages > 1 ? ` • Page ${currentPage} of ${totalPages}` : ""}</span>
              {loading ? <span className="text-slate-400">Loading…</span> : null}
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2">
              {filteredItems.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-[11px] text-slate-500">
                  No documents yet. Use the Upload button to add files.
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedItems.map((item) => {
                    const isSelected =
                      item.kind === "file" && selectedFile && selectedFile.path === item.path;

                    if (item.kind === "folder") {
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => handleOpenFolder(item)}
                          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] hover:border-sky-300 hover:bg-sky-50/60 transition-all"
                        >
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600 shadow-sm">
                            <svg
                              viewBox="0 0 20 20"
                              className="h-5 w-5"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M3 5a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" />
                            </svg>
                          </span>
                          <span className="truncate font-medium text-slate-700">{item.name}</span>
                        </button>
                      );
                    }

                    const fullPath = [patientId, item.path]
                      .filter(Boolean)
                      .join("/");

                    const { data } = supabaseClient.storage
                      .from(BUCKET_NAME)
                      .getPublicUrl(fullPath);

                    const thumbUrl = data.publicUrl;
                    const ext = getExtension(item.name);
                    const isImageThumb = [
                      "jpg",
                      "jpeg",
                      "png",
                      "gif",
                      "webp",
                    ].includes(ext);
                    const uploadDate = item.created_at || item.updated_at;
                    const mimeType = getMimeType(item.name, item.metadata);

                    return (
                      <div
                        key={item.path}
                        className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[11px] cursor-pointer transition-all ${
                          isSelected
                            ? "border-sky-400 bg-gradient-to-r from-sky-50 to-white shadow-[0_0_0_1px_rgba(56,189,248,0.4)]"
                            : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/60 hover:shadow-sm"
                        }`}
                        onClick={() => handleSelectFile(item)}
                      >
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                          {isImageThumb && thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 text-[10px] font-bold text-slate-600">
                              {ext ? ext.toUpperCase() : "FILE"}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-slate-800">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-slate-500">
                              {formatFileSize((item.metadata as any)?.size)}
                            </p>
                            {uploadDate && (
                              <>
                                <span className="text-slate-300">•</span>
                                <p className="text-[10px] text-slate-400">
                                  {formatUploadDate(uploadDate)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Preview button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewModal({
                              url: thumbUrl,
                              name: item.name,
                              mimeType,
                              uploadedAt: uploadDate || null,
                            });
                          }}
                          className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-colors"
                          title="Preview"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </button>
                        {/* Action buttons - show on hover */}
                        <div className="flex-shrink-0 hidden group-hover:flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(item);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            title="Rename"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(item);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-medium transition-colors ${
                        currentPage === page
                          ? "bg-sky-500 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Preview</span>
              {selectedFile && selectedFile.kind === "file" ? (
                <span className="truncate text-[10px] text-slate-400">
                  {selectedFile.name}
                </span>
              ) : null}
            </div>

            <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              {!selectedFile || selectedFile.kind !== "file" ? (
                <p className="text-[11px] text-slate-500">
                  Select a file from the list to see a larger preview.
                </p>
              ) : !selectedFilePreviewUrl ? (
                <p className="text-[11px] text-slate-500">
                  Unable to generate a preview URL for this file.
                </p>
              ) : isImage ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedFilePreviewUrl}
                    alt={selectedFile.name}
                    className="max-h-[360px] w-auto max-w-full rounded-md border border-slate-200 bg-slate-100 object-contain cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => setEnlargedImage({ url: selectedFilePreviewUrl, name: selectedFile.name })}
                  />
                  <button
                    type="button"
                    onClick={() => setEnlargedImage({ url: selectedFilePreviewUrl, name: selectedFile.name })}
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    Enlarge
                  </button>
                </div>
              ) : isPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <iframe
                    src={selectedFilePreviewUrl}
                    className="h-[320px] w-full rounded-md border border-slate-200 bg-white"
                    title={selectedFile.name}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPdfEditor(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow hover:bg-sky-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit PDF
                  </button>
                </div>
              ) : isVideo ? (
                <video
                  src={selectedFilePreviewUrl}
                  controls
                  className="h-[320px] w-full rounded-md border border-slate-200 bg-black object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[11px] text-slate-500">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                    {getExtension(selectedFile.name).toUpperCase() || "FILE"}
                  </div>
                  <p className="max-w-xs text-center">
                    Preview is not available for this file type. You can download it to
                    view it.
                  </p>
                  <a
                    href={selectedFilePreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Template Selection Modal */}
      {showTemplateModal && (
        <DocumentTemplatesPanel 
          patientId={patientId} 
          patientName={patientName}
          onClose={() => setShowTemplateModal(false)}
          onDocumentCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {showBeforeAfterEditor ? (
        <BeforeAfterEditorModal
          open={showBeforeAfterEditor}
          onClose={() => setShowBeforeAfterEditor(false)}
          patientId={patientId}
          images={beforeAfterImages}
          onError={(message) => setError(message)}
        />
      ) : null}
      {showPdfEditor && selectedFile && isPdf && selectedFilePreviewUrl ? (
        <PdfAnnotationEditor
          open={showPdfEditor}
          onClose={() => setShowPdfEditor(false)}
          pdfUrl={selectedFilePreviewUrl}
          fileName={selectedFile.name}
          onSave={async (blob, newFileName) => {
            // Upload the annotated PDF to storage
            const folderPath = [patientId, currentPrefix].filter(Boolean).join("/");
            const uploadPath = folderPath ? `${folderPath}/${newFileName}` : `${patientId}/${newFileName}`;
            
            const { error: uploadError } = await supabaseClient.storage
              .from(BUCKET_NAME)
              .upload(uploadPath, blob, {
                contentType: "application/pdf",
                upsert: false,
              });
            
            if (uploadError) {
              setError(`Failed to save annotated PDF: ${uploadError.message}`);
              throw uploadError;
            }
            
            // Refresh the file list
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : null}
      {/* Rename Modal */}
      {renamingFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Rename File</h3>
            <form onSubmit={handleRename}>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Enter new file name..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenamingFile(null);
                    setNewFileName("");
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  disabled={renaming}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming || !newFileName.trim()}
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {renaming ? "Renaming..." : "Rename"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {/* Enlarged Image Modal */}
      {enlargedImage ? (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-2 text-center text-sm text-white/80">{enlargedImage.name}</p>
          </div>
        </div>
      ) : null}
      {/* Document Preview Modal */}
      {previewModal ? (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div 
            className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-slate-900">{previewModal.name}</h3>
                {previewModal.uploadedAt && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Uploaded {formatUploadDate(previewModal.uploadedAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={previewModal.url}
                  download={previewModal.name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              <div className="flex items-center justify-center min-h-[400px]">
                {previewModal.mimeType.startsWith("image/") ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewModal.url}
                      alt={previewModal.name}
                      className="max-h-[70vh] max-w-full rounded-xl border border-slate-200 bg-white object-contain shadow-lg"
                    />
                  </div>
                ) : previewModal.mimeType === "application/pdf" ? (
                  <iframe
                    src={previewModal.url}
                    className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white shadow-lg"
                    title={previewModal.name}
                  />
                ) : previewModal.mimeType.startsWith("video/") ? (
                  <video
                    src={previewModal.url}
                    controls
                    className="max-h-[70vh] max-w-full rounded-xl border border-slate-200 bg-black shadow-lg"
                  />
                ) : previewModal.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                     previewModal.name.toLowerCase().endsWith('.docx') ? (
                  <div className="w-full max-w-4xl">
                    <DocxPreview url={previewModal.url} fileName={previewModal.name} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-lg font-bold text-slate-600">
                      {getExtension(previewModal.name).toUpperCase() || "FILE"}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">Preview not available</p>
                      <p className="mt-1 text-[11px] text-slate-500">Download the file to view its contents</p>
                    </div>
                    <a
                      href={previewModal.url}
                      download={previewModal.name}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {/* File Upload Progress Modal */}
      {uploadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-500 to-sky-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                {uploadStatus === "uploading" && "Uploading Files..."}
                {uploadStatus === "success" && "Upload Complete!"}
                {uploadStatus === "error" && "Upload Failed"}
              </h3>
              <p className="text-sm text-sky-100 mt-0.5">
                {uploadStatus === "uploading" && `${currentUploadIndex + 1} of ${uploadingFiles.length} file${uploadingFiles.length > 1 ? 's' : ''}`}
                {uploadStatus === "success" && `${uploadingFiles.length} file${uploadingFiles.length > 1 ? 's' : ''} uploaded successfully`}
                {uploadStatus === "error" && "An error occurred during upload"}
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* File List */}
              <div className="mb-4 max-h-32 overflow-auto">
                {uploadingFiles.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`} 
                    className={`flex items-center gap-3 py-2 ${index !== uploadingFiles.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className="flex-shrink-0">
                      {uploadStatus === "success" || (uploadStatus === "uploading" && index < currentUploadIndex) ? (
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : uploadStatus === "uploading" && index === currentUploadIndex ? (
                        <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-sky-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      ) : uploadStatus === "error" && index === currentUploadIndex ? (
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Progress</span>
                  <span className="text-xs font-semibold text-slate-800">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      uploadStatus === "success" 
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                        : uploadStatus === "error"
                        ? "bg-gradient-to-r from-red-500 to-red-400"
                        : "bg-gradient-to-r from-sky-500 to-sky-400"
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>

              {/* Status Message */}
              {uploadStatus === "success" && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
                  <svg className="h-5 w-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-emerald-700">All files have been uploaded successfully!</p>
                </div>
              )}

              {uploadStatus === "error" && uploadError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <svg className="h-5 w-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {uploadStatus === "uploading" && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 mb-4">
                  <svg className="h-5 w-5 text-sky-600 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-sky-700">Please wait while your files are being uploaded...</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseUploadModal}
                disabled={uploadStatus === "uploading"}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  uploadStatus === "uploading"
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : uploadStatus === "success"
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-slate-800 text-white hover:bg-slate-700"
                }`}
              >
                {uploadStatus === "uploading" ? "Uploading..." : "Close"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
