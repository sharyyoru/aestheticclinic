"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import EmailTemplateBuilder from "@/components/EmailTemplateBuilder";
import UserSearchSelect from "@/components/UserSearchSelect";

// Types
type TriggerType = 
  | "deal_stage_changed"
  | "patient_created"
  | "appointment_created"
  | "appointment_completed"
  | "form_submitted"
  | "task_completed"
  | "manual";

type ActionType =
  | "send_email"
  | "send_notification"
  | "create_task"
  | "update_task"
  | "create_deal"
  | "update_deal"
  | "update_patient"
  | "webhook"
  | "delay";

type ConditionOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

type WorkflowNode = {
  id: string;
  type: "trigger" | "action" | "condition" | "delay";
  data: TriggerNodeData | ActionNodeData | ConditionNodeData | DelayNodeData;
  nextNodeId?: string | null;
  trueBranchId?: string | null;
  falseBranchId?: string | null;
};

type TriggerNodeData = {
  triggerType: TriggerType;
  config: Record<string, unknown>;
};

type ActionNodeData = {
  actionType: ActionType;
  config: Record<string, unknown>;
};

type ConditionNodeData = {
  field: string;
  operator: ConditionOperator;
  value: string;
};

type DelayNodeData = {
  delayType: "minutes" | "hours" | "days" | "until_time";
  delayValue: number;
  delayTime?: string;
};

type DealStage = {
  id: string;
  name: string;
  type: string;
  sort_order: number;
};

type User = {
  id: string;
  email: string;
  raw_user_meta_data: { full_name?: string; first_name?: string; last_name?: string };
};

// Trigger definitions
const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string; icon: string }[] = [
  { value: "deal_stage_changed", label: "Deal Stage Changed", description: "When a deal moves to a specific stage", icon: "📊" },
  { value: "patient_created", label: "Patient Created", description: "When a new patient is added", icon: "👤" },
  { value: "appointment_created", label: "Appointment Created", description: "When an appointment is scheduled", icon: "📅" },
  { value: "appointment_completed", label: "Appointment Completed", description: "When an appointment is marked complete", icon: "✅" },
  { value: "form_submitted", label: "Form Submitted", description: "When a lead form is submitted", icon: "📝" },
  { value: "task_completed", label: "Task Completed", description: "When a task is marked complete", icon: "☑️" },
  { value: "manual", label: "Manual Trigger", description: "Triggered manually by user", icon: "🖱️" },
];

// Action definitions
const ACTION_OPTIONS: { value: ActionType; label: string; description: string; icon: string; color: string }[] = [
  { value: "send_email", label: "Send Email", description: "Send an email to patient or staff", icon: "📧", color: "emerald" },
  { value: "send_notification", label: "Send Notification", description: "Send in-app notification to user", icon: "🔔", color: "blue" },
  { value: "create_task", label: "Create Task", description: "Create a new task for a user", icon: "📋", color: "purple" },
  { value: "update_task", label: "Update Task", description: "Update an existing task", icon: "✏️", color: "purple" },
  { value: "create_deal", label: "Create Deal", description: "Create a new deal for patient", icon: "💼", color: "amber" },
  { value: "update_deal", label: "Update Deal", description: "Update deal stage or properties", icon: "📈", color: "amber" },
  { value: "update_patient", label: "Update Patient", description: "Update patient information", icon: "👤", color: "cyan" },
  { value: "webhook", label: "Send Webhook", description: "Send data to external URL", icon: "🌐", color: "slate" },
  { value: "delay", label: "Add Delay", description: "Wait before next action", icon: "⏰", color: "orange" },
];

const CONDITION_FIELDS = [
  { value: "patient.email", label: "Patient Email" },
  { value: "patient.phone", label: "Patient Phone" },
  { value: "patient.source", label: "Patient Source" },
  { value: "deal.pipeline", label: "Deal Pipeline" },
  { value: "deal.value", label: "Deal Value" },
  { value: "deal.stage", label: "Deal Stage" },
  { value: "appointment.type", label: "Appointment Type" },
  { value: "appointment.provider", label: "Appointment Provider" },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Click-based add step button component
function AddStepButton({ 
  nodeId, 
  onAdd 
}: { 
  nodeId: string; 
  onAdd: (afterNodeId: string, nodeType: "action" | "condition" | "delay") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-center py-2">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed transition-colors ${
            isOpen 
              ? "border-sky-400 bg-sky-50 text-sky-500" 
              : "border-slate-300 bg-white text-slate-400 hover:border-sky-400 hover:text-sky-500"
          }`}
        >
          <svg className={`h-4 w-4 transition-transform ${isOpen ? "rotate-45" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {isOpen && (
          <div className="absolute left-1/2 top-10 z-20 -translate-x-1/2">
            <div className="flex gap-1 rounded-lg bg-white p-2 shadow-lg border border-slate-200">
              <button
                onClick={() => {
                  onAdd(nodeId, "action");
                  setIsOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 hover:bg-emerald-50 text-[10px] font-medium text-slate-700"
              >
                <span className="text-lg">⚡</span>
                Action
              </button>
              <button
                onClick={() => {
                  onAdd(nodeId, "condition");
                  setIsOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 hover:bg-purple-50 text-[10px] font-medium text-slate-700"
              >
                <span className="text-lg">🔀</span>
                Condition
              </button>
              <button
                onClick={() => {
                  onAdd(nodeId, "delay");
                  setIsOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 hover:bg-blue-50 text-[10px] font-medium text-slate-700"
              >
                <span className="text-lg">⏰</span>
                Delay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [workflowName, setWorkflowName] = useState("New Workflow");
  const [workflowActive, setWorkflowActive] = useState(true);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEmailBuilder, setShowEmailBuilder] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject_template: string }[]>([]);
  const [editingEmailNodeId, setEditingEmailNodeId] = useState<string | null>(null);

  // Load stages, users, and email templates
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        const [stagesRes, usersRes, templatesRes] = await Promise.all([
          supabaseClient.from("deal_stages").select("id, name, type, sort_order").order("sort_order"),
          supabaseClient.from("users").select("id, email, raw_user_meta_data"),
          supabaseClient.from("email_templates").select("id, name, subject_template").order("created_at", { ascending: false }),
        ]);

        if (stagesRes.data) setStages(stagesRes.data);
        if (usersRes.data) setUsers(usersRes.data as User[]);
        if (templatesRes.data) setEmailTemplates(templatesRes.data);

        // Load existing workflow if editing
        if (editId) {
          const { data: workflow } = await supabaseClient
            .from("workflows")
            .select("*")
            .eq("id", editId)
            .single();

          if (workflow) {
            setWorkflowName(workflow.name);
            setWorkflowActive(workflow.active);
            
            // Parse nodes from config
            const config = workflow.config as { nodes?: WorkflowNode[] };
            if (config?.nodes) {
              setNodes(config.nodes);
            }
          }
        } else {
          // Initialize with default trigger node
          setNodes([
            {
              id: generateId(),
              type: "trigger",
              data: {
                triggerType: "deal_stage_changed",
                config: {},
              } as TriggerNodeData,
            },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [editId]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Add new node after a specific node
  const addNodeAfter = useCallback((afterNodeId: string, nodeType: "action" | "condition" | "delay") => {
    const newNodeId = generateId();
    let newNode: WorkflowNode;

    if (nodeType === "action") {
      newNode = {
        id: newNodeId,
        type: "action",
        data: {
          actionType: "send_email",
          config: {},
        } as ActionNodeData,
      };
    } else if (nodeType === "condition") {
      newNode = {
        id: newNodeId,
        type: "condition",
        data: {
          field: "patient.email",
          operator: "is_not_empty",
          value: "",
        } as ConditionNodeData,
      };
    } else {
      newNode = {
        id: newNodeId,
        type: "delay",
        data: {
          delayType: "hours",
          delayValue: 1,
        } as DelayNodeData,
      };
    }

    setNodes((prev) => {
      const updated = [...prev];
      const afterIndex = updated.findIndex((n) => n.id === afterNodeId);
      if (afterIndex !== -1) {
        // Get the next node ID from the current node
        const currentNextId = updated[afterIndex].nextNodeId;
        // Update the current node to point to the new node
        updated[afterIndex] = { ...updated[afterIndex], nextNodeId: newNodeId };
        // Add the new node with the previous next node
        newNode.nextNodeId = currentNextId;
        updated.splice(afterIndex + 1, 0, newNode);
      } else {
        updated.push(newNode);
      }
      return updated;
    });

    setSelectedNodeId(newNodeId);
  }, []);

  // Delete a node
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => {
      const nodeToDelete = prev.find((n) => n.id === nodeId);
      if (!nodeToDelete || nodeToDelete.type === "trigger") return prev;

      // Find the node that points to this one
      const parentNode = prev.find((n) => n.nextNodeId === nodeId || n.trueBranchId === nodeId || n.falseBranchId === nodeId);
      
      const updated = prev.filter((n) => n.id !== nodeId);
      
      // Update parent node to point to the deleted node's next
      if (parentNode) {
        const parentIndex = updated.findIndex((n) => n.id === parentNode.id);
        if (parentIndex !== -1) {
          if (parentNode.nextNodeId === nodeId) {
            updated[parentIndex] = { ...updated[parentIndex], nextNodeId: nodeToDelete.nextNodeId };
          } else if (parentNode.trueBranchId === nodeId) {
            updated[parentIndex] = { ...updated[parentIndex], trueBranchId: nodeToDelete.nextNodeId };
          } else if (parentNode.falseBranchId === nodeId) {
            updated[parentIndex] = { ...updated[parentIndex], falseBranchId: nodeToDelete.nextNodeId };
          }
        }
      }
      
      return updated;
    });
    setSelectedNodeId(null);
  }, []);

  // Update node data
  const updateNodeData = useCallback((nodeId: string, data: Partial<WorkflowNode["data"]>) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      )
    );
  }, []);

  // Save workflow
  const handleSave = async () => {
    if (!workflowName.trim()) {
      setError("Please enter a workflow name");
      return;
    }

    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) {
      setError("Workflow must have a trigger");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const workflowData = {
        name: workflowName,
        trigger_type: (triggerNode.data as TriggerNodeData).triggerType,
        active: workflowActive,
        config: {
          nodes,
          ...(triggerNode.data as TriggerNodeData).config,
        },
      };

      if (editId) {
        await supabaseClient.from("workflows").update(workflowData).eq("id", editId);
      } else {
        await supabaseClient.from("workflows").insert(workflowData);
      }

      setSuccess("Workflow saved successfully!");
      setTimeout(() => router.push("/workflows/all"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  // Render node card
  const renderNodeCard = (node: WorkflowNode, index: number) => {
    const isSelected = selectedNodeId === node.id;
    const isTrigger = node.type === "trigger";
    const isCondition = node.type === "condition";
    const isDelay = node.type === "delay";
    const isAction = node.type === "action";

    let bgColor = "bg-white";
    let borderColor = "border-slate-200";
    let badgeColor = "bg-slate-100 text-slate-700";
    let icon = "⚡";
    let title = "";
    let description = "";

    if (isTrigger) {
      const data = node.data as TriggerNodeData;
      const triggerDef = TRIGGER_OPTIONS.find((t) => t.value === data.triggerType);
      bgColor = "bg-gradient-to-r from-amber-50 to-orange-50";
      borderColor = "border-amber-200";
      badgeColor = "bg-amber-200 text-amber-800";
      icon = triggerDef?.icon || "⚡";
      title = triggerDef?.label || "Trigger";
      description = triggerDef?.description || "";
    } else if (isAction) {
      const data = node.data as ActionNodeData;
      const actionDef = ACTION_OPTIONS.find((a) => a.value === data.actionType);
      bgColor = "bg-gradient-to-r from-emerald-50 to-teal-50";
      borderColor = "border-emerald-200";
      badgeColor = "bg-emerald-200 text-emerald-800";
      icon = actionDef?.icon || "📧";
      title = actionDef?.label || "Action";
      description = actionDef?.description || "";
    } else if (isCondition) {
      bgColor = "bg-gradient-to-r from-purple-50 to-pink-50";
      borderColor = "border-purple-200";
      badgeColor = "bg-purple-200 text-purple-800";
      icon = "🔀";
      title = "Condition";
      const data = node.data as ConditionNodeData;
      description = `If ${data.field} ${data.operator} ${data.value || "..."}`;
    } else if (isDelay) {
      bgColor = "bg-gradient-to-r from-blue-50 to-indigo-50";
      borderColor = "border-blue-200";
      badgeColor = "bg-blue-200 text-blue-800";
      icon = "⏰";
      title = "Delay";
      const data = node.data as DelayNodeData;
      description = `Wait ${data.delayValue} ${data.delayType}`;
    }

    return (
      <div key={node.id} className="relative">
        {/* Connector line */}
        {index > 0 && (
          <div className="absolute left-6 -top-4 h-4 w-0.5 bg-gradient-to-b from-slate-300 to-slate-200" />
        )}

        <div
          onClick={() => setSelectedNodeId(node.id)}
          className={`
            relative cursor-pointer rounded-xl p-4 transition-all border-2
            ${bgColor} ${isSelected ? "border-sky-500 ring-2 ring-sky-200" : borderColor}
            hover:shadow-md
          `}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/80 text-2xl shadow-sm">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badgeColor}`}>
                  {node.type}
                </span>
                <span className="text-xs text-slate-400">Step {index + 1}</span>
              </div>
              <h3 className="font-medium text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600 truncate">{description}</p>
            </div>
            {!isTrigger && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNode(node.id);
                }}
                className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Add node button - click to toggle menu */}
        <AddStepButton nodeId={node.id} onAdd={addNodeAfter} />
      </div>
    );
  };

  // Render configuration panel based on selected node type
  const renderConfigPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Select a step to configure it
        </div>
      );
    }

    if (selectedNode.type === "trigger") {
      const data = selectedNode.data as TriggerNodeData;
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Configure Trigger</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Trigger Type</label>
            <select
              value={data.triggerType}
              onChange={(e) => updateNodeData(selectedNode.id, { triggerType: e.target.value as TriggerType, config: {} })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {data.triggerType === "deal_stage_changed" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">When deal moves to stage</label>
              <select
                value={(data.config as { to_stage_id?: string }).to_stage_id || ""}
                onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, to_stage_id: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select stage...</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      );
    }

    if (selectedNode.type === "action") {
      const data = selectedNode.data as ActionNodeData;
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Configure Action</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Action Type</label>
            <select
              value={data.actionType}
              onChange={(e) => updateNodeData(selectedNode.id, { actionType: e.target.value as ActionType, config: {} })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {ACTION_OPTIONS.filter(a => a.value !== "delay").map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {data.actionType === "send_email" && (
            <>
              {/* Email Template Selection */}
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-3">
                <label className="block text-xs font-semibold text-sky-800 uppercase tracking-wide">Email Template</label>
                <select
                  value={(data.config as { template_id?: string }).template_id || ""}
                  onChange={(e) => {
                    const templateId = e.target.value;
                    const template = emailTemplates.find(t => t.id === templateId);
                    updateNodeData(selectedNode.id, { 
                      config: { 
                        ...data.config, 
                        template_id: templateId,
                        subject: template?.subject_template || (data.config as { subject?: string }).subject
                      } 
                    });
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select a template...</option>
                  {emailTemplates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEmailNodeId(selectedNode.id);
                      setShowEmailBuilder(true);
                    }}
                    className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    📧 Open Email Builder
                  </button>
                  {(data.config as { template_id?: string }).template_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEmailNodeId(selectedNode.id);
                        setShowEmailBuilder(true);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Send to</label>
                <select
                  value={(data.config as { recipient?: string }).recipient || "patient"}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, recipient: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="patient">Patient (from trigger)</option>
                  <option value="deal_patient">Patient (from deal)</option>
                  <option value="assigned_user">Assigned Staff</option>
                  <option value="specific_user">Specific User</option>
                  <option value="specific_email">Specific Email Address</option>
                </select>
              </div>

              {(data.config as { recipient?: string }).recipient === "specific_user" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Select User</label>
                  <UserSearchSelect
                    value={(data.config as { user_id?: string }).user_id || ""}
                    onChange={(userId) => updateNodeData(selectedNode.id, { config: { ...data.config, user_id: userId } })}
                    placeholder="Search for a user..."
                  />
                </div>
              )}

              {(data.config as { recipient?: string }).recipient === "specific_email" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={(data.config as { email_address?: string }).email_address || ""}
                    onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, email_address: e.target.value } })}
                    placeholder="Enter email address..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Subject</label>
                <input
                  type="text"
                  value={(data.config as { subject?: string }).subject || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, subject: e.target.value } })}
                  placeholder="Enter subject..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <p className="mt-1 text-[10px] text-slate-500">Use {"{{patient.first_name}}"} etc. for variables</p>
              </div>

              {/* Sending Behavior */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Sending Behavior</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`send_mode_${selectedNode.id}`}
                      checked={(data.config as { send_mode?: string }).send_mode !== "delay" && (data.config as { send_mode?: string }).send_mode !== "recurring"}
                      onChange={() => updateNodeData(selectedNode.id, { config: { ...data.config, send_mode: "immediate" } })}
                      className="h-4 w-4 text-sky-600 border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Send immediately</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`send_mode_${selectedNode.id}`}
                      checked={(data.config as { send_mode?: string }).send_mode === "delay"}
                      onChange={() => updateNodeData(selectedNode.id, { config: { ...data.config, send_mode: "delay" } })}
                      className="h-4 w-4 text-sky-600 border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Delay</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`send_mode_${selectedNode.id}`}
                      checked={(data.config as { send_mode?: string }).send_mode === "recurring"}
                      onChange={() => updateNodeData(selectedNode.id, { config: { ...data.config, send_mode: "recurring" } })}
                      className="h-4 w-4 text-sky-600 border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Recurring</span>
                  </label>
                </div>

                {(data.config as { send_mode?: string }).send_mode === "delay" && (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      min="0"
                      value={(data.config as { delay_minutes?: number }).delay_minutes || 0}
                      onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, delay_minutes: parseInt(e.target.value) || 0 } })}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm text-slate-900"
                    />
                    <span className="text-slate-600">minutes after trigger</span>
                  </div>
                )}

                {(data.config as { send_mode?: string }).send_mode === "recurring" && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-600">Every</span>
                    <input
                      type="number"
                      min="1"
                      value={(data.config as { recurring_days?: number }).recurring_days || 1}
                      onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, recurring_days: parseInt(e.target.value) || 1 } })}
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-sm text-slate-900"
                    />
                    <span className="text-slate-600">days,</span>
                    <input
                      type="number"
                      min="1"
                      value={(data.config as { recurring_times?: number }).recurring_times || 1}
                      onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, recurring_times: parseInt(e.target.value) || 1 } })}
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-sm text-slate-900"
                    />
                    <span className="text-slate-600">occurrences</span>
                  </div>
                )}
              </div>

            </>
          )}

          {data.actionType === "send_notification" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notify User</label>
                <UserSearchSelect
                  value={(data.config as { user_id?: string }).user_id || ""}
                  onChange={(userId) => updateNodeData(selectedNode.id, { config: { ...data.config, user_id: userId } })}
                  placeholder="Search for a user..."
                  includeAssigned
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                <textarea
                  value={(data.config as { message?: string }).message || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, message: e.target.value } })}
                  placeholder="Notification message..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <p className="mt-1 text-[10px] text-slate-500">Use {"{{patient.first_name}}"}, {"{{deal.title}}"} etc. for variables</p>
              </div>
            </>
          )}

          {data.actionType === "create_task" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Task Title</label>
                <input
                  type="text"
                  value={(data.config as { title?: string }).title || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, title: e.target.value } })}
                  placeholder="e.g., Follow up with {{patient.first_name}}"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <p className="mt-1 text-[10px] text-slate-500">Use {"{{patient.first_name}}"}, {"{{patient.last_name}}"}, {"{{deal.title}}"} for variables</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to</label>
                <UserSearchSelect
                  value={(data.config as { assign_to?: string }).assign_to || ""}
                  onChange={(userId) => updateNodeData(selectedNode.id, { config: { ...data.config, assign_to: userId } })}
                  placeholder="Search for a user..."
                  includeAssigned
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Due in (days)</label>
                <input
                  type="number"
                  min="0"
                  value={(data.config as { due_days?: number }).due_days || 1}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, due_days: parseInt(e.target.value) } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </>
          )}

          {data.actionType === "update_deal" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Move to stage</label>
              <select
                value={(data.config as { new_stage_id?: string }).new_stage_id || ""}
                onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, new_stage_id: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select stage...</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
            </div>
          )}

          {data.actionType === "webhook" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook URL</label>
                <input
                  type="url"
                  value={(data.config as { url?: string }).url || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, url: e.target.value } })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
                <select
                  value={(data.config as { method?: string }).method || "POST"}
                  onChange={(e) => updateNodeData(selectedNode.id, { config: { ...data.config, method: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            </>
          )}
        </div>
      );
    }

    if (selectedNode.type === "condition") {
      const data = selectedNode.data as ConditionNodeData;
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Configure Condition</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Field</label>
            <select
              value={data.field}
              onChange={(e) => updateNodeData(selectedNode.id, { field: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {CONDITION_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Operator</label>
            <select
              value={data.operator}
              onChange={(e) => updateNodeData(selectedNode.id, { operator: e.target.value as ConditionOperator })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {!["is_empty", "is_not_empty"].includes(data.operator) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Value</label>
              <input
                type="text"
                value={data.value}
                onChange={(e) => updateNodeData(selectedNode.id, { value: e.target.value })}
                placeholder="Enter value..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          )}

          <div className="rounded-lg bg-purple-50 p-3 text-xs text-purple-700">
            <strong>If/Else:</strong> When this condition is true, the workflow continues to the next step. 
            You can add different actions for true/false branches by adding nodes after this condition.
          </div>
        </div>
      );
    }

    if (selectedNode.type === "delay") {
      const data = selectedNode.data as DelayNodeData;
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Configure Delay</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Delay Type</label>
            <select
              value={data.delayType}
              onChange={(e) => updateNodeData(selectedNode.id, { delayType: e.target.value as DelayNodeData["delayType"] })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Wait for</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={data.delayValue}
                onChange={(e) => updateNodeData(selectedNode.id, { delayValue: parseInt(e.target.value) || 1 })}
                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <span className="text-sm text-slate-600">{data.delayType}</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/workflows/all" className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="text-2xl font-bold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0"
                placeholder="Workflow name..."
              />
            </div>
            <p className="text-sm text-slate-500">Build custom automations with triggers, actions, and conditions</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={workflowActive}
                onChange={(e) => setWorkflowActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              Active
            </label>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Workflow"}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Workflow Canvas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm min-h-[600px]">
            <h2 className="mb-6 text-lg font-semibold text-slate-900">Workflow Steps</h2>
            <div className="space-y-0">
              {nodes.map((node, index) => renderNodeCard(node, index))}
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-fit sticky top-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Configuration</h2>
            {renderConfigPanel()}
          </div>
        </div>
      </div>

      {/* Email Template Builder Modal */}
      <EmailTemplateBuilder
        open={showEmailBuilder}
        onClose={() => {
          setShowEmailBuilder(false);
          setEditingEmailNodeId(null);
        }}
        onSelectTemplate={(template) => {
          if (editingEmailNodeId) {
            const node = nodes.find(n => n.id === editingEmailNodeId);
            if (node && node.type === "action") {
              const data = node.data as ActionNodeData;
              updateNodeData(editingEmailNodeId, {
                config: {
                  ...data.config,
                  template_id: template.id,
                  subject: template.subject_template,
                }
              });
            }
          }
          // Refresh templates list
          supabaseClient
            .from("email_templates")
            .select("id, name, subject_template")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              if (data) setEmailTemplates(data);
            });
        }}
        initialTemplateId={
          editingEmailNodeId
            ? (nodes.find(n => n.id === editingEmailNodeId)?.data as ActionNodeData | undefined)?.config?.template_id as string | undefined
            : undefined
        }
      />
    </main>
  );
}
