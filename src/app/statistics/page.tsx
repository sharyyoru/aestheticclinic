"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import DebiteursTab from "./tabs/DebiteursTab";
import SentInvoicesTab from "./tabs/SentInvoicesTab";
import PaidInvoicesTab from "./tabs/PaidInvoicesTab";
import InvoicedServicesTab from "./tabs/InvoicedServicesTab";
import PaidServicesTab from "./tabs/PaidServicesTab";

type TabKey =
  | "debiteurs"
  | "sent_invoices"
  | "paid_invoices"
  | "invoiced_services"
  | "paid_services"
  | "services_apercu"
  | "non_invoiced"
  | "cash_collection"
  | "consultations_per_patient";

const TABS: {
  key: TabKey;
  label: string;
  description: string;
  locked?: boolean;
}[] = [
  {
    key: "debiteurs",
    label: "Debiteurs",
    description: "Open invoices per entity / doctor / patient",
  },
  {
    key: "sent_invoices",
    label: "Sent Invoices",
    description: "Invoices issued in a period",
  },
  {
    key: "paid_invoices",
    label: "Paid Invoices",
    description: "Invoices paid in a period",
  },
  {
    key: "invoiced_services",
    label: "Invoiced Services",
    description: "Service lines billed in a period",
  },
  {
    key: "paid_services",
    label: "Paid Services",
    description: "Service lines paid in a period",
  },
  {
    key: "services_apercu",
    label: "Services Apercu",
    description: "Services performed grouped by treatment date (coming soon)",
    locked: true,
  },
  {
    key: "non_invoiced",
    label: "Non-Invoiced Services",
    description: "Services performed but not yet billed (coming soon)",
    locked: true,
  },
  {
    key: "cash_collection",
    label: "Cash Collection",
    description: "Payments received by date and method (coming soon)",
    locked: true,
  },
  {
    key: "consultations_per_patient",
    label: "Consultations / Patient",
    description: "Consultation counts per patient and month (coming soon)",
    locked: true,
  },
];

export type Provider = {
  id: string;
  name: string;
  role: "billing_entity" | "doctor" | "nurse" | "technician";
};

export type StatisticsFilters = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  entityId: string; // provider_id where role=billing_entity, "" = all
  doctorId: string; // provider_id where role=doctor, "" = all
  law: string; // health_insurance_law, "" = all
  billingType: string; // TG / TP / ""
  includeCancelled: boolean;
};

function startOfYear(): string {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("debiteurs");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [filters, setFilters] = useState<StatisticsFilters>({
    from: startOfYear(),
    to: today(),
    entityId: "",
    doctorId: "",
    law: "",
    billingType: "",
    includeCancelled: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseClient
        .from("providers")
        .select("id, name, role")
        .order("name");
      if (cancelled) return;
      if (!error && data) setProviders(data as Provider[]);
      setProvidersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entities = useMemo(
    () => providers.filter((p) => p.role === "billing_entity"),
    [providers],
  );
  const doctors = useMemo(
    () => providers.filter((p) => p.role === "doctor"),
    [providers],
  );

  function patchFilters(patch: Partial<StatisticsFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Statistics</h1>
        <p className="text-sm text-slate-500">
          Accounting reports — invoiced &amp; paid services, sent &amp; paid invoices, debiteurs.
          Replicates the legacy Axenita Excel reports.
        </p>
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => {
          const active = t.key === activeTab;
          const locked = !!t.locked;
          return (
            <button
              key={t.key}
              type="button"
              disabled={locked}
              onClick={() => !locked && setActiveTab(t.key)}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
                (locked
                  ? "cursor-not-allowed text-slate-400"
                  : active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
              }
              title={t.description}
            >
              {locked && (
                <svg
                  className="h-3 w-3 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 11c-1.657 0-3 1.343-3 3v2a3 3 0 006 0v-2c0-1.657-1.343-3-3-3zm6-2V7a6 6 0 10-12 0v2a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2z"
                  />
                </svg>
              )}
              {t.label}
              {locked && (
                <span className="ml-1 rounded-sm bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Filters bar */}
      <FiltersBar
        filters={filters}
        onChange={patchFilters}
        entities={entities}
        doctors={doctors}
        loading={providersLoading}
        showDateRange={activeTab !== "debiteurs"}
        showAsOfDate={activeTab === "debiteurs"}
      />

      {/* Active tab body */}
      <div>
        {activeTab === "debiteurs" && (
          <DebiteursTab filters={filters} entities={entities} doctors={doctors} />
        )}
        {activeTab === "sent_invoices" && (
          <SentInvoicesTab filters={filters} entities={entities} doctors={doctors} />
        )}
        {activeTab === "paid_invoices" && (
          <PaidInvoicesTab filters={filters} entities={entities} doctors={doctors} />
        )}
        {activeTab === "invoiced_services" && (
          <InvoicedServicesTab filters={filters} entities={entities} doctors={doctors} />
        )}
        {activeTab === "paid_services" && (
          <PaidServicesTab filters={filters} entities={entities} doctors={doctors} />
        )}
      </div>
    </div>
  );
}

function FiltersBar({
  filters,
  onChange,
  entities,
  doctors,
  loading,
  showDateRange,
  showAsOfDate,
}: {
  filters: StatisticsFilters;
  onChange: (patch: Partial<StatisticsFilters>) => void;
  entities: Provider[];
  doctors: Provider[];
  loading: boolean;
  showDateRange: boolean;
  showAsOfDate: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        {showDateRange && (
          <>
            <Field label="From">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => onChange({ from: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={filters.to}
                onChange={(e) => onChange({ to: e.target.value })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </Field>
          </>
        )}
        {showAsOfDate && (
          <Field label="As of">
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </Field>
        )}

        <Field label="Entity">
          <select
            value={filters.entityId}
            onChange={(e) => onChange({ entityId: e.target.value })}
            disabled={loading}
            className="min-w-[160px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            <option value="">All entities</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Doctor / provider">
          <select
            value={filters.doctorId}
            onChange={(e) => onChange({ doctorId: e.target.value })}
            disabled={loading}
            className="min-w-[160px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Law">
          <select
            value={filters.law}
            onChange={(e) => onChange({ law: e.target.value })}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="PRIVATE">PRIVATE</option>
            <option value="KVG">KVG / LAMal</option>
            <option value="UVG">UVG / LAA</option>
            <option value="VVG">VVG / LCA</option>
            <option value="IVG">IVG</option>
            <option value="MVG">MVG</option>
          </select>
        </Field>

        <Field label="Billing">
          <select
            value={filters.billingType}
            onChange={(e) => onChange({ billingType: e.target.value })}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="TG">TG (Tiers Garant)</option>
            <option value="TP">TP (Tiers Payant)</option>
          </select>
        </Field>

        {showDateRange && (
          <Field label="Cancelled">
            <label className="inline-flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={filters.includeCancelled}
                onChange={(e) => onChange({ includeCancelled: e.target.checked })}
              />
              Include
            </label>
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
