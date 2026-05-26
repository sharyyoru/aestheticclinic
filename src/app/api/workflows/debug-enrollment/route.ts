import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/workflows/debug-enrollment?id=enrollment_id
 * 
 * Debug endpoint to inspect workflow enrollment and its steps
 */
export async function GET(request: NextRequest) {
  try {
    const enrollmentId = request.nextUrl.searchParams.get("id");

    if (!enrollmentId) {
      // List recent enrollments
      const { data: enrollments, error } = await supabaseAdmin
        .from("workflow_enrollments")
        .select(`
          id,
          workflow_id,
          patient_id,
          deal_id,
          status,
          created_at,
          workflow:workflows(id, name, config)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        message: "Recent enrollments (pass ?id=xxx to view specific enrollment)",
        enrollments: enrollments?.map((e: any) => ({
          id: e.id,
          workflow_name: e.workflow?.name,
          patient_id: e.patient_id,
          status: e.status,
          created_at: e.created_at,
          workflow_nodes_count: e.workflow?.config?.nodes?.length || 0,
        })),
      });
    }

    // Get specific enrollment
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("workflow_enrollments")
      .select(`
        id,
        workflow_id,
        patient_id,
        deal_id,
        status,
        trigger_data,
        created_at,
        workflow:workflows(id, name, config, active)
      `)
      .eq("id", enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found", details: enrollmentError?.message },
        { status: 404 }
      );
    }

    // Get steps for this enrollment
    const { data: steps, error: stepsError } = await supabaseAdmin
      .from("workflow_enrollment_steps")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("created_at", { ascending: true });

    // Parse workflow config
    const workflow = enrollment.workflow as any;
    const workflowConfig = workflow?.config as { nodes?: any[] } | null;
    const nodes = workflowConfig?.nodes || [];
    
    // Extract action nodes
    const actionNodes = nodes
      .filter((n: any) => n.type === "action")
      .map((n: any) => ({
        id: n.id,
        type: n.type,
        actionType: n.data?.actionType,
        config: n.data?.config,
      }));

    return NextResponse.json({
      enrollment: {
        id: enrollment.id,
        workflow_id: enrollment.workflow_id,
        workflow_name: workflow?.name,
        workflow_active: workflow?.active,
        patient_id: enrollment.patient_id,
        deal_id: enrollment.deal_id,
        status: enrollment.status,
        created_at: enrollment.created_at,
      },
      workflow_structure: {
        total_nodes: nodes.length,
        action_nodes: actionNodes,
        node_types: nodes.map((n: any) => ({ id: n.id, type: n.type })),
      },
      steps: steps || [],
      steps_error: stepsError?.message || null,
      diagnosis: {
        has_action_nodes: actionNodes.length > 0,
        has_trigger_retell_call: actionNodes.some((a: any) => a.actionType === "trigger_retell_call"),
        steps_count: steps?.length || 0,
      },
    });

  } catch (error) {
    console.error("[Debug Enrollment] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
