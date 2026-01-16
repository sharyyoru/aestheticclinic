"use client";

import { useState, useEffect, useCallback } from "react";
import GoogleDocsViewer from "./GoogleDocsViewer";

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
  const [showEditor, setShowEditor] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<PatientDocument | null>(null);

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

  // Open document in editor
  const handleOpenDocument = (doc: PatientDocument) => {
    setCurrentDocument(doc);
    setShowEditor(true);
  };

  // Save document
  const handleSaveDocument = async (content: string) => {
    if (!currentDocument) return;

    try {
      await fetch(`/api/documents/patient`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: currentDocument.id,
          content,
        }),
      });
      fetchDocuments();
    } catch (error) {
      console.error("Error saving document:", error);
    }
  };

  // Create new document from template
  const handleCreateFromTemplate = async (template: Template) => {
    try {
      // Create document with template reference (template.id is the Google Drive file ID)
      const res = await fetch(`/api/documents/patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          title: template.name,
          templateId: template.id, // Google Drive template file ID
          content: `<p>Template: ${template.name}</p><p>This document will be created in Google Docs from template.</p>`,
        }),
      });
      const data = await res.json();
      if (data.document) {
        setShowTemplateModal(false);
        handleOpenDocument(data.document);
      } else if (data.error) {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error creating document:", error);
      alert("Failed to create document. Please try again.");
    }
  };


  // Show editor fullscreen
  if (showEditor && currentDocument) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <GoogleDocsViewer
          documentId={currentDocument.id}
          onClose={() => {
            setShowEditor(false);
            setCurrentDocument(null);
            fetchDocuments(); // Refresh list when closing
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
                  onClick={(e) => { e.stopPropagation(); handleOpenDocument(doc); }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                  title="Edit document"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
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
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Select a Template</h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <input
                type="text"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-4 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No templates found</p>
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleCreateFromTemplate(template)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                        )}
                        {template.category && (
                          <span className="inline-block mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {template.category}
                          </span>
                        )}
                      </div>
                      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
