"use client";

import { useEffect, useState } from "react";
import { getFormById } from "@/lib/formDefinitions";
import { FileText, Eye, Clock, CheckCircle, AlertCircle, Copy, ExternalLink, Send, Trash2, X } from "lucide-react";

type FormSubmission = {
  id: string;
  form_id: string;
  form_name: string;
  status: "pending" | "submitted" | "reviewed";
  submission_data: Record<string, unknown>;
  submitted_at: string | null;
  created_at: string;
  expires_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  formUrl: string | null;
};

type ViewSubmissionModalProps = {
  submission: FormSubmission;
  onClose: () => void;
};

const breastSurgeryFormIdsByLanguage = {
  en: [
    "questionnaire-anesthesie-en",
    "consentement-anesthesie-en",
    "consentement-augmentation-mammaire-en",
    "consentement-eclaire-en",
    "preoperative-instructions-en",
  ],
  fr: [
    "questionnaire-anesthesie-fr",
    "consentement-anesthesie-fr",
    "consentement-augmentation-mammaire-fr",
    "consentement-lift-reduction-fr",
    "consentement-eclaire-fr",
    "consignes-pre-post-op-fr",
  ],
};

const surgeryFormIdsByLanguage = {
  en: [
    "surgery-questionnaire-anesthesie-en",
    "surgery-consentement-anesthesie-en",
    "surgery-consentement-eclaire-en",
    "surgery-preoperative-instructions-en",
  ],
  fr: [
    "surgery-questionnaire-anesthesie-fr",
    "surgery-consentement-anesthesie-fr",
    "surgery-consentement-eclaire-fr",
    "surgery-consentement-eclaire-en",
    "surgery-preoperative-instructions-en",
  ],
};

type BreastFormsSendModalProps = {
  patientId: string;
  patientEmail: string | null;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
};

function BreastFormsSendModal({
  patientId,
  patientEmail,
  patientName,
  onClose,
  onSuccess,
}: BreastFormsSendModalProps) {
  const language: "fr" = "fr";
  const formGroups = [
    {
      title: "Chirurgie mammaire",
      formIds: breastSurgeryFormIdsByLanguage[language],
    },
    {
      title: "Chirurgie",
      formIds: surgeryFormIdsByLanguage[language],
    },
  ].map((group) => ({
    ...group,
    forms: group.formIds
      .map((formId) => getFormById(formId))
      .filter((form): form is NonNullable<ReturnType<typeof getFormById>> => Boolean(form)),
  }));

  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleForm = (formId: string) => {
    setSelectedFormIds((current) =>
      current.includes(formId)
        ? current.filter((id) => id !== formId)
        : [...current, formId]
    );
  };

  const handleSend = async () => {
    if (!patientEmail) {
      setError("This patient does not have an email address.");
      return;
    }

    if (selectedFormIds.length === 0) {
      setError("Select at least one form to send.");
      return;
    }

    try {
      setSending(true);
      setError(null);

      const generatedForms = await Promise.all(
        selectedFormIds.map(async (formId) => {
          const response = await fetch("/api/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, formId }),
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to generate form link");
          }

          const form = getFormById(formId);
          return {
            name: form?.language === "fr" && form.nameFr ? form.nameFr : form?.name || formId,
            url: data.formUrl,
          };
        })
      );

      const formLinks = generatedForms
        .map(({ name, url }) => `
          <p style="margin: 12px 0;">
            <a href="${url}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              ${name}
            </a>
          </p>
        `)
        .join("");

      const greeting = `Bonjour ${patientName},`;
      const intro = "Veuillez compléter les formulaires numériques ci-dessous. Chaque formulaire permet de basculer entre le français et l'anglais si nécessaire.";
      const footer = "Ces liens expirent dans 30 jours.";

      const emailResponse = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: patientEmail,
          subject: "Formulaires de chirurgie à compléter",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
              <h2 style="color: #1e293b;">${greeting}</h2>
              <p style="color: #475569;">${intro}</p>
              <div style="margin: 24px 0;">${formLinks}</div>
              <p style="color: #64748b; font-size: 14px;">${footer}</p>
              <p style="color: #475569;">Aesthetics Clinic</p>
            </div>
          `,
          patientId,
        }),
      });

      const emailData = await emailResponse.json();
      if (!emailResponse.ok) {
        throw new Error(emailData.error || "Failed to send email");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error sending surgery forms:", err);
      setError(err instanceof Error ? err.message : "Failed to send forms");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Send form</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          {formGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {group.title}
                </h3>
                <span className="text-[11px] font-medium text-slate-500">
                  {group.forms.length} forms
                </span>
              </div>
              <div className="space-y-2">
                {group.forms.map((form) => (
                  <label key={form.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-sky-50">
                    <input
                      type="checkbox"
                      checked={selectedFormIds.includes(form.id)}
                      onChange={() => handleToggleForm(form.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {form.language === "fr" && form.nameFr ? form.nameFr : form.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {form.language === "fr" && form.descriptionFr ? form.descriptionFr : form.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            To: {patientEmail || "No email on file"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending..." : "Send email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewSubmissionModal({ submission, onClose }: ViewSubmissionModalProps) {
  const form = getFormById(submission.form_id);
  const data = submission.submission_data;

  const formatValue = (value: unknown): string => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (typeof value === "string" && value.startsWith("data:image")) return "[Signature]";
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{submission.form_name}</h2>
            <p className="text-xs text-slate-500">
              Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {form ? (
          <div className="space-y-6">
            {form.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">
                  {form.language === "fr" && section.titleFr ? section.titleFr : section.title}
                </h3>
                <dl className="space-y-2">
                  {section.fields.map((field) => {
                    const label = form.language === "fr" && field.labelFr ? field.labelFr : field.label;
                    const value = data[field.id];

                    if (field.type === "signature" && typeof value === "string" && value.startsWith("data:image")) {
                      return (
                        <div key={field.id} className="py-2">
                          <dt className="text-xs font-medium text-slate-500">{label}</dt>
                          <dd className="mt-1">
                            <img src={value} alt="Signature" className="h-20 rounded border border-slate-200 bg-white" />
                          </dd>
                        </div>
                      );
                    }

                    return (
                      <div key={field.id} className="flex items-start justify-between gap-4 py-1">
                        <dt className="text-xs font-medium text-slate-500">{label}</dt>
                        <dd className="text-right text-xs text-slate-900">{formatValue(value)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <pre className="text-xs text-slate-700">{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientFormsTab({
  patientId,
  patientEmail,
  patientName,
}: {
  patientId: string;
  patientEmail: string | null;
  patientName: string;
}) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);
  const [showSendBreastFormsModal, setShowSendBreastFormsModal] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [deletingSubmissionIds, setDeletingSubmissionIds] = useState<string[]>([]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/forms/patient?patientId=${patientId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load form submissions");
        setSubmissions([]);
        setLoading(false);
        return;
      }

      setSubmissions(data.submissions || []);
      setSelectedSubmissionIds((current) => {
        const loadedIds = new Set((data.submissions || []).map((submission: FormSubmission) => submission.id));
        return current.filter((id) => loadedIds.has(id));
      });
      setLoading(false);
    } catch (err) {
      console.error("Error loading form submissions:", err);
      setError("Failed to load form submissions");
      setSubmissions([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [patientId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "submitted":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "reviewed":
        return <CheckCircle className="h-4 w-4 text-sky-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "submitted":
        return "Submitted";
      case "reviewed":
        return "Reviewed";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "submitted":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "reviewed":
        return "bg-sky-100 text-sky-700 border-sky-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const toggleSubmissionSelection = (submissionId: string) => {
    setSelectedSubmissionIds((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId]
    );
  };

  const toggleAllSubmissions = () => {
    setSelectedSubmissionIds((current) =>
      current.length === submissions.length ? [] : submissions.map((submission) => submission.id)
    );
  };

  const deleteSubmissionIds = async (submissionIds: string[], confirmationMessage: string) => {
    if (submissionIds.length === 0) return;

    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return;

    try {
      setDeletingSubmissionIds(submissionIds);
      setError(null);

      const params = new URLSearchParams({
        submissionIds: submissionIds.join(","),
        patientId,
      });
      const response = await fetch(`/api/forms/patient?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete form");
        return;
      }

      const deletedIdSet = new Set<string>(data.deletedIds || submissionIds);
      setSubmissions((current) => current.filter((item) => !deletedIdSet.has(item.id)));
      setSelectedSubmissionIds((current) => current.filter((id) => !deletedIdSet.has(id)));
      setViewingSubmission((current) => (current && deletedIdSet.has(current.id) ? null : current));
    } catch (err) {
      console.error("Error deleting form submission:", err);
      setError("Failed to delete form");
    } finally {
      setDeletingSubmissionIds([]);
    }
  };

  const handleDeleteSubmission = (submission: FormSubmission) => {
    deleteSubmissionIds(
      [submission.id],
      `Delete "${submission.form_name}" from this patient's forms?`
    );
  };

  const handleDeleteSelectedSubmissions = () => {
    deleteSubmissionIds(
      selectedSubmissionIds,
      `Delete ${selectedSubmissionIds.length} selected form${selectedSubmissionIds.length === 1 ? "" : "s"} from this patient's forms?`
    );
  };

  const selectedCount = selectedSubmissionIds.length;
  const selectedSubmissionIdSet = new Set(selectedSubmissionIds);
  const deletingSubmissionIdSet = new Set(deletingSubmissionIds);
  const allSubmissionsSelected = submissions.length > 0 && selectedCount === submissions.length;
  const partiallySelected = selectedCount > 0 && !allSubmissionsSelected;
  const isDeleting = deletingSubmissionIds.length > 0;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Patient Forms</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSendBreastFormsModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
          >
            <Send className="h-3.5 w-3.5" />
            Send form
          </button>
          {submissions.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allSubmissionsSelected}
                ref={(input) => {
                  if (input) input.indeterminate = partiallySelected;
                }}
                onChange={toggleAllSubmissions}
                disabled={isDeleting}
                className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              Select all
            </label>
            <button
              type="button"
              onClick={handleDeleteSelectedSubmissions}
              disabled={selectedCount === 0 || isDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting && selectedCount > 0 ? "Deleting..." : `Delete selected${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
            </button>
          </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500"></div>
          <span className="ml-2 text-xs text-slate-500">Loading forms...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && submissions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-12 w-12 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No forms yet</p>
        </div>
      )}

      {!loading && !error && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <label className="flex h-6 items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={selectedSubmissionIdSet.has(submission.id)}
                    onChange={() => toggleSubmissionSelection(submission.id)}
                    disabled={isDeleting}
                    aria-label={`Select ${submission.form_name}`}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-900">{submission.form_name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusColor(submission.status)}`}>
                      {getStatusIcon(submission.status)}
                      {getStatusLabel(submission.status)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>Created {new Date(submission.created_at).toLocaleDateString()}</span>
                    {submission.submitted_at && (
                      <span>• Submitted {new Date(submission.submitted_at).toLocaleDateString()}</span>
                    )}
                    {submission.status === "pending" && (
                      <span className="text-amber-600">
                        Expires {new Date(submission.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {submission.status === "pending" && submission.formUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(submission.formUrl!)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                        title="Copy link"
                      >
                        <Copy className="h-3 w-3" />
                        Copy Link
                      </button>
                      <a
                        href={submission.formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                        title="Open form"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    </>
                  )}
                  {submission.status !== "pending" && (
                    <button
                      type="button"
                      onClick={() => setViewingSubmission(submission)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Eye className="h-3 w-3" />
                      View Response
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteSubmission(submission)}
                    disabled={deletingSubmissionIdSet.has(submission.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Delete form"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deletingSubmissionIdSet.has(submission.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingSubmission && (
        <ViewSubmissionModal
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
        />
      )}

      {showSendBreastFormsModal && (
        <BreastFormsSendModal
          patientId={patientId}
          patientEmail={patientEmail}
          patientName={patientName}
          onClose={() => setShowSendBreastFormsModal(false)}
          onSuccess={loadSubmissions}
        />
      )}
    </div>
  );
}
