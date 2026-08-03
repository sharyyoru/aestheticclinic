"use client";

import { useEffect, useState, useMemo } from "react";
import { Kpi, Th, Td } from "../statistics/tabs/_shared";

type ChannelRow = { channel: string; count: number; percentage: string };
type ServiceRow = { service: string; count: number; percentage: string };
type CampaignRow = { campaign: string; count: number };
type StatusRow = { status: string; count: number; percentage: string };
type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  source: string;
};

type ApiResponse = {
  success: boolean;
  dateRange: { from: string; to: string };
  summary: {
    totalLeads: number;
    totalDeals: number;
    totalCalls: number;
    failedWebhooks: number;
  };
  byChannel: ChannelRow[];
  byService: ServiceRow[];
  byCampaign: CampaignRow[];
  byStatus: StatusRow[];
  channelLeads: Record<string, LeadRow[]>;
};

function startOfMonth(): string {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

const CHANNEL_COLORS: Record<string, string> = {
  Meta: "bg-blue-500",
  TikTok: "bg-slate-900",
  Google: "bg-amber-500",
  "Direct calls": "bg-emerald-500",
  "Organic website": "bg-purple-500",
  "Organic social": "bg-pink-500",
  Other: "bg-slate-400",
};

const STATUS_COLORS: Record<string, string> = {
  "request for information": "bg-slate-100 text-slate-700",
  "Request Processed": "bg-blue-100 text-blue-700",
  "appointment set": "bg-emerald-100 text-emerald-700",
  "moment reflection": "bg-amber-100 text-amber-700",
  "image pending": "bg-orange-100 text-orange-700",
  "request for insurance support": "bg-indigo-100 text-indigo-700",
  "operation scheduled": "bg-violet-100 text-violet-700",
  "closed won": "bg-green-100 text-green-700",
  "closed lost": "bg-red-100 text-red-700",
  "abandoned / unanswered": "bg-rose-100 text-rose-700",
};

export default function LeadAnalyticsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(sixMonthsAgo());
  const [to, setTo] = useState(today());
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/statistics/lead-analytics?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Quick date range presets
  function setPreset(preset: string) {
    const todayStr = today();
    if (preset === "thisMonth") {
      setFrom(startOfMonth());
      setTo(todayStr);
    } else if (preset === "last30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFrom(d.toISOString().slice(0, 10));
      setTo(todayStr);
    } else if (preset === "last90") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setFrom(d.toISOString().slice(0, 10));
      setTo(todayStr);
    } else if (preset === "ytd") {
      setFrom(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
      setTo(todayStr);
    }
  }

  const totalLeads = data?.summary?.totalLeads || 0;
  const maxChannelCount = useMemo(
    () => Math.max(...(data?.byChannel?.map((c) => c.count) || [1])),
    [data],
  );

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      {/* Header */}
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Lead Analytics</h1>
        <p className="text-sm text-slate-500">
          Lead sources, conversion funnel, and campaign performance — all in one place.
        </p>
      </header>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
          </div>
          <div className="flex gap-1">
            {[
              ["thisMonth", "This Month"],
              ["last30", "Last 30d"],
              ["last90", "Last 90d"],
              ["ytd", "YTD"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPreset(k)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Total Leads" value={loading ? "…" : totalLeads} loading={loading} highlight />
        <Kpi label="Total Deals" value={loading ? "…" : data?.summary?.totalDeals || 0} loading={loading} />
        <Kpi label="Direct Calls" value={loading ? "…" : data?.summary?.totalCalls || 0} loading={loading} />
        <Kpi label="Channels" value={loading ? "…" : data?.byChannel?.length || 0} loading={loading} />
        <Kpi
          label="Failed Imports"
          value={loading ? "…" : data?.summary?.failedWebhooks || 0}
          loading={loading}
        />
      </div>

      {/* By Channel — bar chart + table */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Leads by Channel</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : data?.byChannel?.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No leads in this period</div>
        ) : (
          <div className="space-y-2">
            {data?.byChannel?.map((row) => {
              const barWidth = maxChannelCount > 0 ? (row.count / maxChannelCount) * 100 : 0;
              const color = CHANNEL_COLORS[row.channel] || "bg-slate-400";
              const isActive = activeChannel === row.channel;
              return (
                <button
                  key={row.channel}
                  onClick={() => setActiveChannel(isActive ? null : row.channel)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left transition ${
                    isActive ? "border-sky-400 bg-sky-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{row.channel}</span>
                    <span className="tabular-nums text-slate-500">
                      {row.count} <span className="text-slate-400">({row.percentage}%)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-400">Click a channel to see individual leads</p>
      </section>

      {/* Channel leads detail (collapsible) */}
      {activeChannel && data?.channelLeads?.[activeChannel] && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {activeChannel} — {data.channelLeads[activeChannel].length} leads
            </h2>
            <button
              onClick={() => setActiveChannel(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              ✕ Close
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.channelLeads[activeChannel].slice(0, 100).map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <Td>{lead.created_at?.slice(0, 10)}</Td>
                    <Td>{lead.name}</Td>
                    <Td>{lead.email || "—"}</Td>
                    <Td>{lead.phone || "—"}</Td>
                    <Td>{lead.source}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.channelLeads[activeChannel].length > 100 && (
            <p className="mt-2 text-[10px] text-slate-400">
              Showing first 100 of {data.channelLeads[activeChannel].length}
            </p>
          )}
        </section>
      )}

      {/* Two-column: By Service + By Status */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* By Service */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Leads by Service</h2>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Service</Th>
                    <Th align="right">Count</Th>
                    <Th align="right">%</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.byService?.map((row) => (
                    <tr key={row.service} className="hover:bg-slate-50">
                      <Td>{row.service}</Td>
                      <Td align="right">{row.count}</Td>
                      <Td align="right">{row.percentage}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* By Status */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Leads by Status (Pipeline Stage)</h2>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="space-y-1.5">
              {data?.byStatus?.map((row) => {
                const color = STATUS_COLORS[row.status.toLowerCase()] || "bg-slate-100 text-slate-700";
                return (
                  <div
                    key={row.status}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color}`}
                    >
                      {row.status}
                    </span>
                    <span className="tabular-nums text-xs text-slate-600">
                      {row.count} <span className="text-slate-400">({row.percentage}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* By Campaign / Ad */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Leads by Campaign / Ad (Zapier)</h2>
        <p className="mb-3 text-[10px] text-slate-400">
          Campaign names come from Zapier webhook payloads. Counts include duplicates (form resubmissions).
        </p>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Campaign / Form Name</Th>
                  <Th align="right">Submissions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.byCampaign?.map((row) => (
                  <tr key={row.campaign} className="hover:bg-slate-50">
                    <Td>{row.campaign}</Td>
                    <Td align="right">{row.count}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
