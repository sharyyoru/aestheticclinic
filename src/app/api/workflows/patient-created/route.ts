import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patient_id } = body;

    if (!patient_id) {
      return NextResponse.json(
        { error: "patient_id is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient details
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("*")
      .eq("id", patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    // Find workflows with patient_created trigger
    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("trigger_type", "patient_created")
      .eq("active", true);

    if (workflowsError) {
      console.error("Error fetching workflows:", workflowsError);
      return NextResponse.json(
        { error: "Failed to fetch workflows" },
        { status: 500 }
      );
    }

    if (!workflows || workflows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No active patient_created workflows found",
        workflows: 0,
      });
    }

    let actionsRun = 0;

    for (const workflow of workflows) {
      // Create workflow enrollment record
      const { data: enrollment } = await supabaseAdmin
        .from("workflow_enrollments")
        .insert({
          workflow_id: workflow.id,
          patient_id: patient.id,
          status: "active",
          trigger_data: {
            patient,
            trigger_type: "patient_created",
          },
        })
        .select("id")
        .single();

      const enrollmentId = enrollment?.id;

      // Get workflow actions from config
      const workflowConfig = workflow.config as { nodes?: any[] } | null;
      if (!workflowConfig?.nodes) continue;

      const actions = workflowConfig.nodes.filter(
        (node: any) => node.type === "action"
      );

      for (const actionNode of actions) {
        const actionType = actionNode.data?.actionType;
        const config = actionNode.data?.config || {};

        if (actionType === "create_task") {
          const taskName = config.task_name || `Follow up with ${patient.first_name} ${patient.last_name}`;
          
          const { error: taskError } = await supabaseAdmin
            .from("tasks")
            .insert({
              name: taskName,
              description: config.description || `New patient intake: ${patient.first_name} ${patient.last_name}`,
              status: "open",
              priority: config.priority || "medium",
              type: "todo",
              patient_id: patient.id,
              assigned_user_id: config.user_id || null,
            });

          if (!taskError) {
            actionsRun += 1;
            if (enrollmentId) {
              await supabaseAdmin.from("workflow_enrollment_steps").insert({
                enrollment_id: enrollmentId,
                step_type: "action",
                step_action: "create_task",
                step_config: config,
                status: "completed",
                executed_at: new Date().toISOString(),
                result: { task_name: taskName },
              });
            }
          }
        }

        if (actionType === "send_email") {
          // Email sending logic would go here
          // For now, just log the step
          if (enrollmentId) {
            await supabaseAdmin.from("workflow_enrollment_steps").insert({
              enrollment_id: enrollmentId,
              step_type: "action",
              step_action: "send_email",
              step_config: config,
              status: "pending",
              executed_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      workflows: workflows.length,
      actionsRun,
    });
  } catch (error) {
    console.error("Error in patient-created workflow:", error);
    return NextResponse.json(
      { error: "Unexpected error running workflows" },
      { status: 500 }
    );
  }
}
