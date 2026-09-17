import type { MetadataRoute } from "next";
import { SITE_URL } from "./documentation/site";

/**
 * The documentation and the public marketing/booking pages are crawlable.
 * Everything belonging to the application itself is not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/documentation", "/pricing", "/pricingaliice", "/aliicechatembed", "/book-appointment"],
        disallow: [
          "/api/",
          "/patients",
          "/appointments",
          "/deals",
          "/invoices",
          "/invoice",
          "/financials",
          "/medidata",
          "/tardoc",
          "/insurers",
          "/statistics",
          "/settings",
          "/users",
          "/profile",
          "/tasks",
          "/comments",
          "/notifications",
          "/workflows",
          "/agents",
          "/marketing",
          "/controllers",
          "/lead-import",
          "/lead-analytics",
          "/leads",
          "/missed-calls",
          "/services",
          "/bookings",
          "/chat",
          "/chatlogs",
          "/prompt",
          "/knowledgebase",
          "/academy",
          "/internal-docs",
          "/email-reports",
          "/invoice-linker",
          "/client-onboarding",
          "/add-patients",
          "/qr-codes",
          "/search",
          "/aeo",
          "/intake",
          "/consultations",
          "/pre-consultation",
          "/form",
          "/embed",
          "/login",
          "/onboarding",
          "/prodapp",
          "/appx",
          "/patientapp",
          "/demo",
          "/apptest",
          "/embed-test",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
