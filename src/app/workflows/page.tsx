"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type DealStage = {
  id: string;
  name: string;
  type: string;
  sort_order: number;
};

type WorkflowRow = {
  id: string;
  name: string;
  trigger_type: string;
  active: boolean;
  config: unknown;
};

type WorkflowActionRow = {
  id: string;
  workflow_id: string;
  action_type: string;
  config: unknown;
  sort_order: number;
};

type TemplateVariable = {
  category: string;
  path: string;
  label: string;
};

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { category: "Patient", path: "patient.id", label: "Patient ID" },
  { category: "Patient", path: "patient.first_name", label: "Patient first name" },
  { category: "Patient", path: "patient.last_name", label: "Patient last name" },
  { category: "Patient", path: "patient.email", label: "Patient email" },
  { category: "Patient", path: "patient.phone", label: "Patient phone" },
  { category: "Deal", path: "deal.id", label: "Deal ID" },
  { category: "Deal", path: "deal.title", label: "Deal title" },
  { category: "Deal", path: "deal.pipeline", label: "Deal pipeline" },
  { category: "Deal", path: "deal.notes", label: "Deal notes" },
  { category: "From stage", path: "from_stage.name", label: "From stage name" },
  { category: "From stage", path: "from_stage.type", label: "From stage type" },
  { category: "To stage", path: "to_stage.name", label: "To stage name" },
  { category: "To stage", path: "to_stage.type", label: "To stage type" },
];

const EMAIL_ASSETS_BUCKET = "email-assets";

type TemplateEditorProps = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  variables: TemplateVariable[];
  isHtmlEditor?: boolean;
  highlightVariables?: boolean;
};

function TemplateEditor({
  label,
  description,
  value,
  onChange,
  rows = 6,
  variables,
  isHtmlEditor = false,
  highlightVariables = true,
}: TemplateEditorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function updateSelectionFromEvent(event: any) {
    const target = event.currentTarget as HTMLTextAreaElement;
    setSelectionStart(target.selectionStart);
    setSelectionEnd(target.selectionEnd);
  }

  function insertAtCursor(text: string) {
    const start = selectionStart ?? value.length;
    const end = selectionEnd ?? start;
    const next = value.slice(0, start) + text + value.slice(end);
    
    // Update the value
    onChange(next);

    // Calculate new cursor position
    const nextCursor = start + text.length;
    setSelectionStart(nextCursor);
    setSelectionEnd(nextCursor);

    // Force update cursor position in the next render cycle
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextCursor;
        textareaRef.current.selectionEnd = nextCursor;
        
        // Additional check to ensure cursor is in the right position
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = nextCursor;
            textareaRef.current.selectionEnd = nextCursor;
          }
        }, 10);
      }
    });
  }

  function handleInsert(path: string) {
    insertAtCursor(`{{${path}}}`);
    setShowPicker(false);
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    try {
      setIsUploading(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `workflow-email-images/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from(EMAIL_ASSETS_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabaseClient.storage
        .from(EMAIL_ASSETS_BUCKET)
        .getPublicUrl(path);

      const publicUrl = publicData?.publicUrl;

      if (!publicUrl) {
        throw new Error("Unable to generate public URL for uploaded image.");
      }

      const imgTag = `<img src="${publicUrl}" alt="Uploaded image" style="max-width: 100%;" />`;
      insertAtCursor(imgTag);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const filteredVariables = variables.filter((variable) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      variable.label.toLowerCase().includes(term) ||
      variable.path.toLowerCase().includes(term) ||
      variable.category.toLowerCase().includes(term)
    );
  });

  const groupedVariables = filteredVariables.reduce<Record<string, TemplateVariable[]>>(
    (acc, variable) => {
      if (!acc[variable.category]) acc[variable.category] = [];
      acc[variable.category].push(variable);
      return acc;
    },
    {},
  );

  function renderHighlighted() {
    if (!value) return null;

    const nodes: React.ReactNode[] = [];
    const regex = /{{\s*([^}]+?)\s*}}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;

      if (matchStart > lastIndex) {
        nodes.push(
          <span key={`text-${lastIndex}`}>{value.slice(lastIndex, matchStart)}</span>,
        );
      }

      const fullToken = value.slice(matchStart, matchEnd);

      nodes.push(
        <span
          key={`var-${matchStart}`}
          className="rounded bg-sky-50 px-0.5 text-sky-700"
        >
          {fullToken}
        </span>,
      );

      lastIndex = matchEnd;
    }

    if (lastIndex < value.length) {
      nodes.push(
        <span key={`text-${lastIndex}`}>{value.slice(lastIndex)}</span>,
      );
    }

    return nodes;
  }

  // Handle textarea changes while maintaining cursor position
  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value: newValue, selectionStart, selectionEnd } = event.target;
    
    // Update the value
    onChange(newValue);
    
    // Maintain cursor position
    if (selectionStart !== null && selectionEnd !== null) {
      setSelectionStart(selectionStart);
      setSelectionEnd(selectionEnd);
      
      // Force update cursor position in the next render cycle
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = selectionStart;
          textareaRef.current.selectionEnd = selectionEnd;
        }
      }, 0);
    }
  };

  const shouldUseOverlay = !isHtmlEditor && highlightVariables;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-slate-700">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {isHtmlEditor && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                title="Insert image"
              >
                {isUploading ? 'Uploading...' : 'Insert image'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowPicker((open) => !open)}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Insert variable
          </button>
        </div>
      </div>
      {description ? (
        <p className="text-[10px] text-slate-400">{description}</p>
      ) : null}
      {showPicker && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search variables (e.g. patient, deal, stage)…"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <div className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
            {Object.keys(groupedVariables).length === 0 ? (
              <div className="text-slate-400">No matching variables.</div>
            ) : (
              Object.entries(groupedVariables).map(([category, vars]) => (
                <div key={category}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {vars.map((variable) => (
                      <button
                        key={variable.path}
                        type="button"
                        onClick={() => handleInsert(variable.path)}
                        className="flex w-full items-start justify-between gap-2 rounded-md bg-white px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-sky-50"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {`{{${variable.path}}}`}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {variable.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {shouldUseOverlay ? (
        <div className="relative">
          <pre className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs leading-5 text-slate-900 font-sans">
            {value ? (
              renderHighlighted()
            ) : (
              <span className="text-slate-400">
                Start typing and use the Insert variable button to personalize this template.
              </span>
            )}
          </pre>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onClick={updateSelectionFromEvent}
            onKeyUp={updateSelectionFromEvent}
            onSelect={updateSelectionFromEvent}
            rows={rows}
            className="relative w-full resize-y rounded-lg border border-transparent bg-transparent px-3 py-1.5 text-xs leading-5 font-sans text-transparent caret-sky-600 focus:outline-none"
          />
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onClick={updateSelectionFromEvent}
            onKeyUp={updateSelectionFromEvent}
            onSelect={updateSelectionFromEvent}
            rows={rows}
            spellCheck={false}
            className={
              isHtmlEditor
                ? "w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs leading-5 font-mono text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 whitespace-pre-wrap break-all"
                : "w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs leading-5 font-sans text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            }
            style={
              isHtmlEditor
                ? {
                    wordBreak: 'break-all',
                    overflowWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

type EmailBuilderModalProps = {
  open: boolean;
  onClose: () => void;
  subjectTemplate: string;
  onSubjectChange: (value: string) => void;
  bodyTextTemplate: string;
  bodyHtmlTemplate: string;
  onBodyHtmlChange: (value: string) => void;
  useHtmlTemplate: boolean;
  onUseHtmlTemplateChange: (value: boolean) => void;
  variables: TemplateVariable[];
};

function EmailBuilderModal({
  open,
  onClose,
  subjectTemplate,
  onSubjectChange,
  bodyTextTemplate,
  bodyHtmlTemplate,
  onBodyHtmlChange,
  useHtmlTemplate,
  onUseHtmlTemplateChange,
  variables,
}: EmailBuilderModalProps) {
  const [aiDescription, setAiDescription] = useState("");
  const [aiTone, setAiTone] = useState("professional and reassuring");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function handleAiGenerate() {
    const description = aiDescription.trim();
    if (!description) {
      setAiError("Please describe the email you want to generate.");
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);

      const response = await fetch("/api/workflows/generate-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          tone: aiTone,
          variables,
        }),
      });

      const data = (await response.json()) as {
        subject?: string;
        html?: string;
        error?: string;
      };

      if (!response.ok) {
        setAiError(data?.error ?? "Failed to generate email.");
        return;
      }

      if (data.subject && data.subject.trim().length > 0) {
        onSubjectChange(data.subject.trim());
      }

      if (data.html && data.html.trim().length > 0) {
        onBodyHtmlChange(data.html.trim());
        onUseHtmlTemplateChange(true);
      }
    } catch {
      setAiError("Unexpected error generating email.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSendTest() {
    const to = testTo.trim();
    if (!to) {
      setTestError("Please enter a test email address.");
      setTestStatus(null);
      return;
    }

    try {
      setTestSending(true);
      setTestError(null);
      setTestStatus(null);

      const response = await fetch("/api/workflows/send-test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subjectTemplate,
          bodyTemplate: bodyTextTemplate,
          bodyHtmlTemplate,
          useHtml: useHtmlTemplate,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data?.ok) {
        setTestError(data?.error ?? "Failed to send test email.");
        return;
      }

      setTestStatus("Test email sent.");
    } catch {
      setTestError("Unexpected error sending test email.");
    } finally {
      setTestSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Email builder</h3>
            <p className="text-xs text-slate-500">
              Configure a rich HTML email template for this workflow. Variables like
              {" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
                {"{{patient.first_name}}"}
              </code>
              {" "}
              will be replaced when the workflow runs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <TemplateEditor
              label="Email subject template"
              description={
                'You can use variables like {{patient.first_name}} or {{deal.title}} to personalize the subject.'
              }
              value={subjectTemplate}
              onChange={onSubjectChange}
              rows={2}
              variables={variables}
            />
            <TemplateEditor
              label="HTML email template (raw)"
              description="Write or paste HTML. Variables will be replaced when the workflow runs."
              value={bodyHtmlTemplate}
              onChange={onBodyHtmlChange}
              rows={10}
              variables={variables}
              isHtmlEditor={true}
            />
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-800">
                  Generate with AI
                </span>
                <span className="text-[10px] text-slate-400">
                  Describe the email you want to create.
                </span>
              </div>
              <textarea
                value={aiDescription}
                onChange={(event) => setAiDescription(event.target.value)}
                rows={3}
                placeholder="Describe the goal, key points, and audience for this email…"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  value={aiTone}
                  onChange={(event) => setAiTone(event.target.value)}
                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="professional and reassuring">
                    Professional & reassuring
                  </option>
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
              {aiError ? (
                <div className="text-[10px] text-red-600">{aiError}</div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              <div className="flex items-start gap-2">
                <input
                  id="use-html-template"
                  type="checkbox"
                  checked={useHtmlTemplate}
                  onChange={(event) => onUseHtmlTemplateChange(event.target.checked)}
                  className="mt-0.5 h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="use-html-template" className="space-y-1">
                  <span className="block text-[11px] font-medium text-slate-800">
                    Use this HTML as the email body
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    When enabled, the workflow will send this HTML directly instead of the
                    plain-text template.
                  </span>
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Live HTML preview
                </div>
                <div className="max-h-64 overflow-auto rounded border border-slate-100 bg-white p-2 text-[11px] leading-5 text-slate-800">
                  <div
                    className="prose prose-sm max-w-none prose-headings:mb-1 prose-p:mb-1 prose-ul:mb-1 prose-ol:mb-1 prose-li:mb-0"
                    dangerouslySetInnerHTML={{ __html: bodyHtmlTemplate || "<p class='text-slate-400'>Start writing your HTML template on the left.</p>" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500">Send test email to</span>
            <input
              type="email"
              value={testTo}
              onChange={(event) => setTestTo(event.target.value)}
              placeholder="you@example.com"
              className="w-48 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testSending}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testSending ? "Sending test…" : "Send test"}
            </button>
            {testStatus ? (
              <span className="text-[10px] text-emerald-600">{testStatus}</span>
            ) : null}
            {testError ? (
              <span className="text-[10px] text-red-600">{testError}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function textTemplateToHtmlTemplate(text: string): string {
  if (!text) return "";

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\r?\n/g)
    .map((line) => (line.length === 0 ? "<br />" : line))
    .join("<br />");
}

const DEFAULT_BODY_TEMPLATE = [
  "Hi {{patient.first_name}}",
  "",
  "We wanted to let you know that your request for information has now been processed.",
  "",
  "Deal: {{deal.title}}",
  "Pipeline: {{deal.pipeline}}",
  "",
  "Best regards,",
  "Your clinic team",
].join("\n");

const DEFAULT_BODY_HTML_TEMPLATE = textTemplateToHtmlTemplate(DEFAULT_BODY_TEMPLATE);

export default function Page() {
  const searchParams = useSearchParams();
  const editingWorkflowId = searchParams.get("edit");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [stages, setStages] = useState<DealStage[]>([]);

  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [name, setName] = useState("Deal: Request info → Request processed");
  const [active, setActive] = useState(true);
  const [fromStageId, setFromStageId] = useState<string>("");
  const [toStageId, setToStageId] = useState<string>("");
  const [pipeline, setPipeline] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState(
    "Your information request has been processed",
  );
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY_TEMPLATE);
  const [bodyHtmlTemplate, setBodyHtmlTemplate] = useState(DEFAULT_BODY_HTML_TEMPLATE);
  const [useHtmlTemplate, setUseHtmlTemplate] = useState(false);
  const [emailBuilderOpen, setEmailBuilderOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"immediate" | "delay" | "recurring">(
    "immediate",
  );
  const [delayMinutes, setDelayMinutes] = useState<string>("0");
  const [recurringEveryDays, setRecurringEveryDays] = useState<string>("0");
  const [recurringTimes, setRecurringTimes] = useState<string>("0");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [stagesResult, workflowsResult, actionsResult] = await Promise.all([
          supabaseClient
            .from("deal_stages")
            .select("id, name, type, sort_order")
            .order("sort_order", { ascending: true }),
          supabaseClient
            .from("workflows")
            .select("id, name, trigger_type, active, config")
            .eq("trigger_type", "deal_stage_changed")
            .order("created_at", { ascending: true }),
          supabaseClient
            .from("workflow_actions")
            .select("id, workflow_id, action_type, config, sort_order")
            .order("sort_order", { ascending: true }),
        ]);

        if (cancelled) return;

        const stagesData = (stagesResult.data ?? []) as DealStage[];
        setStages(stagesData);

        const workflows = (workflowsResult.data ?? []) as WorkflowRow[];
        const existing = editingWorkflowId
          ? workflows.find((workflow) => workflow.id === editingWorkflowId)
          : null;

        if (existing) {
          setWorkflowId(existing.id);
          setName(existing.name);
          setActive(existing.active);

          const config = (existing.config || {}) as {
            from_stage_id?: string | null;
            to_stage_id?: string | null;
            pipeline?: string | null;
          };

          setFromStageId(config.from_stage_id ?? "");
          setToStageId(config.to_stage_id ?? "");
          setPipeline(config.pipeline ?? "");

          const actions = (actionsResult.data ?? []) as WorkflowActionRow[];
          const action = actions.find(
            (candidate) =>
              candidate.workflow_id === existing.id &&
              candidate.action_type === "draft_email_patient",
          );

          if (action) {
            const actionConfig = (action.config || {}) as {
              subject_template?: string;
              body_template?: string;
              body_html_template?: string;
              use_html?: boolean;
              send_mode?: "immediate" | "delay" | "recurring";
              delay_minutes?: number | null;
              recurring_every_days?: number | null;
              recurring_times?: number | null;
            };

            if (actionConfig.subject_template) {
              setSubjectTemplate(actionConfig.subject_template);
            }

            if (actionConfig.body_template) {
              setBodyTemplate(actionConfig.body_template);
            }

            if (actionConfig.body_html_template) {
              setBodyHtmlTemplate(actionConfig.body_html_template);
              setUseHtmlTemplate(actionConfig.use_html ?? true);
            } else {
              const sourceText =
                actionConfig.body_template ?? DEFAULT_BODY_TEMPLATE;
              setBodyHtmlTemplate(textTemplateToHtmlTemplate(sourceText));
              setUseHtmlTemplate(false);
            }

            const mode =
              (actionConfig.send_mode as
                | "immediate"
                | "delay"
                | "recurring"
                | undefined) ?? "immediate";
            setSendMode(mode);

            if (typeof actionConfig.delay_minutes === "number") {
              setDelayMinutes(String(actionConfig.delay_minutes));
            } else {
              setDelayMinutes("");
            }

            if (typeof actionConfig.recurring_every_days === "number") {
              setRecurringEveryDays(String(actionConfig.recurring_every_days));
            } else {
              setRecurringEveryDays("");
            }

            if (typeof actionConfig.recurring_times === "number") {
              setRecurringTimes(String(actionConfig.recurring_times));
            } else {
              setRecurringTimes("");
            }
          }
        } else {
          // New workflow mode: reset key fields to defaults
          setWorkflowId(null);
          setName("Deal: Request info → Request processed");
          setActive(true);
          setFromStageId("");
          setToStageId("");
          setPipeline("");
          setSubjectTemplate("Your information request has been processed");
          setBodyTemplate(DEFAULT_BODY_TEMPLATE);
          setBodyHtmlTemplate(DEFAULT_BODY_HTML_TEMPLATE);
          setUseHtmlTemplate(false);
          setSendMode("immediate");
          setDelayMinutes("0");
          setRecurringEveryDays("0");
          setRecurringTimes("0");

          const infoStage = stagesData.find((stage) =>
            stage.name.toLowerCase().includes("request for information"),
          );
          const processedStage = stagesData.find((stage) =>
            stage.name.toLowerCase().includes("request processed"),
          );

          if (infoStage) {
            setFromStageId(infoStage.id);
          }
          if (processedStage) {
            setToStageId(processedStage.id);
          }
        }

        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load workflows.");
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [editingWorkflowId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!toStageId) {
      setError("Please select the 'to' stage.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const trimmedName = name.trim() || "Deal stage change automation";
      const pipelineValue = pipeline.trim() || null;
      const config = {
        from_stage_id: fromStageId || null,
        to_stage_id: toStageId,
        pipeline: pipelineValue,
      };

      let id = workflowId;

      if (!id) {
        const { data, error } = await supabaseClient
          .from("workflows")
          .insert({
            name: trimmedName,
            trigger_type: "deal_stage_changed",
            active,
            config,
          })
          .select("id")
          .single();

        if (error || !data) {
          throw error ?? new Error("Failed to create workflow.");
        }

        id = (data as any).id as string;
        setWorkflowId(id);
      } else {
        const { error } = await supabaseClient
          .from("workflows")
          .update({
            name: trimmedName,
            active,
            config,
          })
          .eq("id", id);

        if (error) {
          throw error;
        }
      }

      if (id) {
        const { data: actions, error: actionsError } = await supabaseClient
          .from("workflow_actions")
          .select("id")
          .eq("workflow_id", id)
          .eq("action_type", "draft_email_patient")
          .limit(1);

        if (actionsError) {
          throw actionsError;
        }

        const delayMinutesNumber =
          delayMinutes && !Number.isNaN(Number(delayMinutes))
            ? Number(delayMinutes)
            : null;
        const recurringEveryDaysNumber =
          recurringEveryDays && !Number.isNaN(Number(recurringEveryDays))
            ? Number(recurringEveryDays)
            : null;
        const recurringTimesNumber =
          recurringTimes && !Number.isNaN(Number(recurringTimes))
            ? Number(recurringTimes)
            : null;

        const finalSendMode: "immediate" | "delay" | "recurring" =
          sendMode === "delay" || sendMode === "recurring" ? sendMode : "immediate";

        const actionConfig = {
          subject_template: subjectTemplate,
          body_template: bodyTemplate,
          body_html_template: bodyHtmlTemplate,
          use_html: useHtmlTemplate,
          send_mode: finalSendMode,
          delay_minutes:
            finalSendMode === "delay" &&
            delayMinutesNumber !== null &&
            delayMinutesNumber > 0
              ? delayMinutesNumber
              : null,
          recurring_every_days:
            finalSendMode === "recurring" &&
            recurringEveryDaysNumber !== null &&
            recurringEveryDaysNumber > 0
              ? recurringEveryDaysNumber
              : null,
          recurring_times:
            finalSendMode === "recurring" &&
            recurringTimesNumber !== null &&
            recurringTimesNumber > 0
              ? Math.min(recurringTimesNumber, 30)
              : null,
        };

        if (actions && actions.length > 0) {
          const actionId = (actions[0] as any).id as string;
          const { error: updateError } = await supabaseClient
            .from("workflow_actions")
            .update({ config: actionConfig })
            .eq("id", actionId);

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabaseClient
            .from("workflow_actions")
            .insert({
              workflow_id: id,
              action_type: "draft_email_patient",
              config: actionConfig,
              sort_order: 1,
            });

          if (insertError) {
            throw insertError;
          }
        }
      }

      setSuccess(
        "Workflow saved. A draft email will be created when a deal moves between the selected stages.",
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to save workflow.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Workflows</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure automations that react when a deal moves between pipeline stages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/workflows/all"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span>View all workflows</span>
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-5 text-sm text-slate-800 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Deal stage change → Draft patient email
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Define an automation that runs when a deal moves between stages. For example, when a
            deal moves from <span className="font-semibold">Request for information</span> to
            <span className="font-semibold"> Request processed</span>, automatically create a draft
            email for the patient.
          </p>

          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {success}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Workflow name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex items-end space-x-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Workflow is active</span>
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  From stage (optional)
                </label>
                <select
                  value={fromStageId}
                  onChange={(event) => setFromStageId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Any stage</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  To stage (required)
                </label>
                <select
                  value={toStageId}
                  onChange={(event) => setToStageId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select stage…</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Pipeline filter (optional)
                </label>
                <input
                  type="text"
                  value={pipeline}
                  onChange={(event) => setPipeline(event.target.value)}
                  placeholder="e.g. Geneva"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TemplateEditor
                label="Email subject template"
                description={
                  'You can use variables like {{patient.first_name}} or {{deal.title}} to personalize the subject.'
                }
                value={subjectTemplate}
                onChange={setSubjectTemplate}
                rows={2}
                variables={TEMPLATE_VARIABLES}
              />
              <TemplateEditor
                label="Email body template (plain text)"
                description="This plain-text template will be converted to HTML if the HTML builder is not used."
                value={bodyTemplate}
                onChange={setBodyTemplate}
                rows={8}
                variables={TEMPLATE_VARIABLES}
                highlightVariables={false}
              />
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Sending behavior
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="immediate"
                      checked={sendMode === "immediate"}
                      onChange={() => setSendMode("immediate")}
                      className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Send immediately</span>
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Email is sent as soon as the workflow is triggered.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="delay"
                      checked={sendMode === "delay"}
                      onChange={() => setSendMode("delay")}
                      className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Delay</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={delayMinutes}
                      onChange={(event) => setDelayMinutes(event.target.value)}
                      disabled={sendMode !== "delay"}
                      className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="text-[11px] text-slate-500">
                      minutes after trigger
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="recurring"
                      checked={sendMode === "recurring"}
                      onChange={() => setSendMode("recurring")}
                      className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Recurring</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={recurringEveryDays}
                      onChange={(event) =>
                        setRecurringEveryDays(event.target.value)
                      }
                      disabled={sendMode !== "recurring"}
                      className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="text-[11px] text-slate-500">days,</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={recurringTimes}
                      onChange={(event) => setRecurringTimes(event.target.value)}
                      disabled={sendMode !== "recurring"}
                      className="w-14 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="text-[11px] text-slate-500">occurrences</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useHtmlTemplate}
                  onChange={(event) => setUseHtmlTemplate(event.target.checked)}
                  className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-[11px]">
                  Use HTML builder template when sending this email
                </span>
              </label>
              <button
                type="button"
                onClick={() => setEmailBuilderOpen(true)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Open email builder
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <span className="text-[11px] text-slate-400">
                {loading ? "Loading stages and existing workflows…" : null}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full border border-sky-500 bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save workflow"}
              </button>
            </div>
          </form>
        </section>
      </div>
      <EmailBuilderModal
        open={emailBuilderOpen}
        onClose={() => setEmailBuilderOpen(false)}
        subjectTemplate={subjectTemplate}
        onSubjectChange={setSubjectTemplate}
        bodyTextTemplate={bodyTemplate}
        bodyHtmlTemplate={bodyHtmlTemplate}
        onBodyHtmlChange={setBodyHtmlTemplate}
        useHtmlTemplate={useHtmlTemplate}
        onUseHtmlTemplateChange={setUseHtmlTemplate}
        variables={TEMPLATE_VARIABLES}
      />
    </main>
  );
}
