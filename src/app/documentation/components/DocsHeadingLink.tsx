"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export default function DocsHeadingLink({ anchor }: { anchor: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}${window.location.pathname}#${anchor}`;
    navigator.clipboard?.writeText(url);
    window.history.replaceState(null, "", `#${anchor}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy link to this section"
      aria-label="Copy link to this section"
      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500 focus:opacity-100"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
    </button>
  );
}
