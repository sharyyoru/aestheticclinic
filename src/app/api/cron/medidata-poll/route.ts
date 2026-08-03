import { NextResponse } from "next/server";
import { POST as pollMediData } from "@/app/api/medidata/poll/route";

const CRON_SECRET = process.env.CRON_SECRET;

// Match the underlying poll route's max duration (300s on Vercel Pro).
export const maxDuration = 300;

async function run(request: Request) {
  const authHeader = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const isVercelCron = vercelCronHeader === "1";
  const hasValidBearer = !!CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isVercelCron && !hasValidBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return pollMediData();
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
