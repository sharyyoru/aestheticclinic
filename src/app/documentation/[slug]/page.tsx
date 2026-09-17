import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  DOCS_LAST_UPDATED,
  MODULES,
  getAdjacentModules,
  getCategory,
  getModule,
  getRelatedModules,
} from "../content";
import { DOCS_URL, SITE_URL } from "../site";
import { DocIcon } from "../components/icons";
import DocsAppPath from "../components/DocsAppPath";
import DocsPager from "../components/DocsPager";
import DocsSectionRenderer from "../components/DocsSectionRenderer";
import DocsTableOfContents from "../components/DocsTableOfContents";
import DocsVideo from "../components/DocsVideo";

type PageProps = { params: Promise<{ slug: string }> };

const AUDIENCE_LABELS: Record<string, string> = {
  staff: "Staff",
  admin: "Administrators",
  doctor: "Doctors",
  patient: "Patients",
};

export function generateStaticParams() {
  return MODULES.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getModule(slug);
  if (!doc) return { title: "Page not found" };

  const url = `${DOCS_URL}/${doc.slug}`;
  return {
    title: doc.title,
    description: `${doc.tagline} ${doc.summary}`.slice(0, 300),
    keywords: doc.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${doc.title} — Aliice Documentation`,
      description: doc.tagline,
      url,
      type: "article",
    },
  };
}

export default async function DocumentationModulePage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getModule(slug);
  if (!doc) notFound();

  const category = getCategory(doc.category);
  const { previous, next } = getAdjacentModules(doc.slug);
  const related = getRelatedModules(doc);
  const url = `${DOCS_URL}/${doc.slug}`;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "TechArticle",
      headline: doc.title,
      description: doc.tagline,
      url,
      articleSection: category?.title,
      keywords: doc.keywords.join(", "),
      isPartOf: { "@type": "WebSite", name: "Aliice Documentation", url: DOCS_URL },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Documentation", item: DOCS_URL },
        { "@type": "ListItem", position: 2, name: category?.title ?? "Modules", item: DOCS_URL },
        { "@type": "ListItem", position: 3, name: doc.title, item: url },
      ],
    },
  ];

  if (doc.video) {
    graph.push({
      "@type": "VideoObject",
      name: doc.video.title,
      description: doc.video.caption ?? doc.tagline,
      contentUrl: `${SITE_URL}${doc.video.src}`,
      embedUrl: url,
      ...(doc.video.poster ? { thumbnailUrl: `${SITE_URL}${doc.video.poster}` } : {}),
    });
  }

  if (doc.faqs && doc.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: doc.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }

  const jsonLd = { "@context": "https://schema.org", "@graph": graph };
  const tocItems = doc.sections.map((section) => ({ id: section.id, heading: section.heading }));

  return (
    <div className="flex gap-10 px-4 py-10 sm:px-8 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-w-0 max-w-3xl flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/documentation" className="hover:text-slate-600">
            Documentation
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span>{category?.title}</span>
        </nav>

        <header className="mt-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <DocIcon name={doc.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{doc.title}</h1>
              <p className="mt-1.5 text-base leading-relaxed text-slate-600">{doc.tagline}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <DocsAppPath path={doc.appPath} />
            {doc.audience.map((audience) => (
              <span
                key={audience}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500"
              >
                {AUDIENCE_LABELS[audience] ?? audience}
              </span>
            ))}
          </div>
        </header>

        <p className="mt-8 text-[15px] leading-relaxed text-slate-700">{doc.summary}</p>

        {doc.video && <DocsVideo video={doc.video} />}

        {doc.keyCapabilities.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-sky-500" aria-hidden="true" />
              What you can do here
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {doc.keyCapabilities.map((capability) => (
                <li key={capability} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
                  {capability}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 space-y-10">
          {doc.sections.map((section) => (
            <DocsSectionRenderer key={section.id} section={section} docSlug={doc.slug} />
          ))}
        </div>

        {doc.faqs && doc.faqs.length > 0 && (
          <section id="faq" className="mt-12 scroll-mt-28 border-t border-slate-100 pt-10">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Frequently asked</h2>
            <dl className="mt-5 space-y-4">
              {doc.faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-sm font-semibold text-slate-900">{faq.question}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12 border-t border-slate-100 pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Related pages</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {related.map((relatedModule) => (
                <li key={relatedModule.slug}>
                  <Link
                    href={`/documentation/${relatedModule.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                  >
                    <DocIcon name={relatedModule.icon} className="h-3.5 w-3.5 text-slate-400" />
                    {relatedModule.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <DocsPager previous={previous} next={next} />

        <p className="mt-10 text-xs text-slate-400">
          Last updated {DOCS_LAST_UPDATED}. Screens may differ slightly depending on your plan and role.
        </p>
      </main>

      <DocsTableOfContents items={tocItems} />
    </div>
  );
}
