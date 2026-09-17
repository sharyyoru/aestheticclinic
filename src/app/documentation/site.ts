/** Canonical origin used for documentation metadata, canonicals and sitemap entries. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://aestheticclinic.vercel.app").replace(
  /\/$/,
  ""
);

export const DOCS_URL = `${SITE_URL}/documentation`;
