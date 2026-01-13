"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type WorkflowRow = {
  id: string;
  name: string;
  trigger_type: string;
  active: boolean;
  config: unknown;
  created_at?: string;
  enrollment_count?: number;
};

type DealStage = {
  id: string;
  name: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  deal_stage_changed: "Deal Stage Changed",
  patient_created: "Patient Created",
  appointment_created: "Appointment Created",
  appointment_completed: "Appointment Completed",
  form_submitted: "Form Submitted",
  task_completed: "Task Completed",
  manual: "Manual Trigger",
};

const TRIGGER_ICONS: Record<string, string> = {
  deal_stage_changed: "📊",
  patient_created: "👤",
  appointment_created: "📅",
  appointment_completed: "✅",
  form_submitted: "📝",
  task_completed: "☑️",
  manual: "🖱️",
};

const TRIGGER_COLORS: Record<string, string> = {
  deal_stage_changed: "bg-blue-100 text-blue-700",
  patient_created: "bg-purple-100 text-purple-700",
  appointment_created: "bg-amber-100 text-amber-700",
  appointment_completed: "bg-emerald-100 text-emerald-700",
  form_submitted: "bg-cyan-100 text-cyan-700",
  task_completed: "bg-green-100 text-green-700",
  manual: "bg-slate-100 text-slate-700",
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [stages, setStages] = useState<Map<string, DealStage>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Map<string, number>>(new Map());
  const [showEnrollmentsModal, setShowEnrollmentsModal] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    try {
      setLoading(true);
      setError(null);

      const [workflowsRes, stagesRes] = await Promise.all([
        supabaseClient
          .from("workflows")
          .select("id, name, trigger_type, active, config, created_at")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("deal_stages")
          .select("id, name"),
      ]);

      if (workflowsRes.error) throw workflowsRes.error;
      
      setWorkflows(workflowsRes.data || []);
      
      const stageMap = new Map<string, DealStage>();
      for (const stage of stagesRes.data || []) {
        stageMap.set(stage.id, stage);
      }
      setStages(stageMap);

      // Load enrollment counts for each workflow
      if (workflowsRes.data && workflowsRes.data.length > 0) {
        const workflowIds = workflowsRes.data.map((w: any) => w.id);
        const { data: enrollments } = await supabaseClient
          .from("workflow_enrollments")
          .select("workflow_id")
          .in("workflow_id", workflowIds);

        if (enrollments) {
          const counts = new Map<string, number>();
          for (const e of enrollments) {
            counts.set(e.workflow_id, (counts.get(e.workflow_id) || 0) + 1);
          }
          setEnrollmentCounts(counts);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }

  // Filtered workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      // Status filter
      if (statusFilter === "active" && !w.active) return false;
      if (statusFilter === "inactive" && w.active) return false;
      
      // Trigger filter
      if (triggerFilter !== "all" && w.trigger_type !== triggerFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesTrigger = (TRIGGER_LABELS[w.trigger_type] || w.trigger_type).toLowerCase().includes(query);
        if (!matchesName && !matchesTrigger) return false;
      }
      
      return true;
    });
  }, [workflows, statusFilter, triggerFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: workflows.length,
    active: workflows.filter((w) => w.active).length,
    inactive: workflows.filter((w) => !w.active).length,
  }), [workflows]);

  // Get unique trigger types for filter
  const triggerTypes = useMemo(() => {
    const types = new Set(workflows.map((w) => w.trigger_type));
    return Array.from(types);
  }, [workflows]);

  async function toggleWorkflow(workflow: WorkflowRow) {
    try {
      setTogglingId(workflow.id);
      
      const { error } = await supabaseClient
        .from("workflows")
        .update({ active: !workflow.active })
        .eq("id", workflow.id);

      if (error) throw error;

      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflow.id ? { ...w, active: !w.active } : w
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle workflow");
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteWorkflow(workflow: WorkflowRow) {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;

    try {
      setDeletingId(workflow.id);

      // Delete workflow actions first
      await supabaseClient
        .from("workflow_actions")
        .delete()
        .eq("workflow_id", workflow.id);

      // Delete the workflow
      const { error } = await supabaseClient
        .from("workflows")
        .delete()
        .eq("id", workflow.id);

      if (error) throw error;

      setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workflow");
    } finally {
      setDeletingId(null);
    }
  }

  async function duplicateWorkflow(workflow: WorkflowRow) {
    try {
      setDuplicatingId(workflow.id);

      // Create a copy of the workflow with a new name
      const { data: newWorkflow, error } = await supabaseClient
        .from("workflows")
        .insert({
          name: `${workflow.name} (Copy)`,
          trigger_type: workflow.trigger_type,
          active: false, // Start as inactive
          config: workflow.config,
        })
        .select()
        .single();

      if (error) throw error;

      if (newWorkflow) {
        setWorkflows((prev) => [newWorkflow as WorkflowRow, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate workflow");
    } finally {
      setDuplicatingId(null);
    }
  }

  function getTriggerDescription(workflow: WorkflowRow): string {
    const config = workflow.config as { to_stage_id?: string; from_stage_id?: string; nodes?: any[] } | null;
    
    if (workflow.trigger_type === "deal_stage_changed" && config?.to_stage_id) {
      const stage = stages.get(config.to_stage_id);
      return stage ? `When deal moves to "${stage.name}"` : "When deal stage changes";
    }
    
    return TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type;
  }

  function getActionsCount(workflow: WorkflowRow): number {
    const config = workflow.config as { nodes?: any[] } | null;
    if (config?.nodes) {
      return config.nodes.filter((n: any) => n.type === "action").length;
    }
    return 0;
  }

  function getActionsSummary(workflow: WorkflowRow): string[] {
    const config = workflow.config as { nodes?: any[] } | null;
    if (!config?.nodes) return [];
    
    const actions = config.nodes.filter((n: any) => n.type === "action");
    return actions.map((a: any) => {
      switch (a.data?.actionType) {
        case "send_email": return "📧 Send Email";
        case "send_notification": return "🔔 Notification";
        case "create_task": return "📋 Create Task";
        case "update_deal": return "📈 Update Deal";
        default: return a.data?.actionType || "Action";
      }
    }).slice(0, 3);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
            <p className="mt-1 text-sm text-slate-500">
              Automate tasks, emails, and notifications based on triggers
            </p>
          </div>
          <Link
            href="/workflows/builder"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Workflow
          </Link>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-6 grid gap-4 grid-cols-3">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl border p-4 text-left transition-all ${
              statusFilter === "all"
                ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Total Workflows</p>
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`rounded-xl border p-4 text-left transition-all ${
              statusFilter === "active"
                ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            <p className="text-xs text-slate-500">Active</p>
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`rounded-xl border p-4 text-left transition-all ${
              statusFilter === "inactive"
                ? "border-slate-400 bg-slate-100 ring-2 ring-slate-300"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-2xl font-bold text-slate-600">{stats.inactive}</p>
            <p className="text-xs text-slate-500">Inactive</p>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
          >
            <option value="all">All Triggers</option>
            {triggerTypes.map((type) => (
              <option key={type} value={type}>
                {TRIGGER_LABELS[type] || type}
              </option>
            ))}
          </select>
          {(statusFilter !== "all" || triggerFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setTriggerFilter("all");
                setSearchQuery("");
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Workflows Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-500">Loading workflows...</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="mb-3 text-4xl">🔄</div>
            <h3 className="font-medium text-slate-900">
              {workflows.length === 0 ? "No workflows yet" : "No matching workflows"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {workflows.length === 0
                ? "Create your first workflow to automate tasks"
                : "Try adjusting your filters"}
            </p>
            {workflows.length === 0 && (
              <Link
                href="/workflows/builder"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Create Workflow
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                  workflow.active ? "border-slate-200" : "border-slate-200 opacity-75"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    TRIGGER_COLORS[workflow.trigger_type] || "bg-slate-100"
                  }`}>
                    <span className="text-lg">{TRIGGER_ICONS[workflow.trigger_type] || "⚡"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      workflow.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {workflow.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="font-semibold text-slate-900 truncate mb-1">{workflow.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{getTriggerDescription(workflow)}</p>

                {/* Actions Summary */}
                {getActionsCount(workflow) > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {getActionsSummary(workflow).map((action, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {action}
                      </span>
                    ))}
                    {getActionsCount(workflow) > 3 && (
                      <span className="text-[10px] text-slate-400">+{getActionsCount(workflow) - 3} more</span>
                    )}
                  </div>
                )}

                {/* Enrollment Count */}
                <button
                  onClick={() => setShowEnrollmentsModal(workflow.id)}
                  className="mb-4 flex items-center gap-2 text-xs text-slate-500 hover:text-sky-600 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="font-medium">{enrollmentCounts.get(workflow.id) || 0}</span> patients enrolled
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => toggleWorkflow(workflow)}
                    disabled={togglingId === workflow.id}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                      workflow.active ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        workflow.active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/workflows/builder?id=${workflow.id}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => duplicateWorkflow(workflow)}
                      disabled={duplicatingId === workflow.id}
                      className="rounded-lg p-2 text-slate-400 hover:bg-sky-50 hover:text-sky-500 disabled:opacity-50"
                      title="Duplicate"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteWorkflow(workflow)}
                      disabled={deletingId === workflow.id}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrollments Modal */}
      {showEnrollmentsModal && (
        <WorkflowEnrollmentsModal
          workflowId={showEnrollmentsModal}
          workflowName={workflows.find((w) => w.id === showEnrollmentsModal)?.name || "Workflow"}
          onClose={() => setShowEnrollmentsModal(null)}
        />
      )}
    </main>
  );
}

// Enrollments Modal Component
type EnrollmentRow = {
  id: string;
  patient_id: string;
  deal_id: string | null;
  enrolled_at: string;
  status: string;
  trigger_data: any;
  patient: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  steps: {
    id: string;
    step_type: string;
    step_action: string | null;
    status: string;
    executed_at: string | null;
    result: any;
    error_message: string | null;
  }[];
};

function WorkflowEnrollmentsModal({
  workflowId,
  workflowName,
  onClose,
}: {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}) {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnrollments();
  }, [workflowId]);

  async function loadEnrollments() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabaseClient
        .from("workflow_enrollments")
        .select(`
          id,
          patient_id,
          deal_id,
          enrolled_at,
          status,
          trigger_data,
          patient:patients(id, first_name, last_name, email)
        `)
        .eq("workflow_id", workflowId)
        .order("enrolled_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Load steps for each enrollment
      const enrollmentsWithSteps: EnrollmentRow[] = [];
      for (const enrollment of data || []) {
        const { data: steps } = await supabaseClient
          .from("workflow_enrollment_steps")
          .select("id, step_type, step_action, status, executed_at, result, error_message")
          .eq("enrollment_id", enrollment.id)
          .order("created_at", { ascending: true });

        enrollmentsWithSteps.push({
          ...enrollment,
          patient: enrollment.patient as any,
          steps: steps || [],
        });
      }

      setEnrollments(enrollmentsWithSteps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }

  function getPatientName(enrollment: EnrollmentRow): string {
    if (enrollment.patient) {
      const first = enrollment.patient.first_name || "";
      const last = enrollment.patient.last_name || "";
      if (first || last) return `${first} ${last}`.trim();
      return enrollment.patient.email || "Unknown";
    }
    return "Unknown Patient";
  }

  function getStepStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "skipped":
        return "bg-slate-100 text-slate-500";
      default:
        return "bg-slate-100 text-slate-600";
    }
  }

  function getActionIcon(action: string | null) {
    switch (action) {
      case "send_email":
        return "📧";
      case "create_task":
        return "📋";
      case "send_notification":
        return "🔔";
      case "update_deal":
        return "📈";
      default:
        return "⚡";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Enrolled Patients</h2>
            <p className="text-sm text-slate-500">{workflowName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
              <p className="text-sm text-slate-500">Loading enrollments...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-4xl">📭</div>
              <h3 className="font-medium text-slate-900">No patients enrolled yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Patients will appear here when the workflow is triggered
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-3 font-medium text-slate-700">Patient</th>
                    <th className="pb-3 font-medium text-slate-700">Enrolled</th>
                    <th className="pb-3 font-medium text-slate-700">Status</th>
                    <th className="pb-3 font-medium text-slate-700">Steps Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="group">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-medium text-sky-700">
                            {getPatientName(enrollment).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{getPatientName(enrollment)}</p>
                            {enrollment.patient?.email && (
                              <p className="text-xs text-slate-500">{enrollment.patient.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600">
                        {new Date(enrollment.enrolled_at).toLocaleDateString()}{" "}
                        <span className="text-slate-400">
                          {new Date(enrollment.enrolled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          enrollment.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : enrollment.status === "completed"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {enrollment.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {enrollment.steps.length === 0 ? (
                            <span className="text-slate-400 text-xs">No steps recorded</span>
                          ) : (
                            enrollment.steps.map((step) => (
                              <span
                                key={step.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${getStepStatusBadge(step.status)}`}
                                title={step.error_message || (step.result ? JSON.stringify(step.result) : "")}
                              >
                                <span>{getActionIcon(step.step_action)}</span>
                                {step.step_action?.replace("_", " ")}
                                {step.status === "completed" && " ✓"}
                                {step.status === "failed" && " ✗"}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex justify-between items-center">
          <p className="text-sm text-slate-500">
            {enrollments.length} patient{enrollments.length !== 1 ? "s" : ""} enrolled
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
