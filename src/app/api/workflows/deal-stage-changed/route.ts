import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Sales team users for round-robin assignment
const SALES_TEAM_NAMES = ["Charline", "Elite", "Audrey", "Bubuque", "Victoria"];

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunFromEmail = process.env.MAILGUN_FROM_EMAIL;
const mailgunFromName = process.env.MAILGUN_FROM_NAME || "Clinic";
const mailgunApiBaseUrl =
  process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net";

type DealStageChangedPayload = {
  dealId: string;
  patientId: string;
  fromStageId: string | null;
  toStageId: string;
  pipeline: string | null;
};

function resolvePath(object: unknown, path: string): unknown {
  const parts = path.split(".").map((part) => part.trim()).filter(Boolean);

  return parts.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    if (!(key in (current as Record<string, unknown>))) return undefined;
    return (current as Record<string, unknown>)[key];
  }, object);
}

function renderTemplate(template: string, context: unknown): string {
  if (!template) return "";

  return template.replace(/{{\s*([^}]+?)\s*}}/g, (_match, rawPath) => {
    const value = resolvePath(context, String(rawPath));
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\r?\n/g)
    .map((line) => (line.length === 0 ? "<br />" : line))
    .join("<br />");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<DealStageChangedPayload>;

    const dealId = body.dealId?.trim();
    const patientId = body.patientId?.trim();
    const toStageId = body.toStageId?.trim() ?? null;
    const fromStageId = body.fromStageId?.trim() ?? null;
    const pipeline = (body.pipeline ?? null) as string | null;

    if (!dealId || !patientId || !toStageId) {
      return NextResponse.json(
        { error: "Missing required fields: dealId, patientId, toStageId" },
        { status: 400 },
      );
    }

    const [{ data: deal, error: dealError }, { data: patient, error: patientError }] =
      await Promise.all([
        supabaseAdmin
          .from("deals")
          .select(
            "id, patient_id, stage_id, service_id, pipeline, contact_label, location, title, value, notes, created_at, updated_at",
          )
          .eq("id", dealId)
          .maybeSingle(),
        supabaseAdmin
          .from("patients")
          .select("id, first_name, last_name, email, phone")
          .eq("id", patientId)
          .maybeSingle(),
      ]);

    if (dealError || !deal) {
      return NextResponse.json(
        { error: dealError?.message ?? "Deal not found" },
        { status: 404 },
      );
    }

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message ?? "Patient not found" },
        { status: 404 },
      );
    }

    const safeDeal = deal as {
      id: string;
      title: string | null;
      pipeline: string | null;
      notes: string | null;
    };

    const safePatient = patient as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
    };

    const stageIdsToFetch: string[] = [];
    if (fromStageId) stageIdsToFetch.push(fromStageId);
    if (toStageId) stageIdsToFetch.push(toStageId);

    let fromStage: { id: string; name: string; type: string } | null = null;
    let toStage: { id: string; name: string; type: string } | null = null;

    if (stageIdsToFetch.length > 0) {
      const { data: stagesData, error: stagesError } = await supabaseAdmin
        .from("deal_stages")
        .select("id, name, type")
        .in("id", stageIdsToFetch);

      if (!stagesError && stagesData) {
        for (const row of stagesData as { id: string; name: string; type: string }[]) {
          if (row.id === fromStageId) {
            fromStage = row;
          }
          if (row.id === toStageId) {
            toStage = row;
          }
        }
      }
    }

    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from("workflows")
      .select("id, name, trigger_type, active, config")
      .eq("trigger_type", "deal_stage_changed")
      .eq("active", true);

    if (workflowsError) {
      console.error("Failed to load workflows", workflowsError);
      return NextResponse.json(
        { error: "Failed to load workflows" },
        { status: 500 },
      );
    }

    if (!workflows || workflows.length === 0) {
      return NextResponse.json({ ok: true, workflows: 0, actionsRun: 0 });
    }

    const matchingWorkflows = (workflows as any[]).filter((workflow) => {
      const config = (workflow.config || {}) as {
        from_stage_id?: string | null;
        to_stage_id?: string | null;
        pipeline?: string | null;
        trigger_on_creation?: boolean;
      };

      // Check if this is a deal creation (no fromStageId means new deal)
      const isDealCreation = !fromStageId;
      
      // If workflow is configured to trigger on creation and this is a new deal
      if (config.trigger_on_creation && isDealCreation) {
        // Only need to match the to_stage_id (the initial stage)
        if (config.to_stage_id && config.to_stage_id !== toStageId) {
          return false;
        }
      } else if (!isDealCreation) {
        // Normal stage change - check from and to stages
        if (config.to_stage_id && config.to_stage_id !== toStageId) {
          return false;
        }

        if (config.from_stage_id && config.from_stage_id !== fromStageId) {
          return false;
        }
      } else {
        // Deal creation but workflow doesn't have trigger_on_creation enabled
        // Still trigger if to_stage matches and no from_stage is configured
        if (config.to_stage_id && config.to_stage_id !== toStageId) {
          return false;
        }
        // If workflow expects a from_stage but this is a creation, don't match
        if (config.from_stage_id) {
          return false;
        }
      }

      if (config.pipeline && pipeline) {
        if (config.pipeline.toLowerCase() !== pipeline.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    if (matchingWorkflows.length === 0) {
      return NextResponse.json({ ok: true, workflows: 0, actionsRun: 0 });
    }

    const templateContext = {
      patient: {
        id: safePatient.id,
        first_name: safePatient.first_name,
        last_name: safePatient.last_name,
        email: safePatient.email,
        phone: safePatient.phone,
      },
      deal: {
        id: safeDeal.id,
        title: safeDeal.title,
        pipeline: safeDeal.pipeline,
        notes: safeDeal.notes,
      },
      from_stage: fromStage,
      to_stage: toStage,
    };

    let actionsRun = 0;

    for (const workflow of matchingWorkflows) {
      // Create workflow enrollment record
      const { data: enrollment, error: enrollmentError } = await supabaseAdmin
        .from("workflow_enrollments")
        .insert({
          workflow_id: workflow.id,
          patient_id: safePatient.id,
          deal_id: safeDeal.id,
          status: "active",
          trigger_data: {
            from_stage: fromStage,
            to_stage: toStage,
            deal: safeDeal,
            patient: safePatient,
          },
        })
        .select("id")
        .single();

      if (enrollmentError) {
        console.error("Failed to create workflow enrollment:", enrollmentError);
      }

      const enrollmentId = enrollment?.id;

      // Support both old workflow_actions table and new config.nodes format
      let actionsToRun: { action_type: string; config: any }[] = [];

      // Check for new builder format (config.nodes)
      const workflowConfig = workflow.config as { nodes?: any[] } | null;
      if (workflowConfig?.nodes && Array.isArray(workflowConfig.nodes)) {
        // Extract action nodes from the new format
        actionsToRun = workflowConfig.nodes
          .filter((node: any) => node.type === "action")
          .map((node: any) => ({
            action_type: node.data?.actionType || "",
            config: node.data?.config || {},
          }));
      }

      // Fall back to old workflow_actions table if no nodes in config
      if (actionsToRun.length === 0) {
        const { data: actions, error: actionsError } = await supabaseAdmin
          .from("workflow_actions")
          .select("id, action_type, config, sort_order")
          .eq("workflow_id", workflow.id)
          .order("sort_order", { ascending: true });

        if (!actionsError && actions && actions.length > 0) {
          actionsToRun = actions.map((a: any) => ({
            action_type: a.action_type,
            config: a.config || {},
          }));
        }
      }

      if (actionsToRun.length === 0) {
        console.log(`Workflow ${workflow.id} has no actions to run`);
        continue;
      }

      console.log(`Running ${actionsToRun.length} actions for workflow ${workflow.id}`);

      for (const action of actionsToRun) {
        console.log(`Processing action: ${action.action_type}`, JSON.stringify(action.config));
        
        // Handle create_task action type
        if (action.action_type === "create_task") {
          const config = (action.config || {}) as {
            title?: string;
            assign_to?: string | string[];
            due_days?: number;
          };

          console.log(`Task config.title: "${config.title}"`);
          console.log(`Task config.assign_to:`, config.assign_to);
          console.log(`Template context patient:`, templateContext.patient);
          
          const taskName = renderTemplate(config.title || "New Task", templateContext);
          console.log(`Rendered task name: "${taskName}"`);
          const dueDays = typeof config.due_days === "number" ? config.due_days : 1;
          const activityDate = new Date();
          activityDate.setDate(activityDate.getDate() + dueDays);

          // USE WORKFLOW-SPECIFIC ASSIGNEES from config.assign_to
          let assignedUserId: string | null = null;
          let assignedUserName: string | null = null;
          
          // Get the assigned user IDs from workflow config
          const assignToIds: string[] = [];
          if (config.assign_to) {
            if (Array.isArray(config.assign_to)) {
              assignToIds.push(...config.assign_to);
            } else if (typeof config.assign_to === "string") {
              assignToIds.push(config.assign_to);
            }
          }

          if (assignToIds.length > 0) {
            // Fetch the specified users from the database
            const { data: assignedUsers } = await supabaseAdmin
              .from("users")
              .select("id, full_name, email")
              .in("id", assignToIds);

            if (assignedUsers && assignedUsers.length > 0) {
              // If multiple assignees configured, use round-robin among ONLY the configured users
              if (assignedUsers.length === 1) {
                const user = assignedUsers[0];
                assignedUserId = user.id;
                assignedUserName = user.full_name || user.email || null;
              } else {
                // Round-robin among the workflow's configured assignees only
                const { count: taskCount } = await supabaseAdmin
                  .from("tasks")
                  .select("*", { count: "exact", head: true })
                  .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

                const assigneeIndex = (taskCount || 0) % assignedUsers.length;
                const user = assignedUsers[assigneeIndex];
                assignedUserId = user.id;
                assignedUserName = user.full_name || user.email || null;
              }
              console.log(`Workflow-specific assignment to: ${assignedUserName} (id: ${assignedUserId})`);
            } else {
              console.warn(`Configured assignee IDs not found in users table: ${assignToIds.join(", ")}`);
            }
          } else {
            console.log("No assign_to configured in workflow, task will be unassigned");
          }

          const { error: taskError } = await supabaseAdmin
            .from("tasks")
            .insert({
              name: taskName,
              content: `Auto-created by workflow for deal: ${safeDeal.title || safeDeal.id}`,
              status: "not_started",
              priority: "medium",
              type: "todo",
              activity_date: activityDate.toISOString(),
              assigned_user_id: assignedUserId,
              assigned_user_name: assignedUserName,
              patient_id: safePatient.id,
            });

          if (taskError) {
            console.error("Failed to create task:", taskError);
            // Log failed step
            if (enrollmentId) {
              await supabaseAdmin.from("workflow_enrollment_steps").insert({
                enrollment_id: enrollmentId,
                step_type: "action",
                step_action: "create_task",
                step_config: config,
                status: "failed",
                executed_at: new Date().toISOString(),
                error_message: taskError.message,
              });
            }
          } else {
            console.log(`Created task: ${taskName}`);
            actionsRun += 1;
            // Log successful step
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
          continue;
        }

        // Handle send_email action type (new builder format)
        if (action.action_type === "send_email" || action.action_type === "draft_email_patient") {
          const config = (action.config || {}) as {
            subject_template?: string;
            subject?: string;
            body_template?: string;
            body_html_template?: string;
            template_id?: string;
            use_html?: boolean;
            send_mode?: "immediate" | "delay" | "recurring";
            delay_minutes?: number | null;
            recurring_days?: number | null;
            recurring_times?: number | null;
            recurring_every_days?: number | null;
            recipient?: string;
            user_id?: string;
            email_address?: string;
          };

          // Load email template if template_id is specified
          let templateHtml: string | null = null;
          let templateSubject: string | null = null;
          if (config.template_id) {
            const { data: template } = await supabaseAdmin
              .from("email_templates")
              .select("subject_template, body_template, html_content")
              .eq("id", config.template_id)
              .single();
            
            if (template) {
              templateHtml = template.html_content || template.body_template;
              templateSubject = template.subject_template;
            }
          }

          const subjectTemplate =
            config.subject || config.subject_template || templateSubject ||
            "Your information request has been processed";

          const bodyTemplate =
            config.body_template ??
            [
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

          // Determine recipient email based on config
          let recipientEmail: string | null = null;
          let recipientName: string | null = null;

          if (config.recipient === "specific_user" && config.user_id) {
            // Look up user email
            const { data: user } = await supabaseAdmin
              .from("users")
              .select("email, full_name")
              .eq("id", config.user_id)
              .single();
            if (user?.email) {
              recipientEmail = user.email;
              recipientName = user.full_name || user.email;
            }
          } else if (config.recipient === "specific_email" && config.email_address) {
            recipientEmail = config.email_address;
          } else if (config.recipient === "assigned_user") {
            // Use deal's assigned user if available (future enhancement)
            recipientEmail = safePatient.email;
          } else {
            // Default: send to patient (deal_patient or no recipient specified)
            recipientEmail = safePatient.email;
          }

          if (!recipientEmail) {
            console.log("No valid recipient email, skipping email action");
            continue;
          }

          const subject = renderTemplate(subjectTemplate, templateContext);

          const now = new Date();
          const sendMode: "immediate" | "delay" | "recurring" =
            config.send_mode === "delay" || config.send_mode === "recurring"
              ? config.send_mode
              : "immediate";

          const delayMinutes =
            typeof config.delay_minutes === "number" && config.delay_minutes > 0
              ? config.delay_minutes
              : null;
          const recurringEveryDays =
            (typeof config.recurring_days === "number" && config.recurring_days > 0
              ? config.recurring_days
              : null) ||
            (typeof config.recurring_every_days === "number" &&
            config.recurring_every_days > 0
              ? config.recurring_every_days
              : null);
          const recurringTimes =
            typeof config.recurring_times === "number" &&
            config.recurring_times > 0
              ? Math.min(config.recurring_times, 30)
              : null;

          async function createAndSendEmail(scheduledAt: Date | null) {
            let bodyHtml: string;
            if (templateHtml) {
              bodyHtml = renderTemplate(templateHtml, templateContext);
            } else if (
              config.use_html &&
              config.body_html_template &&
              config.body_html_template.trim().length > 0
            ) {
              const htmlTemplate = config.body_html_template;
              bodyHtml = renderTemplate(htmlTemplate, templateContext);
            } else {
              const bodyText = renderTemplate(bodyTemplate, templateContext);
              bodyHtml = textToHtml(bodyText);
            }

            const effectiveDate = scheduledAt ?? now;
            const isFuture = effectiveDate.getTime() > now.getTime();
            const sentStatus = isFuture ? "queued" : "sent";
            const sentAtIso = effectiveDate.toISOString();

            const { data: inserted, error: insertError } = await supabaseAdmin
              .from("emails")
              .insert({
                patient_id: safePatient.id,
                deal_id: safeDeal.id,
                to_address: recipientEmail,
                from_address: null,
                subject,
                body: bodyHtml,
                status: sentStatus,
                direction: "outbound",
                sent_at: sentAtIso,
              })
              .select("id")
              .single();

            if (insertError || !inserted) {
              console.error("Failed to insert workflow email row", insertError);
              // Log failed step
              if (enrollmentId) {
                await supabaseAdmin.from("workflow_enrollment_steps").insert({
                  enrollment_id: enrollmentId,
                  step_type: "action",
                  step_action: "send_email",
                  step_config: config,
                  status: "failed",
                  executed_at: new Date().toISOString(),
                  error_message: insertError?.message || "Failed to insert email",
                });
              }
              return;
            }

            actionsRun += 1;
            // Log successful step
            if (enrollmentId) {
              await supabaseAdmin.from("workflow_enrollment_steps").insert({
                enrollment_id: enrollmentId,
                step_type: "action",
                step_action: "send_email",
                step_config: config,
                status: "completed",
                executed_at: new Date().toISOString(),
                result: { email_id: (inserted as any).id, subject, recipient: recipientEmail },
              });
            }

            if (!mailgunApiKey || !mailgunDomain) {
              return;
            }

            try {
              const domain = mailgunDomain as string;
              const emailId = (inserted as any).id as string;
              const replyAlias = emailId ? `reply+${emailId}@${domain}` : null;

              const fromAddress = mailgunFromEmail || `no-reply@${domain}`;

              const params = new URLSearchParams();
              params.append("from", `${mailgunFromName} <${fromAddress}>`);
              params.append("to", recipientEmail as string);
              params.append("subject", subject);
              params.append("html", bodyHtml);

              if (replyAlias) {
                params.append("h:Reply-To", replyAlias);
              }

              if (isFuture) {
                params.append("o:deliverytime", effectiveDate.toUTCString());
              }

              const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");

              const response = await fetch(
                `${mailgunApiBaseUrl}/v3/${domain}/messages`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: params.toString(),
                },
              );

              if (!response.ok) {
                const text = await response.text().catch(() => "");
                console.error(
                  "Error sending workflow email via Mailgun",
                  response.status,
                  text,
                );
              }
            } catch (sendError) {
              console.error(
                "Unexpected error sending workflow email via Mailgun",
                sendError,
              );
            }
          }

          if (sendMode === "recurring" && recurringEveryDays && recurringTimes) {
            const intervalMs = recurringEveryDays * 24 * 60 * 60 * 1000;
            for (let i = 0; i < recurringTimes; i += 1) {
              const scheduledAt = new Date(now.getTime() + i * intervalMs);
              // eslint-disable-next-line no-await-in-loop
              await createAndSendEmail(scheduledAt);
            }
          } else if (sendMode === "delay" && delayMinutes) {
            const scheduledAt = new Date(
              now.getTime() + delayMinutes * 60 * 1000,
            );
            await createAndSendEmail(scheduledAt);
          } else {
            await createAndSendEmail(null);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      workflows: matchingWorkflows.length,
      actionsRun,
    });
  } catch (error) {
    console.error("Unexpected error in /api/workflows/deal-stage-changed", error);
    return NextResponse.json(
      { error: "Unexpected error running workflows" },
      { status: 500 },
    );
  }
}
