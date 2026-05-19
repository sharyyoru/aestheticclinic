import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  });
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, params, sessionId } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const patientId = params?.patientId;
    if (!patientId) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 });
    }

    const meta = user.user_metadata as Record<string, unknown>;
    const userName = `${meta.first_name || ""} ${meta.last_name || ""}`.trim() || user.email;

    let result: { success: boolean; message: string; change?: Record<string, unknown>; data?: unknown } = {
      success: false,
      message: "Unknown action",
    };

    switch (action) {
      case "create_note": {
        const content = params.content || params.note || params.body;
        if (!content) {
          return NextResponse.json({ error: "Note content is required" }, { status: 400 });
        }

        const { data: note, error } = await supabaseAdmin
          .from("patient_notes")
          .insert({
            patient_id: patientId,
            author_user_id: user.id,
            author_name: userName,
            body: content,
          })
          .select("id")
          .single();

        if (error) {
          result = { success: false, message: `Failed to create note: ${error.message}` };
        } else {
          result = {
            success: true,
            message: `Note added successfully.`,
            change: {
              type: "create",
              entity: "note",
              description: `Added note: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
              data: { noteId: note.id },
            },
          };
        }
        break;
      }

      case "create_task": {
        const taskName = params.name || params.title || params.task;
        if (!taskName) {
          return NextResponse.json({ error: "Task name is required" }, { status: 400 });
        }

        const { data: task, error } = await supabaseAdmin
          .from("tasks")
          .insert({
            patient_id: patientId,
            name: taskName,
            status: "not_started",
            assigned_user_id: user.id,
            assigned_user_name: userName,
            due_date: params.due_date || null,
            priority: params.priority || "medium",
          })
          .select("id")
          .single();

        if (error) {
          result = { success: false, message: `Failed to create task: ${error.message}` };
        } else {
          result = {
            success: true,
            message: `Task "${taskName}" created and assigned to you.`,
            change: {
              type: "create",
              entity: "task",
              description: `Created task: "${taskName}"`,
              data: { taskId: task.id },
            },
          };
        }
        break;
      }

      case "update_patient": {
        const { field, value } = params;
        if (!field || value === undefined) {
          return NextResponse.json({ error: "Field and value are required" }, { status: 400 });
        }

        const allowedFields = ["phone", "mobile", "email", "street_address", "postal_code", "town", "country"];
        if (!allowedFields.includes(field)) {
          return NextResponse.json({ error: `Cannot update field: ${field}` }, { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from("patients")
          .update({ [field]: value })
          .eq("id", patientId);

        if (error) {
          result = { success: false, message: `Failed to update: ${error.message}` };
        } else {
          result = {
            success: true,
            message: `Patient ${field} updated to "${value}".`,
            change: {
              type: "update",
              entity: "patient",
              description: `Updated ${field} to "${value}"`,
            },
          };
        }
        break;
      }

      case "send_payment_reminder": {
        // Get patient and pending invoices
        const { data: patient } = await supabaseAdmin
          .from("patients")
          .select("email, first_name, last_name")
          .eq("id", patientId)
          .single();

        const { data: pendingInvoices } = await supabaseAdmin
          .from("invoices")
          .select("invoice_number, total_amount, paid_amount")
          .eq("patient_id", patientId)
          .neq("status", "paid");

        if (!patient?.email) {
          result = { success: false, message: "Patient has no email address." };
        } else if (!pendingInvoices?.length) {
          result = { success: false, message: "No pending invoices to remind about." };
        } else {
          // In production, this would send an actual email
          result = {
            success: true,
            message: `Payment reminder would be sent to ${patient.email} for ${pendingInvoices.length} pending invoice(s).`,
            change: {
              type: "create",
              entity: "email",
              description: `Sent payment reminder to ${patient.email}`,
            },
          };
        }
        break;
      }

      case "schedule_appointment": {
        const { date, time, reason, duration } = params;
        if (!date || !time) {
          return NextResponse.json({ error: "Date and time are required" }, { status: 400 });
        }

        const startTime = new Date(`${date}T${time}:00`);
        const endTime = new Date(startTime.getTime() + (duration || 30) * 60 * 1000);

        const { data: appointment, error } = await supabaseAdmin
          .from("appointments")
          .insert({
            patient_id: patientId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            reason: reason || "Consultation",
            status: "scheduled",
            source: "appx_assistant",
          })
          .select("id")
          .single();

        if (error) {
          result = { success: false, message: `Failed to schedule: ${error.message}` };
        } else {
          result = {
            success: true,
            message: `Appointment scheduled for ${startTime.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
            change: {
              type: "create",
              entity: "appointment",
              description: `Scheduled appointment: ${reason || "Consultation"} on ${startTime.toLocaleDateString()}`,
              data: { appointmentId: appointment.id },
            },
          };
        }
        break;
      }

      case "mark_invoice_paid": {
        const { invoiceId } = params;
        if (!invoiceId) {
          return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
        }

        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .select("total_amount")
          .eq("id", invoiceId)
          .single();

        if (!invoice) {
          result = { success: false, message: "Invoice not found." };
        } else {
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({ status: "paid", paid_amount: invoice.total_amount })
            .eq("id", invoiceId);

          if (error) {
            result = { success: false, message: `Failed to update invoice: ${error.message}` };
          } else {
            result = {
              success: true,
              message: "Invoice marked as paid.",
              change: {
                type: "update",
                entity: "invoice",
                description: "Marked invoice as paid",
                data: { invoiceId },
              },
            };
          }
        }
        break;
      }

      default:
        result = { success: false, message: `Unknown action: ${action}` };
    }

    // Update session with the action
    if (sessionId && result.success && result.change) {
      const { data: session } = await supabaseAdmin
        .from("appx_sessions")
        .select("changes")
        .eq("id", sessionId)
        .single();

      if (session) {
        const changes = Array.isArray(session.changes) ? session.changes : [];
        await supabaseAdmin
          .from("appx_sessions")
          .update({
            changes: [...changes, { ...result.change, timestamp: Date.now() }],
          })
          .eq("id", sessionId);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Execute error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to execute action" },
      { status: 500 }
    );
  }
}
