"use client";

import React, { useEffect, useState } from "react";
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

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [stages, setStages] = useState<Map<string, DealStage>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const config = workflow.config as { to_stage_id?: string; from_stage_id?: string } | null;
    
    if (workflow.trigger_type === "deal_stage_changed" && config?.to_stage_id) {
      const stage = stages.get(config.to_stage_id);
      return stage ? `When deal moves to "${stage.name}"` : "When deal stage changes";
    }
    
    return TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
            <p className="mt-1 text-sm text-slate-500">
              Automate tasks, emails, and notifications based on triggers
            </p>
          </div>
          <Link
            href="/workflows/builder"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
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

        {/* Quick Links */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/workflows/appointment"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-xl">
                📅
              </div>
              <div>
                <h3 className="font-medium text-slate-900 group-hover:text-amber-700">Appointment Workflow</h3>
                <p className="text-xs text-slate-500">Pre-built appointment automation</p>
              </div>
            </div>
          </Link>
          <Link
            href="/workflows/builder"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-xl">
                🔧
              </div>
              <div>
                <h3 className="font-medium text-slate-900 group-hover:text-emerald-700">Custom Builder</h3>
                <p className="text-xs text-slate-500">Create any workflow from scratch</p>
              </div>
            </div>
          </Link>
          <Link
            href="/workflows/all"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-xl">
                📋
              </div>
              <div>
                <h3 className="font-medium text-slate-900 group-hover:text-blue-700">Email Workflows</h3>
                <p className="text-xs text-slate-500">Legacy email automation editor</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Workflows List */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">All Workflows</h2>
            <span className="text-xs text-slate-500">
              {loading ? "Loading..." : `${workflows.length} workflow${workflows.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-slate-500">Loading workflows...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-4xl">🔄</div>
              <h3 className="font-medium text-slate-900">No workflows yet</h3>
              <p className="mt-1 text-sm text-slate-500">Create your first workflow to automate tasks</p>
              <Link
                href="/workflows/builder"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Create Workflow
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      workflow.active ? "bg-emerald-100" : "bg-slate-100"
                    }`}>
                      <span className="text-lg">
                        {workflow.trigger_type === "deal_stage_changed" ? "📊" :
                         workflow.trigger_type === "patient_created" ? "👤" :
                         workflow.trigger_type === "appointment_created" ? "📅" :
                         workflow.trigger_type === "form_submitted" ? "📝" : "⚡"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">{workflow.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{getTriggerDescription(workflow)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status badge */}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                      workflow.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {workflow.active ? "Active" : "Inactive"}
                    </span>

                    {/* Toggle button */}
                    <button
                      onClick={() => toggleWorkflow(workflow)}
                      disabled={togglingId === workflow.id}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                        workflow.active ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                      title={workflow.active ? "Deactivate" : "Activate"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                          workflow.active ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Edit button */}
                    <Link
                      href={`/workflows/builder?id=${workflow.id}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>

                    {/* Delete button */}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
