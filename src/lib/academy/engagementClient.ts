import { supabaseClient } from "@/lib/supabaseClient";

export async function postAcademyEngagement(body: Record<string, unknown>) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const response = await fetch("/api/academy/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return response.ok ? response.json() : null;
}

export async function getAcademyEngagement(lessonId: string) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const response = await fetch(`/api/academy/engagement?lessonId=${encodeURIComponent(lessonId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.engagement ?? null;
}
