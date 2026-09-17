import { AlertTriangle, Info, Lightbulb, ShieldAlert } from "lucide-react";
import type { DocCallout } from "../content/types";

const STYLES = {
  tip: {
    wrapper: "border-emerald-200 bg-emerald-50",
    icon: "text-emerald-600",
    title: "text-emerald-900",
    body: "text-emerald-800",
    Icon: Lightbulb,
    fallbackTitle: "Tip",
  },
  note: {
    wrapper: "border-sky-200 bg-sky-50",
    icon: "text-sky-600",
    title: "text-sky-900",
    body: "text-sky-800",
    Icon: Info,
    fallbackTitle: "Note",
  },
  warning: {
    wrapper: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    title: "text-amber-900",
    body: "text-amber-800",
    Icon: AlertTriangle,
    fallbackTitle: "Careful",
  },
  important: {
    wrapper: "border-rose-200 bg-rose-50",
    icon: "text-rose-600",
    title: "text-rose-900",
    body: "text-rose-800",
    Icon: ShieldAlert,
    fallbackTitle: "Important",
  },
} as const;

export default function DocsCallout({ callout }: { callout: DocCallout }) {
  const style = STYLES[callout.kind] ?? STYLES.note;
  const { Icon } = style;

  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 ${style.wrapper}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${style.title}`}>{callout.title ?? style.fallbackTitle}</p>
        <p className={`mt-1 text-sm leading-relaxed ${style.body}`}>{callout.body}</p>
      </div>
    </div>
  );
}
