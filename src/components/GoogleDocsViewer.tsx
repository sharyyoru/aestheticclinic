"use client";

import { useState, useEffect } from "react";

type GoogleDocsViewerProps = {
  documentId: string;
  onClose: () => void;
};

export default function GoogleDocsViewer({
  documentId,
  onClose,
}: GoogleDocsViewerProps) {
  const [googleDocUrl, setGoogleDocUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadGoogleDoc();
  }, [documentId]);

  const loadGoogleDoc = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Fetch the document to get Google Doc ID
      const res = await fetch(`/api/documents/patient/${documentId}`);
      const data = await res.json();

      if (data.document?.google_doc_id) {
        // Open existing Google Doc
        setGoogleDocUrl(`https://docs.google.com/document/d/${data.document.google_doc_id}/edit`);
      } else {
        // Create new Google Doc from template
        const createRes = await fetch(`/api/documents/google/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            title: data.document?.title || "Untitled Document",
            templatePath: data.document?.template_path || null,
            patientId: data.document?.patient_id,
          }),
        });

        const createData = await createRes.json();
        if (createData.googleDocId) {
          setGoogleDocUrl(`https://docs.google.com/document/d/${createData.googleDocId}/edit`);
        } else {
          setError(createData.error || "Failed to create Google Doc");
        }
      }
    } catch (err) {
      console.error("Error loading Google Doc:", err);
      setError("Failed to load document");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Get Google Doc ID from URL
      const match = googleDocUrl.match(/\/document\/d\/([^\/]+)/);
      if (!match) return;

      const googleDocId = match[1];

      // Fetch patient ID
      const res = await fetch(`/api/documents/patient/${documentId}`);
      const data = await res.json();

      // Save Google Doc back to Supabase
      const saveRes = await fetch(`/api/documents/google/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          googleDocId,
          patientId: data.document?.patient_id,
        }),
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        alert("Document saved successfully!");
      } else {
        alert(`Failed to save: ${saveData.error}`);
      }
    } catch (err) {
      console.error("Error saving document:", err);
      alert("Failed to save document");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm text-slate-600">Loading Google Docs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-red-50">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">Google Docs Editor</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Save to System
          </button>
          <a
            href={googleDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open in New Tab
          </a>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* Google Docs iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={googleDocUrl}
          className="h-full w-full border-0"
          title="Google Docs Editor"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
