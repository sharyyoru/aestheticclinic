import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getAcademyUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}
