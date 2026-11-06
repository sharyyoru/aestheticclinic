import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { User } from "@supabase/supabase-js";

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Membership = {
  organization_id: string;
  role: string | null;
};

export type AuthContext = {
  user: User;
  membership: Membership;
};

const INTERNAL_USER_ID = "00000000-0000-0000-0000-000000000000";
// Single-tenant deployment: one logical organization.
const DEFAULT_ORG_ID = "aesthetics-ge";

// Server-to-server calls (cron, public flows triggering workflows) authenticate
// with a shared secret instead of a user token.
export function isInternalRequest(
  request: Request | NextRequest | Headers
): boolean {
  const headers = request instanceof Headers ? request : request.headers;
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret && headers.get("x-internal-api-secret") === secret) return true;
  // Vercel cron / internal kicks authenticate with CRON_SECRET.
  const cron = process.env.CRON_SECRET;
  if (cron && headers.get("authorization") === `Bearer ${cron}`) return true;
  return false;
}

// Headers for API routes calling other API routes over HTTP. Prefers
// INTERNAL_API_SECRET; falls back to CRON_SECRET, which is already configured
// in production, so guarding the routes cannot silently break workflows if the
// new variable has not been set yet.
export function internalAuthHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) return { "x-internal-api-secret": secret };
  const cron = process.env.CRON_SECRET;
  if (cron) return { authorization: `Bearer ${cron}` };
  return {};
}

function internalContext(): AuthContext {
  return {
    user: { id: INTERNAL_USER_ID } as User,
    membership: { organization_id: DEFAULT_ORG_ID, role: "owner" },
  };
}

// Extracts and verifies the caller's Supabase access token from the
// Authorization header. Returns null when missing/invalid.
export async function getUserFromRequest(
  request: Request | NextRequest | Headers
): Promise<User | null> {
  const headers = request instanceof Headers ? request : request.headers;
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// Staff membership = a row in public.users whose role is not 'patient'.
// This deliberately mirrors public.is_staff_user() from the 2026-10-21 RLS
// lockdown, so the API layer and the database agree on who is staff. Patient
// app accounts authenticate via the OTP API and must not reach staff routes.
// Role is read from public.users.role, which is writable only through
// service-role routes — never from client-writable user_metadata.
async function getMembership(userId: string): Promise<Membership | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const role = ((data as { role?: string | null }).role ?? "staff").toLowerCase();
  if (role === "patient") return null;
  return { organization_id: DEFAULT_ORG_ID, role };
}

function roleAllowed(role: string | null, roles: string[]): boolean {
  const r = (role ?? "").toLowerCase();
  return roles.map((x) => x.toLowerCase()).includes(r);
}

// Verified user + staff record.
export async function requireStaff(
  request: Request | NextRequest | Headers
): Promise<AuthContext> {
  if (isInternalRequest(request)) return internalContext();
  const user = await getUserFromRequest(request);
  if (!user) throw new AuthError(401, "Unauthorized");
  const membership = await getMembership(user.id);
  if (!membership) throw new AuthError(403, "Forbidden");
  return { user, membership };
}

// Verified user + staff record whose role is in `roles`.
export async function requireRole(
  request: Request | NextRequest | Headers,
  roles: string[]
): Promise<AuthContext> {
  if (isInternalRequest(request)) return internalContext();
  const user = await getUserFromRequest(request);
  if (!user) throw new AuthError(401, "Unauthorized");
  const membership = await getMembership(user.id);
  if (!membership) throw new AuthError(403, "Forbidden");
  if (!roleAllowed(membership.role, roles)) {
    throw new AuthError(403, "Forbidden");
  }
  return { user, membership };
}

// Kept for API compatibility; single-tenant so orgId is ignored.
export async function requireOrgRole(
  request: Request | NextRequest | Headers,
  _orgId: string,
  roles?: string[]
): Promise<AuthContext> {
  return roles ? requireRole(request, roles) : requireStaff(request);
}

// Convenience: returns a 401/403 response for AuthError, otherwise rethrows.
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
