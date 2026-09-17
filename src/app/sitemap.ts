import type { MetadataRoute } from "next";
import { MODULES } from "./documentation/content";
import { SITE_URL } from "./documentation/site";

/** Public, crawlable pages only. Application pages require authentication. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const publicPages = ["/documentation", "/pricingaliice", "/aliicechatembed", "/book-appointment"];

  return [
    ...publicPages.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: path === "/documentation" ? 1 : 0.6,
    })),
    ...MODULES.map((module) => ({
      url: `${SITE_URL}/documentation/${module.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
