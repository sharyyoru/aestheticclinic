"use client";

import { useState, useEffect, useCallback } from "react";
import DocumentEditor from "./DocumentEditor";
import DocSpaceEditor from "./DocSpaceEditor";

type Template = {
  id: string;
  name: string;
  description?: string;
  file_path: string;
  file_type: string;
  category?: string;
  storage_only?: boolean;
};

type DocSpaceDocument = {
  fileId?: string;
  title: string;
  mode: "editor" | "viewer" | "manager";
} | null;

type PatientDocument = {
  id: string;
  patient_id: string;
  template_id?: string;
  title: string;
  content: string;
  status: "draft" | "final" | "signed" | "archived";
  version: number;
  created_by_name?: string;
  last_edited_at?: string;
  created_at: string;
  updated_at: string;
  template?: {
    id: string;
    name: string;
    category?: string;
  };
};

type DocumentTemplatesPanelProps = {
  patientId: string;
  patientName: string;
};

export default function DocumentTemplatesPanel({
  patientId,
  patientName,
}: DocumentTemplatesPanelProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"documents" | "templates">("documents");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDocument, setEditingDocument] = useState<PatientDocument | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [docSpaceDoc, setDocSpaceDoc] = useState<DocSpaceDocument>(null);
  const [isLoadingDocSpace, setIsLoadingDocSpace] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/templates?search=${encodeURIComponent(templateSearch)}`);
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }, [templateSearch]);

  // Fetch patient documents
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/patient?patientId=${patientId}&search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (showTemplateModal) {
      fetchTemplates();
    }
  }, [showTemplateModal, fetchTemplates]);

  // Create new document from template
  const handleCreateFromTemplate = async (template: Template) => {
    setIsCreating(true);
    try {
      // First, fetch the template content (convert DOCX to HTML)
      let templateContent = "";
      if (template.file_path) {
        try {
          const contentRes = await fetch(
            `/api/documents/templates/content?filePath=${encodeURIComponent(template.file_path)}`
          );
          const contentData = await contentRes.json();
          if (contentRes.ok && contentData.content) {
            templateContent = contentData.content;
            console.log("Template content loaded successfully, length:", templateContent.length);
          } else {
            console.error("Failed to fetch template content:", contentData.error || "Unknown error");
          }
        } catch (fetchError) {
          console.error("Error fetching template content:", fetchError);
        }
      }

      // Create the document with the template content
      const res = await fetch("/api/documents/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          templateId: template.storage_only ? null : template.id,
          title: `${template.name} - ${patientName}`,
          content: templateContent || "<p></p>",
        }),
      });

      const data = await res.json();
      if (data.document) {
        setShowTemplateModal(false);
        setEditingDocument(data.document);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error creating document:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Open template in DocSpace for 100% accurate editing
  const handleOpenInDocSpace = async (template: Template) => {
    setIsLoadingDocSpace(true);
    try {
      // Open DocSpace manager to browse and edit documents
      setDocSpaceDoc({
        title: `${template.name} - ${patientName}`,
        mode: "manager", // Opens file browser where user can select/edit files
      });
      setShowTemplateModal(false);
    } catch (error) {
      console.error("Error opening DocSpace:", error);
      alert("Failed to open document editor.");
    } finally {
      setIsLoadingDocSpace(false);
    }
  };

  // Create blank document
  const handleCreateBlank = async () => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/documents/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          title: `New Document - ${patientName}`,
          content: "<p></p>",
        }),
      });

      const data = await res.json();
      if (data.document) {
        setShowTemplateModal(false);
        setEditingDocument(data.document);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error creating document:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Save document
  const handleSaveDocument = async (content: string, status?: string) => {
    if (!editingDocument) return;

    const res = await fetch("/api/documents/patient", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: editingDocument.id,
        content,
        title: editingDocument.title,
        status,
      }),
    });

    const data = await res.json();
    if (data.document) {
      setEditingDocument(data.document);
      fetchDocuments();
    }
  };

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await fetch(`/api/documents/patient?documentId=${documentId}`, {
        method: "DELETE",
      });
      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  // If editing a document, show the editor
  if (editingDocument) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <DocumentEditor
          documentId={editingDocument.id}
          initialContent={editingDocument.content || ""}
          title={editingDocument.title}
          status={editingDocument.status}
          onTitleChange={(title) => setEditingDocument({ ...editingDocument, title })}
          onSave={handleSaveDocument}
          onClose={() => {
            setEditingDocument(null);
            fetchDocuments();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Document
        </button>
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg className="h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-500 mb-2">No documents yet</p>
          <p className="text-sm text-slate-400 mb-4">Create a document from a template or start from scratch</p>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            Create First Document
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-200 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setEditingDocument(doc)}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  doc.status === "draft" ? "bg-amber-100 text-amber-600" :
                  doc.status === "final" ? "bg-emerald-100 text-emerald-600" :
                  doc.status === "signed" ? "bg-sky-100 text-sky-600" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 group-hover:text-sky-600 transition-colors">
                    {doc.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      doc.status === "draft" ? "bg-amber-100 text-amber-700" :
                      doc.status === "final" ? "bg-emerald-100 text-emerald-700" :
                      doc.status === "signed" ? "bg-sky-100 text-sky-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                    <span>•</span>
                    <span>v{doc.version}</span>
                    {doc.template && (
                      <>
                        <span>•</span>
                        <span>From: {doc.template.name}</span>
                      </>
                    )}
                    {doc.last_edited_at && (
                      <>
                        <span>•</span>
                        <span>Edited {new Date(doc.last_edited_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDocument(doc);
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                  title="Edit"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(doc.id);
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Create New Document</h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Blank document option */}
              <button
                onClick={handleCreateBlank}
                disabled={isCreating}
                className="mb-4 flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 p-4 text-left hover:border-sky-400 hover:bg-sky-50 transition-colors disabled:opacity-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Blank Document</h3>
                  <p className="text-sm text-slate-500">Start from scratch with an empty document</p>
                </div>
              </button>

              {/* Template search */}
              <div className="mb-4">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Templates list */}
              <div className="max-h-80 overflow-y-auto space-y-2">
                {templates.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No templates found. Upload templates to the "templates" bucket in Supabase.
                  </p>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate text-sm">{template.name}</h3>
                        <p className="text-xs text-slate-500">
                          {template.file_type.toUpperCase()}
                          {template.category && ` • ${template.category}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenInDocSpace(template)}
                          disabled={isLoadingDocSpace}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                          title="Open with full formatting (OnlyOffice)"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Full Editor
                        </button>
                        <button
                          onClick={() => handleCreateFromTemplate(template)}
                          disabled={isCreating}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                          title="Quick edit (basic formatting)"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Quick Edit
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DocSpace Editor Modal */}
      {docSpaceDoc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDocSpaceDoc(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div>
                <h2 className="font-semibold text-slate-900">{docSpaceDoc.title}</h2>
                <p className="text-xs text-slate-500">Editing with DocSpace - Full formatting preserved</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                DocSpace Editor
              </span>
            </div>
          </div>
          <div className="flex-1">
            <DocSpaceEditor
              docSpaceUrl={process.env.NEXT_PUBLIC_DOCSPACE_URL || "https://docspace-hm9cxt.onlyoffice.com"}
              mode={docSpaceDoc.mode}
              fileId={docSpaceDoc.fileId}
              onClose={() => setDocSpaceDoc(null)}
              onError={(error: string) => console.error("DocSpace error:", error)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
