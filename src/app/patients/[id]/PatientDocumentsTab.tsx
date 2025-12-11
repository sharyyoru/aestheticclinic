"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import BeforeAfterEditorModal from "./BeforeAfterEditorModal";
import PdfAnnotationEditor from "@/components/PdfAnnotationEditor";

interface PatientDocumentsTabProps {
  patientId: string;
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

export default function PatientDocumentsTab({
  patientId,
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
              }
            : null;
        })
        .filter(
          (image): image is { url: string; name: string } => image !== null,
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

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const storagePath = [
          patientId,
          currentPrefix ? `${currentPrefix}${file.name}` : file.name,
        ]
          .filter(Boolean)
          .join("/");

        const { error: uploadError } = await supabaseClient.storage
          .from(BUCKET_NAME)
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) {
          throw uploadError;
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload file(s).");
    } finally {
      setUploading(false);
      event.target.value = "";
      setSelectedFile(null);
      setRefreshKey((prev) => prev + 1);
    }
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Items</span>
              {loading ? <span className="text-slate-400">Loading…</span> : null}
            </div>
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2">
              {items.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-[11px] text-slate-500">
                  No documents yet. Use the Upload button to add files.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const isSelected =
                      item.kind === "file" && selectedFile && selectedFile.path === item.path;

                    if (item.kind === "folder") {
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => handleOpenFolder(item)}
                          className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[11px] hover:border-sky-300 hover:bg-sky-50/60"
                        >
                          <div className="flex items-center gap-1 text-slate-700">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-sky-100 text-sky-600">
                              <svg
                                viewBox="0 0 20 20"
                                className="h-3.5 w-3.5"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M3 5a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" />
                              </svg>
                            </span>
                            <span className="truncate font-medium">{item.name}</span>
                          </div>
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

                    return (
                      <div
                        key={item.path}
                        className={`group relative flex flex-col gap-1 rounded-lg border px-2 py-2 text-left text-[11px] cursor-pointer ${
                          isSelected
                            ? "border-sky-400 bg-sky-50/70 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]"
                            : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/60"
                        }`}
                        onClick={() => handleSelectFile(item)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                            {isImageThumb && thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumbUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-[10px] font-semibold text-slate-700">
                                {ext ? ext.toUpperCase() : "FILE"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-slate-800">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {formatFileSize((item.metadata as any)?.size)}
                            </p>
                          </div>
                        </div>
                        {/* Action buttons - show on hover */}
                        <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(item);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Rename"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(item);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedFilePreviewUrl}
                  alt={selectedFile.name}
                  className="max-h-[360px] w-auto max-w-full rounded-md border border-slate-200 bg-slate-100 object-contain"
                />
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
    </>
  );
}
