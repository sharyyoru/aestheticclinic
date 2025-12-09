"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

type DealStageType =
  | "lead"
  | "consultation"
  | "surgery"
  | "post_op"
  | "follow_up"
  | "other";

type DealStage = {
  id: string;
  name: string;
  type: DealStageType;
  sort_order: number;
  is_default: boolean;
};

type DealPatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type DealService = {
  id: string;
  name: string | null;
};

type DealRow = {
  id: string;
  patient_id: string;
  stage_id: string;
  service_id: string | null;
  pipeline: string | null;
  contact_label: string | null;
  location: string | null;
  title: string | null;
  value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient: DealPatient | null;
  service: DealService | null;
};

type DealsView = "list" | "board";

export default function DealsPage() {
  const router = useRouter();
  const [view, setView] = useState<DealsView>("list");
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [dealStages, setDealStages] = useState<DealStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [updatingDealId, setUpdatingDealId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [stagesResult, dealsResult] = await Promise.all([
          supabaseClient
            .from("deal_stages")
            .select("id, name, type, sort_order, is_default")
            .order("sort_order", { ascending: true }),
          supabaseClient
            .from("deals")
            .select(
              "id, patient_id, stage_id, service_id, pipeline, contact_label, location, title, value, notes, created_at, updated_at, patient:patients(id, first_name, last_name), service:services(id, name)",
            )
            .order("created_at", { ascending: false }),
        ]);

        if (!isMounted) return;

        const { data: stagesData, error: stagesError } = stagesResult;
        const { data: dealsData, error: dealsError } = dealsResult;

        if (stagesError || !stagesData) {
          setDealStages([]);
        } else {
          setDealStages(stagesData as DealStage[]);
        }

        if (dealsError || !dealsData) {
          setError(dealsError?.message ?? "Failed to load deals.");
          setDeals([]);
          setLoading(false);
          return;
        }

        setDeals(dealsData as unknown as DealRow[]);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setError("Failed to load deals.");
        setDeals([]);
        setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredDeals = useMemo(() => {
    const base =
      serviceFilter === "all"
        ? deals
        : deals.filter((deal) => deal.service?.id === serviceFilter);

    if (!normalizedSearch) return base;

    return base.filter((deal) => {
      const title = (deal.title ?? "").toLowerCase();
      const pipeline = (deal.pipeline ?? "").toLowerCase();
      const patientName = `${deal.patient?.first_name ?? ""} ${deal.patient?.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const serviceName = (deal.service?.name ?? "").toLowerCase();

      return (
        title.includes(normalizedSearch) ||
        pipeline.includes(normalizedSearch) ||
        patientName.includes(normalizedSearch) ||
        serviceName.includes(normalizedSearch)
      );
    });
  }, [deals, normalizedSearch, serviceFilter]);

  const uniqueServices = useMemo(() => {
    const map = new Map<string, string>();
    deals.forEach((deal) => {
      const id = deal.service?.id;
      const name = deal.service?.name;
      if (id && name && !map.has(id)) {
        map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [deals]);

  const boardDeals = useMemo(() => {
    if (serviceFilter === "all") return deals;
    return deals.filter((deal) => deal.service?.id === serviceFilter);
  }, [deals, serviceFilter]);

  const boardScrollRef = useRef<HTMLDivElement | null>(null);

  function handleBoardDragOver(event: any) {
    if (!dragDealId) return;

    const container = boardScrollRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edgeThreshold = 80;
    const scrollSpeed = 20;
    const x = event.clientX as number;

    if (x - rect.left < edgeThreshold) {
      container.scrollLeft -= scrollSpeed;
    } else if (rect.right - x < edgeThreshold) {
      container.scrollLeft += scrollSpeed;
    }

    event.preventDefault();
  }

  function getStageName(stageId: string) {
    const stage = dealStages.find((candidate) => candidate.id === stageId);
    return stage ? stage.name : "Unknown";
  }

  async function handleDropOnStage(stageId: string) {
    if (!dragDealId) return;

    const current = deals.find((deal) => deal.id === dragDealId);
    if (!current || current.stage_id === stageId) {
      setDragDealId(null);
      return;
    }

    const previousStageId = current.stage_id;

    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dragDealId
          ? {
              ...deal,
              stage_id: stageId,
            }
          : deal,
      ),
    );
    setUpdatingDealId(dragDealId);

    try {
      const { error } = await supabaseClient
        .from("deals")
        .update({ stage_id: stageId, updated_at: new Date().toISOString() })
        .eq("id", dragDealId);

      if (error) {
        setDeals((prev) =>
          prev.map((deal) =>
            deal.id === dragDealId
              ? {
                  ...deal,
                  stage_id: previousStageId,
                }
              : deal,
          ),
        );
      } else {
        try {
          void fetch("/api/workflows/deal-stage-changed", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dealId: dragDealId,
              patientId: current.patient_id,
              fromStageId: previousStageId,
              toStageId: stageId,
              pipeline: current.pipeline,
            }),
          });
        } catch {
        }
      }
    } catch {
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === dragDealId
            ? {
                ...deal,
                stage_id: previousStageId,
              }
            : deal,
        ),
      );
    } finally {
      setUpdatingDealId(null);
      setDragDealId(null);
    }
  }

  const totalDeals = deals.length;

  return (
    <div className="space-y-6">
      {/* Main centered container: header, metrics, filter, and list view */}
      <div className="flex justify-center">
        <div className="w-full max-w-5xl space-y-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Deals</h1>
              <p className="text-sm text-slate-500">
                Global overview of all deals. Use a patient record to create and
                manage individual deals.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 p-1 text-[11px] text-slate-600">
              <button
                type="button"
                onClick={() => setView("list")}
                className={
                  "rounded-full px-3 py-1 " +
                  (view === "list"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "hover:text-slate-900")
                }
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={
                  "rounded-full px-3 py-1 " +
                  (view === "board"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "hover:text-slate-900")
                }
              >
                Board
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">Total Deal Amount</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">— CHF</p>
                <p className="mt-1 text-[11px] text-slate-400">Finance metrics coming soon</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">Weighted Deal</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">— CHF</p>
                <p className="mt-1 text-[11px] text-slate-400">Finance metrics coming soon</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">Open Deal Amount</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">— CHF</p>
                <p className="mt-1 text-[11px] text-slate-400">Finance metrics coming soon</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-xs shadow-sm">
                <p className="text-[11px] font-medium text-slate-500">Closed Deal Amount</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">— CHF</p>
                <p className="mt-1 text-[11px] text-slate-400">{totalDeals} total deals</p>
              </div>
            </div>

            {/* Global service filter (applies to list + board) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="all">All services</option>
                  {uniqueServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List view card (only when view === 'list') */}
            {view === "list" && (
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-xs shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-1 gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by deal, patient, pipeline, or service"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/patients"
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200/80 bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700"
                    >
                      <span className="inline-flex h-3 w-3 items-center justify-center">
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10 4v12" />
                          <path d="M4 10h12" />
                        </svg>
                      </span>
                      <span>Create Deal (via patient)</span>
                    </Link>
                  </div>
                </div>

                {loading ? (
                  <p className="text-[11px] text-slate-500">Loading deals...</p>
                ) : error ? (
                  <p className="text-[11px] text-red-600">{error}</p>
                ) : filteredDeals.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No deals found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="border-b text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">ID</th>
                          <th className="py-2 pr-3 font-medium">Deal Name</th>
                          <th className="py-2 pr-3 font-medium">Pipeline</th>
                          <th className="py-2 pr-3 font-medium">Stage</th>
                          <th className="py-2 pr-3 font-medium">Service</th>
                          <th className="py-2 pr-3 font-medium">Patient</th>
                          <th className="py-2 pr-3 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredDeals.map((deal) => {
                          const stageName = getStageName(deal.stage_id);
                          const patientName = deal.patient
                            ? `${deal.patient.first_name ?? ""} ${
                                deal.patient.last_name ?? ""
                              }`.trim() || "Unknown patient"
                            : "Unknown patient";
                          const createdDate = deal.created_at
                            ? new Date(deal.created_at)
                            : null;
                          const createdLabel =
                            createdDate && !Number.isNaN(createdDate.getTime())
                              ? createdDate.toLocaleDateString()
                              : "—";

                          const serviceName = deal.service?.name ?? "Not set";

                          return (
                            <tr
                              key={deal.id}
                              onClick={() =>
                                router.push(
                                  `/patients/${deal.patient_id}?mode=crm&tab=deals`,
                                )
                              }
                              className="cursor-pointer hover:bg-slate-50/70"
                            >
                              <td className="py-2 pr-3 align-top text-slate-500">
                                {deal.id.slice(0, 8)}
                              </td>
                              <td className="py-2 pr-3 align-top text-slate-900">
                                {deal.title || "Untitled deal"}
                              </td>
                              <td className="py-2 pr-3 align-top text-slate-700">
                                {deal.pipeline || "Geneva"}
                              </td>
                              <td className="py-2 pr-3 align-top text-slate-700">
                                {stageName}
                              </td>
                              <td className="py-2 pr-3 align-top text-slate-700">
                                {serviceName}
                              </td>
                              <td className="py-2 pr-3 align-top text-slate-700">
                                <span className="text-sky-700 underline-offset-2 hover:underline">
                                  {patientName}
                                </span>
                              </td>
                              <td className="py-2 pr-3 align-top text-slate-500">
                                {createdLabel}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating kanban board, outside the main container but aligned to it */}
      {view === "board" && (
        <div className="relative z-10 flex justify-center">
          <div className="w-full max-w-5xl space-y-2">
            <div className="flex items-center justify-between gap-2 px-1 text-xs">
              <span className="text-[11px] text-slate-400">
                Drag deals between stages to update their status.
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 text-xs shadow-sm">
              <div
                className="kanban-scroll w-full max-w-full overflow-x-auto pb-2"
                ref={boardScrollRef}
                onDragOver={handleBoardDragOver}
              >
                <div className="flex gap-3 px-3 py-3 md:gap-4">
                  {dealStages.map((stage) => {
                    const stageDeals = boardDeals.filter(
                      (deal) => deal.stage_id === stage.id,
                    );

                    return (
                      <div
                        key={stage.id}
                        className="flex min-w-[260px] max-w-xs flex-shrink-0 flex-col rounded-xl border border-slate-200/80 bg-slate-50/80"
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          void handleDropOnStage(stage.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 text-[11px]">
                          <p className="font-semibold text-slate-800">
                            {stage.name}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {stageDeals.length}
                          </span>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto p-2">
                          {stageDeals.length === 0 ? (
                            <p className="text-[10px] text-slate-400">
                              No deals in this stage.
                            </p>
                          ) : (
                            stageDeals.map((deal) => {
                              const createdDate = deal.created_at
                                ? new Date(deal.created_at)
                                : null;
                              const createdLabel =
                                createdDate &&
                                !Number.isNaN(createdDate.getTime())
                                  ? createdDate.toLocaleDateString()
                                  : "—";

                              const serviceName = deal.service?.name ?? "Not set";
                              const patientName = deal.patient
                                ? `${deal.patient.first_name ?? ""} ${
                                    deal.patient.last_name ?? ""
                                  }`.trim() || "Unknown patient"
                                : "Unknown patient";

                              const isUpdating = updatingDealId === deal.id;

                              return (
                                <div
                                  key={deal.id}
                                  draggable
                                  onDragStart={() => setDragDealId(deal.id)}
                                  onDragEnd={() => setDragDealId(null)}
                                  onClick={() =>
                                    router.push(
                                      `/patients/${deal.patient_id}?mode=crm&tab=deals`,
                                    )
                                  }
                                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-800 shadow-sm transition hover:border-sky-300 hover:shadow-md"
                                >
                                  <p className="text-[11px] font-semibold text-sky-700">
                                    {deal.title || "Untitled deal"}
                                  </p>
                                  <p className="mt-0.5 text-[12px] font-semibold text-emerald-700">
                                    Patient: {patientName}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-600">
                                    Pipeline: {deal.pipeline || "Geneva"}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-600">
                                    Location: {deal.location || "Geneva"}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-600">
                                    Service:{" "}
                                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                      {serviceName}
                                    </span>
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-600">
                                    Contact label: {deal.contact_label || "Marketing"}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-500">
                                    Created: {createdLabel}
                                  </p>
                                  {isUpdating ? (
                                    <p className="mt-0.5 text-[9px] text-slate-400">
                                      Updating stage…
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
