import { ChevronRight, Compass } from "lucide-react";

/** Shows where a module lives in the interface, e.g. Menu › Patients › Contacts. */
export default function DocsAppPath({ path }: { path: string[] }) {
  if (path.length === 0) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
      <Compass className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      <span className="text-xs font-medium text-slate-500">Where to find it</span>
      <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
      {path.map((segment, index) => (
        <span key={`${segment}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 && <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />}
          <span className="text-xs font-semibold text-slate-700">{segment}</span>
        </span>
      ))}
    </div>
  );
}
