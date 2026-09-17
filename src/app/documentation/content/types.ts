// Content model for the public documentation site.
// Content is plain data so it can be rendered by server components (zero client JS)
// and later extended with a language key without changing the renderers.

export type DocCalloutKind = "tip" | "note" | "warning" | "important";

export type DocCallout = {
  kind: DocCalloutKind;
  title?: string;
  body: string;
};

/** A single numbered instruction in a "how to" list. */
export type DocStep = {
  title: string;
  body: string;
  note?: string;
};

/** A capability of the module, optionally with where it lives in the interface. */
export type DocFeature = {
  name: string;
  description: string;
  where?: string;
};

export type DocTable = {
  columns: string[];
  rows: string[][];
};

export type DocSection = {
  /** Slug used as the heading anchor, e.g. "creating-a-patient". */
  id: string;
  heading: string;
  intro?: string;
  features?: DocFeature[];
  steps?: DocStep[];
  bullets?: string[];
  table?: DocTable;
  callouts?: DocCallout[];
};

export type DocFaq = {
  question: string;
  answer: string;
};

export type DocAudience = "staff" | "admin" | "doctor" | "patient";

export type DocModule = {
  slug: string;
  title: string;
  tagline: string;
  /** DocCategory.id this module belongs to. */
  category: string;
  /** Key of the icon whitelist in components/icons.ts. */
  icon: string;
  /** Where the module lives in the interface, e.g. ["Menu", "Patients"]. */
  appPath: string[];
  audience: DocAudience[];
  summary: string;
  keyCapabilities: string[];
  sections: DocSection[];
  faqs?: DocFaq[];
  /** Slugs of related modules. */
  related?: string[];
  keywords: string[];
};

export type DocCategory = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

/** Flattened entry used to build the client-side search index. */
export type DocSearchEntry = {
  moduleSlug: string;
  moduleTitle: string;
  categoryTitle: string;
  sectionId?: string;
  heading: string;
  body: string;
  keywords: string;
};
