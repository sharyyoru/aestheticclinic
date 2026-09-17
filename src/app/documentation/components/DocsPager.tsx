import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DocModule } from "../content/types";

export default function DocsPager({ previous, next }: { previous?: DocModule; next?: DocModule }) {
  if (!previous && !next) return null;

  return (
    <nav className="mt-12 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
      {previous ? (
        <Link
          href={`/documentation/${previous.slug}`}
          className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-200 hover:bg-sky-50/40"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-900 group-hover:text-sky-700">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={`/documentation/${next.slug}`}
          className="group rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-sky-200 hover:bg-sky-50/40 sm:col-start-2"
        >
          <span className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-400">
            Next
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-900 group-hover:text-sky-700">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
