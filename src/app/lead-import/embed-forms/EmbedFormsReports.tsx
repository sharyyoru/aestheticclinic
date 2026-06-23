"use client";

import { useMemo, useState } from "react";
import { deriveChannel } from "@/lib/attribution";

export interface ReportLead {
  id: string;
  form_type: string;
  status: string;
  converted_to_patient_id: string | null;
  created_at: string;
  service: string | null;
  location: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  ttclid?: string | null;
}

type Preset = "7d" | "30d" | "month" | "90d" | "all";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const CHANNEL_COLORS: Record<string, string> = {
  "Paid Search": "#2563eb",
  "Paid Social": "#db2777",
  "Organic Search": "#16a34a",
  "Organic Social": "#0d9488",
  Email: "#d97706",
  "Other Campaign": "#7c3aed",
  Referral: "#64748b",
  Direct: "#94a3b8",
};

function isPaid(lead: ReportLead): boolean {
  const medium = (lead.utm_medium || "").toLowerCase();
  return Boolean(
    lead.gclid ||
      lead.gbraid ||
      lead.wbraid ||
      lead.fbclid ||
      lead.msclkid ||
      lead.ttclid ||
      /cpc|ppc|paid|cpm/.test(medium),
  );
}

function startOfPreset(preset: Preset, earliest: Date): Date {
  const now = new Date();
  if (preset === "all") return earliest;
  if (preset === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const d = new Date(now);
  d.setDate(d.getDate() - days + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EmbedFormsReports({ leads }: { leads: ReportLead[] }) {
  const [preset, setPreset] = useState<Preset>("30d");

  const earliest = useMemo(() => {
    if (leads.length === 0) return new Date();
    return leads.reduce((min, l) => {
      const d = new Date(l.created_at);
      return d < min ? d : min;
    }, new Date());
  }, [leads]);

  const start = useMemo(() => startOfPreset(preset, earliest), [preset, earliest]);

  const filtered = useMemo(
    () => leads.filter((l) => new Date(l.created_at) >= start),
    [leads, start],
  );

  // KPI metrics
  const kpis = useMemo(() => {
    const total = filtered.length;
    const converted = filtered.filter(
      (l) => l.status === "converted" || l.converted_to_patient_id,
    ).length;
    const bookings = filtered.filter((l) => l.form_type === "booking").length;
    const contacts = filtered.filter((l) => l.form_type === "contact").length;
    const paid = filtered.filter(isPaid).length;
    const campaigns = new Set(
      filtered.map((l) => l.utm_campaign).filter(Boolean) as string[],
    ).size;
    return {
      total,
      converted,
      convRate: total ? converted / total : 0,
      bookings,
      contacts,
      paid,
      paidRate: total ? paid / total : 0,
      campaigns,
    };
  }, [filtered]);

  // Time series (per day)
  const series = useMemo(() => {
    const end = new Date();
    const buckets: { key: string; label: string; count: number; converted: number }[] = [];
    const map = new Map<string, { count: number; converted: number }>();
    for (const l of filtered) {
      const k = dayKey(new Date(l.created_at));
      const cur = map.get(k) || { count: 0, converted: 0 };
      cur.count += 1;
      if (l.status === "converted" || l.converted_to_patient_id) cur.converted += 1;
      map.set(k, cur);
    }
    // cap the number of day columns for readability
    const maxDays = 45;
    const startCapped = new Date(Math.max(start.getTime(), end.getTime() - (maxDays - 1) * 86400000));
    for (let d = new Date(startCapped); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d);
      const v = map.get(k) || { count: 0, converted: 0 };
      buckets.push({
        key: k,
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        count: v.count,
        converted: v.converted,
      });
    }
    return buckets;
  }, [filtered, start]);

  const maxCount = useMemo(
    () => Math.max(1, ...series.map((b) => b.count)),
    [series],
  );

  // Channel grouping
  const channels = useMemo(() => {
    const map = new Map<string, { leads: number; converted: number }>();
    for (const l of filtered) {
      const ch = deriveChannel(l);
      const cur = map.get(ch) || { leads: 0, converted: 0 };
      cur.leads += 1;
      if (l.status === "converted" || l.converted_to_patient_id) cur.converted += 1;
      map.set(ch, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.leads - a.leads);
  }, [filtered]);

  // Top sources / campaigns
  function groupBy(key: (l: ReportLead) => string) {
    const map = new Map<string, { leads: number; converted: number }>();
    for (const l of filtered) {
      const k = key(l) || "(none)";
      const cur = map.get(k) || { leads: 0, converted: 0 };
      cur.leads += 1;
      if (l.status === "converted" || l.converted_to_patient_id) cur.converted += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.leads - a.leads);
  }

  const sources = useMemo(() => groupBy((l) => l.utm_source || "").slice(0, 10), [filtered]);
  const campaigns = useMemo(() => groupBy((l) => l.utm_campaign || "").slice(0, 10), [filtered]);
  const services = useMemo(() => groupBy((l) => l.service || "").slice(0, 6), [filtered]);

  const channelMax = Math.max(1, ...channels.map((c) => c.leads));

  return (
    <div className="space-y-6">
      {/* Range presets */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              preset === p.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} leads since {start.toLocaleDateString("en-GB")}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Leads" value={kpis.total} />
        <KpiCard label="Conversion Rate" value={fmtPct(kpis.convRate)} sub={`${kpis.converted} converted`} accent="text-green-600" />
        <KpiCard label="Bookings" value={kpis.bookings} accent="text-purple-600" />
        <KpiCard label="Contacts" value={kpis.contacts} accent="text-orange-600" />
        <KpiCard label="Paid Leads" value={kpis.paid} sub={fmtPct(kpis.paidRate)} accent="text-blue-600" />
        <KpiCard label="Campaigns" value={kpis.campaigns} accent="text-indigo-600" />
      </div>

      {/* Leads over time */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-900">Leads over time</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Leads</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Converted</span>
          </div>
        </div>
        {series.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No data in range</p>
        ) : (
          <div className="flex items-end gap-[3px] h-40">
            {series.map((b) => (
              <div key={b.key} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-sky-400 rounded-t-sm relative"
                  style={{ height: `${(b.count / maxCount) * 140}px` }}
                  title={`${b.label}: ${b.count} leads, ${b.converted} converted`}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-t-sm"
                    style={{ height: b.count ? `${(b.converted / b.count) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {series.length > 0 && (
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>{series[0].label}</span>
            <span>{series[series.length - 1].label}</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Channel breakdown */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-4">Traffic by channel</h3>
          {channels.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No data</p>
          ) : (
            <div className="space-y-3">
              {channels.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[c.name] || "#94a3b8" }} />
                      {c.name}
                    </span>
                    <span className="text-slate-500">
                      {c.leads} · <span className="text-green-600">{fmtPct(c.leads ? c.converted / c.leads : 0)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(c.leads / channelMax) * 100}%`, background: CHANNEL_COLORS[c.name] || "#94a3b8" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-4">Top services requested</h3>
          {services.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No data</p>
          ) : (
            <div className="space-y-3">
              {services.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 truncate pr-2">{s.name}</span>
                    <span className="text-slate-500">{s.leads}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400"
                      style={{ width: `${(s.leads / Math.max(1, ...services.map((x) => x.leads))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Source + Campaign tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        <SourceTable title="Top sources (utm_source)" rows={sources} />
        <SourceTable title="Top campaigns (utm_campaign)" rows={campaigns} />
      </div>

      {/* Spend note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Ad spend is not stored here</p>
        <p>
          Spend (CHF) lives in Google Ads / Meta Ads. To compute cost-per-lead, export each
          campaign&apos;s monthly spend and divide by its lead count above. With the new{" "}
          <span className="font-mono">gclid</span> capture, you can also import these leads back into
          Google Ads as offline conversions for accurate ROAS.
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${accent || "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SourceTable({ title, rows }: { title: string; rows: { name: string; leads: number; converted: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <h3 className="font-medium text-slate-900 px-4 py-3 border-b border-slate-100">{title}</h3>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Name</th>
            <th className="text-right py-2 px-4 font-medium">Leads</th>
            <th className="text-right py-2 px-4 font-medium">Conv.</th>
            <th className="text-right py-2 px-4 font-medium">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-slate-400">No data</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.name} className="hover:bg-slate-50">
                <td className="py-2 px-4 text-slate-700 truncate max-w-[200px]">{r.name}</td>
                <td className="py-2 px-4 text-right text-slate-700">{r.leads}</td>
                <td className="py-2 px-4 text-right text-green-600">{r.converted}</td>
                <td className="py-2 px-4 text-right text-slate-500">{fmtPct(r.leads ? r.converted / r.leads : 0)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
