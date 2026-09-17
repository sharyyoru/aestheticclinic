import { Check } from "lucide-react";
import type { DocSection } from "../content/types";
import { screenshotsFor } from "../content/screenshots.generated";
import DocsCallout from "./DocsCallout";
import DocsHeadingLink from "./DocsHeadingLink";
import DocsScreenshot from "./DocsScreenshot";

export default function DocsSectionRenderer({
  section,
  docSlug,
}: {
  section: DocSection;
  docSlug: string;
}) {
  const shots = screenshotsFor(docSlug, section.id);

  return (
    <section id={section.id} className="scroll-mt-28 border-t border-slate-100 pt-10 first:border-t-0 first:pt-0">
      <h2 className="group flex items-center text-xl font-semibold tracking-tight text-slate-900">
        <a href={`#${section.id}`} className="hover:text-sky-700">
          {section.heading}
        </a>
        <DocsHeadingLink anchor={section.id} />
      </h2>

      {section.intro && <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{section.intro}</p>}

      {shots.map((shot) => (
        <DocsScreenshot key={shot.src} shot={shot} />
      ))}

      {section.features && section.features.length > 0 && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {section.features.map((feature) => (
            <div key={feature.name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <dt className="text-sm font-semibold text-slate-900">{feature.name}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{feature.description}</dd>
              {feature.where && (
                <dd className="mt-2 text-xs font-medium text-slate-400">{feature.where}</dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {section.steps && section.steps.length > 0 && (
        <ol className="mt-5 space-y-4">
          {section.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                {index + 1}
              </span>
              <div className="min-w-0 pb-1">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
                {step.note && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="mt-5 space-y-2">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              <span className="text-sm leading-relaxed text-slate-600">{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {section.table.columns.map((column) => (
                  <th key={column} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-100">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-4 py-2.5 align-top leading-relaxed ${
                        cellIndex === 0 ? "font-medium text-slate-900" : "text-slate-600"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.callouts && section.callouts.length > 0 && (
        <div className="mt-5 space-y-3">
          {section.callouts.map((callout, index) => (
            <DocsCallout key={index} callout={callout} />
          ))}
        </div>
      )}
    </section>
  );
}
