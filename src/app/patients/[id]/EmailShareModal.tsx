"use client";

import { useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";

interface EmailShareModalProps {
  open: boolean;
  onClose: () => void;
  selectedFileCount: number;
  emailSubject: string;
  emailBody: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: (event: React.FormEvent) => void;
  sending: boolean;
  error: string | null;
  patientName: string;
  patientEmail?: string;
  patientId: string;
}

export default function EmailShareModal({
  open,
  onClose,
  selectedFileCount,
  emailSubject,
  emailBody,
  onSubjectChange,
  onBodyChange,
  onSend,
  sending,
  error,
  patientName,
  patientEmail,
  patientId,
}: EmailShareModalProps) {
  const [aiDescription, setAiDescription] = useState("");
  const [aiTone, setAiTone] = useState("professional and reassuring");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleAiGenerate() {
    const description = aiDescription.trim();
    if (!description) {
      setAiError("Please describe the email you want to generate.");
      return;
    }
    try {
      setAiLoading(true);
      setAiError(null);
      const response = await fetch("/api/patients/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, description, tone: aiTone }),
      });
      const data = (await response.json()) as {
        subject?: string;
        body?: string;
        error?: string;
      };
      if (!response.ok) {
        setAiError(data?.error ?? "Failed to generate email.");
        return;
      }
      if (data.subject && data.subject.trim().length > 0) {
        onSubjectChange(data.subject.trim());
      }
      if (data.body && data.body.trim().length > 0) {
        onBodyChange(data.body.trim());
      }
    } catch {
      setAiError("Unexpected error generating email.");
    } finally {
      setAiLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 backdrop-blur-sm py-6 sm:py-8">
      <div className="w-full max-w-2xl mx-4 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 text-xs shadow-[0_24px_60px_rgba(15,23,42,0.65)]">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Share Documents by Email</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Sending {selectedFileCount} file{selectedFileCount > 1 ? "s" : ""} to {patientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSend} className="mt-3 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] text-red-700">{error}</p>
            </div>
          )}

          {/* To */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-700">To</label>
            <input
              type="text"
              value={patientEmail || "Patient's registered email address"}
              readOnly
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600 cursor-default focus:outline-none shadow-sm"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label htmlFor="share-email-subject" className="block text-[11px] font-medium text-slate-700">
              Subject
            </label>
            <input
              id="share-email-subject"
              type="text"
              value={emailSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Your documents from Aesthetic Clinic"
              disabled={sending}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed"
            />
          </div>

          {/* Message */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-700">Message</label>
            <RichTextEditor
              value={emailBody}
              onChange={onBodyChange}
              placeholder={`Hi ${patientName},\n\nPlease find your documents attached below.\n\nBest regards,\nAesthetic Clinic`}
              className="shadow-sm"
            />
          </div>

          {/* Generate with AI */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-[11px] text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">Generate with AI</span>
              <span className="text-[10px] text-slate-400">
                Describe the email you want to send. The patient's details are included automatically.
              </span>
            </div>
            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              rows={3}
              placeholder="Describe the goal, key points, and context for this email..."
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value)}
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="professional and reassuring">Professional & reassuring</option>
                <option value="friendly and informal">Friendly & informal</option>
                <option value="concise and to the point">Concise & to the point</option>
              </select>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiLoading}
                className="inline-flex items-center rounded-full border border-sky-500 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiLoading ? "Generating…" : "Generate with AI"}
              </button>
            </div>
            {aiError && <p className="text-[10px] text-red-600">{aiError}</p>}
          </div>

          {/* Attachment note */}
          <p className="text-[10px] text-slate-400">
            {selectedFileCount} document{selectedFileCount > 1 ? "s" : ""} will be attached directly to this email.
          </p>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                "Send email"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
