"use client";

import type { Provider, StatisticsFilters } from "../page";
import ServicesTab from "./_ServicesTab";

export default function PaidServicesTab({
  filters,
}: {
  filters: StatisticsFilters;
  entities: Provider[];
  doctors: Provider[];
}) {
  return (
    <ServicesTab
      filters={filters}
      config={{
        endpoint: "/api/statistics/paid-services",
        exportEndpoint: "/api/statistics/paid-services/export",
        paidMode: true,
      }}
    />
  );
}
