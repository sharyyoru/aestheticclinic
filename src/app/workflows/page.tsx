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
                  <div className="mb-4 flex flex-wrap gap-1.5">
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
    </main>
  );
}
