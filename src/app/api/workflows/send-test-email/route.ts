import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SendTestEmailRequestBody = {
  to?: string;
  subjectTemplate?: string;
  bodyTemplate?: string | null;
  bodyHtmlTemplate?: string | null;
  useHtml?: boolean;
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
    const body = (await request.json()) as SendTestEmailRequestBody;
    const to = (body.to || "").trim();
    const subjectTemplate =
      (body.subjectTemplate || "Workflow test email from your clinic").trim();
    const bodyTemplate =
      body.bodyTemplate ??
      [
        "Hi {{patient.first_name}}",
        "",
        "This is a test email generated from your workflow template.",
        "",
        "Deal: {{deal.title}}",
        "Pipeline: {{deal.pipeline}}",
        "",
        "Best regards,",
        "Your clinic team",
      ].join("\n");
    const bodyHtmlTemplate = body.bodyHtmlTemplate ?? null;
    const useHtml = Boolean(body.useHtml);

    if (!to) {
      return NextResponse.json({ error: "to is required" }, { status: 400 });
    }

    const templateContext = {
      patient: {
        id: "test-patient-id",
        first_name: "Test",
        last_name: "Patient",
        email: to,
        phone: "+41000000000",
      },
      deal: {
        id: "test-deal-id",
        title: "Sample procedure",
        pipeline: "Test pipeline",
        notes: "Sample notes for test email.",
      },
      from_stage: {
        id: "from-stage-id",
        name: "Request for information",
        type: "lead",
      },
      to_stage: {
        id: "to-stage-id",
        name: "Request processed",
        type: "consultation",
      },
    };

    const subject = renderTemplate(subjectTemplate, templateContext);

    let html: string;
    if (useHtml && bodyHtmlTemplate && bodyHtmlTemplate.trim().length > 0) {
      const rendered = renderTemplate(bodyHtmlTemplate, templateContext);
      html = rendered.trim().length > 0 ? rendered : "<p>(Empty HTML body)</p>";
    } else {
      const renderedText = renderTemplate(bodyTemplate, templateContext);
      html = textToHtml(renderedText || "(Empty body)");
    }

    const sendUrl = new URL("/api/emails/send", request.url);

    const response = await fetch(sendUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        fromUserEmail: null,
        emailId: null,
      }),
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error ||
            "Failed to send test email via provider. Check MAILGUN configuration.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in /api/workflows/send-test-email", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 },
    );
  }
}
