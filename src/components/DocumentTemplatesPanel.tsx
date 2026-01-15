"use client";

import { useState, useEffect, useCallback } from "react";
import OnlyOfficeEditor from "./OnlyOfficeEditor";

type Template = {
  id: string;
  name: string;
  description?: string;
  file_path: string;
  file_type: string;
  category?: string;
  storage_only?: boolean;
};

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

type OnlyOfficeDoc = {
  url: string;
  key: string;
  title: string;
  fileType: string;
} | null;

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
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [onlyOfficeDoc, setOnlyOfficeDoc] = useState<OnlyOfficeDoc>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

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

  // Open template in OnlyOffice editor
  const handleOpenTemplate = async (template: Template) => {
    setIsLoadingTemplate(true);
    try {
      // Get signed URL from Supabase for OnlyOffice to access
      const res = await fetch(
        `/api/documents/onlyoffice/url?filePath=${encodeURIComponent(template.file_path)}&bucket=templates`
      );
      const data = await res.json();
      
      if (data.url) {
        setOnlyOfficeDoc({
          url: data.url,
          key: data.key,
          title: `${template.name} - ${patientName}`,
          fileType: data.fileType || "docx",
        });
        setShowTemplateModal(false);
      } else {
        console.error("Failed to get document URL:", data.error);
        alert("Failed to open template. Please try again.");
      }
    } catch (error) {
      console.error("Error opening template:", error);
      alert("Failed to open template.");
    } finally {
      setIsLoadingTemplate(false);
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

  // OnlyOffice full screen editor
  if (onlyOfficeDoc) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOnlyOfficeDoc(null)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h2 className="font-semibold text-slate-900">{onlyOfficeDoc.title}</h2>
              <p className="text-xs text-slate-500">Full document editing with 100% formatting preserved</p>
            </div>
          </div>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
            OnlyOffice Editor
          </span>
        </div>
        <div className="flex-1">
          <OnlyOfficeEditor
            documentUrl={onlyOfficeDoc.url}
            documentKey={onlyOfficeDoc.key}
            documentTitle={onlyOfficeDoc.title}
            fileType={onlyOfficeDoc.fileType}
            mode="edit"
            onClose={() => setOnlyOfficeDoc(null)}
            onError={(error: string) => console.error("OnlyOffice error:", error)}
          />
        </div>
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
          <p className="text-sm text-slate-400 mb-4">Select a template to create and edit documents with full formatting</p>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            Select a Template
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-200 hover:shadow-md transition-all"
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
                  <h3 className="font-medium text-slate-900">
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
                  onClick={() => handleDeleteDocument(doc.id)}
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

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Create New Document</h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info box */}
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
                <p className="text-sm text-sky-800">
                  <strong>Note:</strong> Templates are stored in Supabase and opened with OnlyOffice for 100% accurate editing.
                  {!process.env.NEXT_PUBLIC_ONLYOFFICE_URL && (
                    <span className="block mt-1 text-xs text-sky-600">
                      Requires OnlyOffice Document Server running locally (Docker).
                    </span>
                  )}
                </p>
              </div>

              {/* Templates list */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">
                  Select a Template from Supabase
                </h3>
                {templates.length === 0 ? (
                  <div className="py-8 text-center">
                    <svg className="mx-auto h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-slate-500">No templates found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload DOCX templates to the "templates" bucket in Supabase
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleOpenTemplate(template)}
                        disabled={isLoadingTemplate}
                        className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-sky-300 hover:bg-sky-50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 text-sm truncate">{template.name}</h4>
                          <p className="text-xs text-slate-500">
                            {template.file_type.toUpperCase()}
                            {template.category && ` • ${template.category}`}
                          </p>
                        </div>
                        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
