import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, DOCS_LAST_UPDATED, MODULES, getCategoryModules, getModule } from "./content";
import { DOCS_URL } from "./site";
import { DocIcon } from "./components/icons";

export const metadata: Metadata = {
  title: "Aliice Documentation — every module and how to use it",
  description:
    "Complete user documentation for Aliice: patients, agenda, deals, Swiss insurance billing, workflows, AI agents, patient app and administration — with step-by-step instructions.",
  alternates: { canonical: DOCS_URL },
  openGraph: {
    title: "Aliice Documentation",
    description:
      "Complete user documentation for the Aliice clinic CRM and ERP: every module, every function, and how to use them.",
    url: DOCS_URL,
  },
};

const QUICK_START = [
  { slug: "overview", label: "Understand what Aliice does" },
  { slug: "signing-in", label: "Sign in and set up your account" },
  { slug: "navigating-the-app", label: "Find your way around" },
  { slug: "patients", label: "Create your first patient" },
  { slug: "agenda", label: "Book your first appointment" },
  { slug: "invoices", label: "Issue your first invoice" },
];

export default function DocumentationHubPage() {
  const quickStart = QUICK_START.map((item) => ({ ...item, module: getModule(item.slug) })).filter(
    (item) => item.module
  );

  const alphabetical = [...MODULES].sort((a, b) => a.title.localeCompare(b.title));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Aliice",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Medical CRM and ERP",
        operatingSystem: "Web",
        description:
          "Clinic CRM and ERP for aesthetic medicine: patient records, scheduling, sales pipeline, Swiss insurance billing, automation and AI assistants.",
        url: DOCS_URL,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Documentation", item: DOCS_URL },
        ],
      },
    ],
  };

  return (
    <main className="px-4 py-10 sm:px-8 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">Documentation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Everything Aliice does, and how to use it
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Aliice is the CRM and ERP built for aesthetic clinics: one place for patient records, the agenda,
          the sales pipeline, Swiss insurance billing, communication and automation. These pages document
          every module in the platform, what each function does, and the exact steps to use it.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {MODULES.length} modules across {CATEGORIES.length} areas · Last updated {DOCS_LAST_UPDATED}
        </p>
      </div>

      <section className="mt-12" aria-labelledby="start-here">
        <h2 id="start-here" className="text-lg font-semibold tracking-tight text-slate-900">
          Start here
        </h2>
        <p className="mt-1 text-sm text-slate-500">New to Aliice? Read these six pages in order.</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickStart.map((item, index) => (
            <li key={item.slug}>
              <Link
                href={`/documentation/${item.slug}`}
                className="group flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-200 hover:bg-sky-50/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.module!.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="browse-by-area">
        <h2 id="browse-by-area" className="text-lg font-semibold tracking-tight text-slate-900">
          Browse by area
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {CATEGORIES.map((category) => {
            const modules = getCategoryModules(category.id);
            if (modules.length === 0) return null;
            return (
              <div key={category.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <DocIcon name={category.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {category.title}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {modules.length} {modules.length === 1 ? "page" : "pages"}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{category.description}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                  {modules.map((module) => (
                    <li key={module.slug}>
                      <Link
                        href={`/documentation/${module.slug}`}
                        className="group flex items-baseline gap-2 text-sm text-slate-600 hover:text-sky-700"
                      >
                        <span className="font-medium">{module.title}</span>
                        <span className="truncate text-xs text-slate-400">{module.tagline}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="all-modules">
        <h2 id="all-modules" className="text-lg font-semibold tracking-tight text-slate-900">
          All pages, A–Z
        </h2>
        <ul className="mt-5 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {alphabetical.map((module) => (
            <li key={module.slug}>
              <Link
                href={`/documentation/${module.slug}`}
                className="group flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-700"
              >
                {module.title}
                <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
