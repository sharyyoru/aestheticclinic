import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Lead Analytics API
 *
 * Returns aggregated lead statistics for the lead-analytics dashboard:
 *   - By channel (Meta, TikTok, Google, Direct calls, Organic website, Organic social, Other)
 *   - By service / campaign
 *   - By status (deal stage)
 *
 * Query params:
 *   - from: YYYY-MM-DD (default: 30 days ago)
 *   - to:   YYYY-MM-DD (default: today)
 */

// Map patient.source values to display channels
function sourceToChannel(source: string | null): string {
  if (!source) return "Other";
  const s = source.toLowerCase();
  if (s === "facebook lead ads" || s === "meta") return "Meta";
  if (s === "google") return "Google";
  if (s === "retell ai agent") return "Direct calls";
  if (
    s === "embed_contact" ||
    s === "embed_booking" ||
    s === "intake_form" ||
    s === "online_booking"
  )
    return "Organic website";
  if (s === "manual") return "Organic social";
  if (s === "inbound_email") return "Direct calls";
  if (s === "axenita_import") return "Other";
  return "Other";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

    const fromIso = new Date(from + "T00:00:00Z").toISOString();
    const toIso = new Date(to + "T23:59:59Z").toISOString();

    // ── 1. Fetch patients in date range ──
    const { data: patients, error: pErr } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email, phone, source, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false });

    if (pErr) throw pErr;

    // ── 2. Fetch webhook_queue to identify TikTok vs Meta ──
    // TikTok leads come through the same zapier-facebook-leads webhook but
    // have service names starting with "TT". We need to cross-reference
    // to split Meta vs TikTok accurately.
    const { data: webhooks } = await supabaseAdmin
      .from("webhook_queue")
      .select("payload, created_at, status")
      .eq("source", "zapier-facebook-leads")
      .eq("status", "completed")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    // Build a set of TikTok lead emails (service starts with "TT")
    const tiktokEmails = new Set<string>();
    const tiktokPhones = new Set<string>();
    const metaEmails = new Set<string>();
    const metaPhones = new Set<string>();
    (webhooks || []).forEach((w) => {
      const service = (w.payload?.service as string) || "";
      const email = (w.payload?.email as string)?.toLowerCase();
      const phone = w.payload?.phone_number as string;
      if (service.toUpperCase().startsWith("TT")) {
        if (email) tiktokEmails.add(email);
        if (phone) tiktokPhones.add(phone);
      } else {
        if (email) metaEmails.add(email);
        if (phone) metaPhones.add(phone);
      }
    });

    // ── 3. Re-classify patients: Facebook Lead Ads → Meta or TikTok ──
    const channelCounts: Record<string, number> = {};
    const channelLeads: Record<string, Array<{ id: string; name: string; email: string; phone: string; created_at: string; source: string }>> = {};

    (patients || []).forEach((p) => {
      let channel = sourceToChannel(p.source);
      // Override: if source is Facebook Lead Ads, check if they're TikTok
      if (p.source === "Facebook Lead Ads") {
        const email = p.email?.toLowerCase();
        if ((email && tiktokEmails.has(email)) || (p.phone && tiktokPhones.has(p.phone))) {
          channel = "TikTok";
        } else {
          channel = "Meta";
        }
      }
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      if (!channelLeads[channel]) channelLeads[channel] = [];
      channelLeads[channel].push({
        id: p.id,
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        email: p.email || "",
        phone: p.phone || "",
        created_at: p.created_at,
        source: p.source || "",
      });
    });

    // ── 4. Fetch deals in date range for service & status breakdowns ──
    const { data: deals } = await supabaseAdmin
      .from("deals")
      .select("id, title, stage_id, service_id, patient_id, created_at, service_interest, source")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false });

    // Fetch stages
    const { data: stages } = await supabaseAdmin
      .from("deal_stages")
      .select("id, name, type, sort_order")
      .neq("is_demo", true)
      .order("sort_order", { ascending: true });

    const stageMap: Record<string, string> = {};
    (stages || []).forEach((s) => {
      stageMap[s.id] = s.name;
    });

    // Deals by status (stage)
    const statusCounts: Record<string, number> = {};
    (deals || []).forEach((d) => {
      const stageName = stageMap[d.stage_id] || "Unknown";
      statusCounts[stageName] = (statusCounts[stageName] || 0) + 1;
    });

    // Deals by service (extract service from title — format: "FirstName LastName - Service")
    const serviceCounts: Record<string, number> = {};
    (deals || []).forEach((d) => {
      const title = d.title || "";
      const parts = title.split(" - ");
      const service = parts.length > 1 ? parts.slice(1).join(" - ") : title;
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });

    // ── 5. Fetch call_logs for direct call counts ──
    const { count: callCount } = await supabaseAdmin
      .from("call_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    // ── 6. Fetch webhook_queue for campaign/ad breakdown ──
    const campaignCounts: Record<string, number> = {};
    (webhooks || []).forEach((w) => {
      const service = (w.payload?.service as string) || "Unknown";
      campaignCounts[service] = (campaignCounts[service] || 0) + 1;
    });

    // ── 7. Webhook failures (leads that came in but couldn't be processed) ──
    const { data: failedWebhooks } = await supabaseAdmin
      .from("webhook_queue")
      .select("payload, created_at, error_message")
      .eq("source", "zapier-facebook-leads")
      .eq("status", "failed")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    const failedCount = (failedWebhooks || []).length;

    // ── 8. Build response ──
    const totalLeads = (patients || []).length;

    return NextResponse.json({
      success: true,
      dateRange: { from, to },
      summary: {
        totalLeads,
        totalDeals: (deals || []).length,
        totalCalls: callCount || 0,
        failedWebhooks: failedCount,
      },
      byChannel: Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([channel, count]) => ({
          channel,
          count,
          percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : "0",
        })),
      byService: Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([service, count]) => ({
          service,
          count,
          percentage: (deals || []).length > 0 ? ((count / (deals || []).length) * 100).toFixed(1) : "0",
        })),
      byCampaign: Object.entries(campaignCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([campaign, count]) => ({
          campaign,
          count,
        })),
      byStatus: Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({
          status,
          count,
          percentage: (deals || []).length > 0 ? ((count / (deals || []).length) * 100).toFixed(1) : "0",
        })),
      channelLeads,
    });
  } catch (error) {
    console.error("[Lead Analytics API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
