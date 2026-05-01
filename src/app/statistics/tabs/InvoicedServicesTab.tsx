"use client";

import type { Provider, StatisticsFilters } from "../page";
import ServicesTab from "./_ServicesTab";

export default function InvoicedServicesTab({
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
        endpoint: "/api/statistics/invoiced-services",
        exportEndpoint: "/api/statistics/invoiced-services/export",
        paidMode: false,
      }}
    />
  );
}
