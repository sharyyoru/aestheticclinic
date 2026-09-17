import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getGroupedModules } from "./content";
import { SITE_URL } from "./site";
import DocsSidebar, { type DocsNavGroup } from "./components/DocsSidebar";
import DocsSearch from "./components/DocsSearch";
import ForceLightTheme from "./components/ForceLightTheme";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Aliice Documentation",
    template: "%s — Aliice Documentation",
  },
  description:
    "User documentation for Aliice, the clinic CRM and ERP for aesthetic medicine: every module, every function, and how to use them.",
  openGraph: {
    type: "website",
    siteName: "Aliice Documentation",
  },
};

export default function DocumentationLayout({ children }: { children: React.ReactNode }) {
  const groups: DocsNavGroup[] = getGroupedModules().map(({ category, modules }) => ({
    id: category.id,
    title: category.title,
    icon: category.icon,
    modules: modules.map((m) => ({ slug: m.slug, title: m.title })),
  }));

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <ForceLightTheme />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/documentation" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/logos/aliice-logo.png"
              alt="Aliice"
              width={104}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span className="hidden text-sm font-medium text-slate-400 sm:inline">Documentation</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <DocsSearch />
            <Link
              href="/pricingaliice"
              className="hidden text-sm font-medium text-slate-500 transition hover:text-slate-900 sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] flex-col px-0 lg:flex-row lg:px-6">
        <DocsSidebar groups={groups} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Aliice — clinic CRM &amp; ERP for aesthetic medicine.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/documentation" className="hover:text-slate-900">
              Documentation
            </Link>
            <Link href="/pricingaliice" className="hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/aliicechatembed" className="hover:text-slate-900">
              Chat widget
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
