import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyUnsubscribeToken } from "@/lib/marketingUnsubscribe";

export const runtime = "nodejs";

function htmlPage(title: string, message: string, showButton = false, token = "") {
  return new NextResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <main style="max-width:520px;margin:80px auto;padding:32px;background:white;border:1px solid #e2e8f0;border-radius:16px;text-align:center;">
      <h1 style="font-size:24px;margin:0 0 12px;">${title}</h1>
      <p style="color:#475569;line-height:1.6;">${message}</p>
      ${showButton ? `<form method="post"><input type="hidden" name="token" value="${token.replace(/"/g, "&quot;")}" /><button type="submit" style="margin-top:12px;border:0;border-radius:999px;background:#059669;color:white;padding:12px 22px;font-weight:600;cursor:pointer;">Unsubscribe</button></form>` : ""}
    </main>
  </body>
</html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function unsubscribe(token: string) {
  const payload = verifyUnsubscribeToken(token);
  if (!payload) return { ok: false as const, status: 400, error: "This unsubscribe link is invalid." };

  const { error } = await supabaseAdmin
    .from("patients")
    .update({ marketing_opt_out: true })
    .eq("id", payload.patientId);
  if (error) return { ok: false as const, status: 500, error: "We could not update your preferences. Please try again." };
  return { ok: true as const, email: payload.email };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!verifyUnsubscribeToken(token)) {
    return htmlPage("Invalid link", "This unsubscribe link is invalid or incomplete.");
  }
  return htmlPage(
    "Unsubscribe",
    "Confirm that you no longer want to receive marketing emails from Aesthetics Clinic.",
    true,
    token,
  );
}

export async function POST(request: Request) {
  const urlToken = new URL(request.url).searchParams.get("token");
  let bodyToken = "";
  if (!urlToken) {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      bodyToken = ((await request.json()) as { token?: string }).token || "";
    } else {
      bodyToken = String((await request.formData()).get("token") || "");
    }
  }

  const result = await unsubscribe(urlToken || bodyToken);
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (acceptsHtml) {
    return result.ok
      ? htmlPage("You’re unsubscribed", "You will no longer receive marketing emails from Aesthetics Clinic.")
      : htmlPage("Unable to unsubscribe", result.error);
  }
  return NextResponse.json(
    result.ok ? { ok: true, unsubscribed: true } : { error: result.error },
    { status: result.ok ? 200 : result.status },
  );
}
